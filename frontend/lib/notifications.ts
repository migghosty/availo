/**
 * Who gets told what, and when.
 *
 * Sits between the copy (`bookingSms.ts`, pure) and the transport (`sms.ts`,
 * the only outbound call) because it needs the database — the admin's number,
 * the business name and the opt-out list all live there. Keeping that
 * dependency here is what lets `sms.ts` and its tests stay clear of Prisma.
 *
 * **Nothing in this module throws.** A booking or a cancellation that has
 * already committed is real whether or not a text went out, so every path is
 * wrapped. If reliable delivery ever matters more than this, the answer is a
 * retry queue, not an exception the caller has to handle.
 */

import {
  adminClientCancelled,
  adminNewBooking,
  clientAdminCancelled,
  clientBookingConfirmed,
  type NotifiableBooking,
} from "./bookingSms";
import { db } from "./db";
import { getAdminPhone, getBusinessAddress, getBusinessName } from "./settingsData";
import { sendSms } from "./sms";

/**
 * `sendSms` already swallows its own failures, but these functions also read
 * Settings and format dates — this covers everything else.
 */
async function neverThrows(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[notifications] ${what} failed:`, error);
  }
}

/**
 * Whether this number has texted STOP.
 *
 * Twilio blocks opted-out numbers at its end regardless, so this is a courtesy
 * rather than the enforcement: it saves an API call that can only be refused,
 * and keeps a scary-looking 21610 out of the logs.
 */
async function hasOptedOut(phone: string): Promise<boolean> {
  return (await db.smsOptOut.findUnique({ where: { phone } })) !== null;
}

/** Sends unless the recipient has opted out. */
async function sendUnlessOptedOut(to: string, body: string): Promise<void> {
  if (await hasOptedOut(to)) {
    console.info(`[notifications] ${to} has opted out, skipping`);
    return;
  }
  await sendSms(to, body);
}

/**
 * Confirmation to the client, heads-up to the admin.
 *
 * The two sends are independent: an unset admin number, an opted-out client, or
 * a failure reaching one party must not stop the other from being told.
 */
export async function notifyBookingCreated(
  booking: NotifiableBooking,
  { origin }: { origin?: string } = {}
): Promise<void> {
  await neverThrows("booking-created notification", async () => {
    // The admin doesn't need telling where their own shop is, so the address
    // goes only to the client.
    const [adminPhone, address, businessName] = await Promise.all([
      getAdminPhone(),
      getBusinessAddress(),
      getBusinessName(),
    ]);

    await Promise.all([
      sendUnlessOptedOut(
        booking.clientPhone,
        clientBookingConfirmed(booking, { businessName, origin, address })
      ),
      adminPhone
        ? sendUnlessOptedOut(adminPhone, adminNewBooking(booking, { businessName }))
        : Promise.resolve(),
    ]);
  });
}

/** Tells whichever party did *not* do the cancelling. */
export async function notifyBookingCancelled(
  booking: NotifiableBooking,
  cancelledBy: "client" | "admin",
  { origin }: { origin?: string } = {}
): Promise<void> {
  await neverThrows("cancellation notification", async () => {
    const businessName = await getBusinessName();

    if (cancelledBy === "client") {
      // An unset admin number means these notifications are simply off.
      const adminPhone = await getAdminPhone();
      if (adminPhone) {
        await sendUnlessOptedOut(
          adminPhone,
          adminClientCancelled(booking, { businessName })
        );
      }
      return;
    }

    await sendUnlessOptedOut(
      booking.clientPhone,
      clientAdminCancelled(booking, { businessName, origin })
    );
  });
}
