/**
 * Who gets told what, over which channel.
 *
 * Sits between the copy (`bookingSms.ts` and `adminAlerts.ts`, both pure) and
 * the transports (`sms.ts`, `telegram.ts` — the only outbound calls) because it
 * needs the database: the admin's number, the business name and the opt-out
 * list all live there. Keeping that dependency here is what lets the transports
 * and their tests stay clear of Prisma.
 *
 * **The admin and the client are on different channels, for different reasons.**
 * The admin is one known person who can install anything, so alerts go to
 * Telegram — free, instant, and needing no carrier registration. Clients only
 * gave a phone number, so they can only be reached by SMS, which stays dormant
 * until A2P 10DLC registration is done. Setting the Twilio env vars is all it
 * takes to switch that on.
 *
 * **Nothing in this module throws.** A booking or a cancellation that has
 * already committed is real whether or not an alert went out, so every path is
 * wrapped. If reliable delivery ever matters more than this, the answer is a
 * retry queue, not an exception the caller has to handle.
 */

import { clientCancelledAlert, newBookingAlert, type AlertableBooking } from "./adminAlerts";
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
import { isTelegramConfigured, sendTelegram } from "./telegram";

/**
 * `sendSms` and `sendTelegram` already swallow their own failures, but these
 * functions also read Settings and format dates — this covers everything else.
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
 * Alerts the admin over exactly one channel.
 *
 * Telegram wins when configured; admin SMS is the fallback for once 10DLC
 * registration is done. Never both — one alert per event, whatever is set up.
 * Both admin-facing events route through here so they can't drift apart on
 * which channel they use.
 */
async function alertAdmin({
  telegramText,
  smsText,
}: {
  telegramText: string;
  smsText: string;
}): Promise<void> {
  if (isTelegramConfigured()) {
    await sendTelegram(telegramText);
    return;
  }

  // An unset admin number means these alerts are simply off.
  const adminPhone = await getAdminPhone();
  if (adminPhone) await sendUnlessOptedOut(adminPhone, smsText);
}

/**
 * Confirmation to the client, alert to the admin.
 *
 * The two are independent: an unconfigured admin channel, an opted-out client,
 * or a failure reaching one party must not stop the other from being told.
 */
export async function notifyBookingCreated(
  booking: AlertableBooking & NotifiableBooking,
  { origin }: { origin?: string } = {}
): Promise<void> {
  await neverThrows("booking-created notification", async () => {
    // The admin doesn't need telling where their own shop is, so the address
    // goes only to the client.
    const [address, businessName] = await Promise.all([
      getBusinessAddress(),
      getBusinessName(),
    ]);

    await Promise.all([
      sendUnlessOptedOut(
        booking.clientPhone,
        clientBookingConfirmed(booking, { businessName, origin, address })
      ),
      alertAdmin({
        telegramText: newBookingAlert(booking, { businessName }),
        smsText: adminNewBooking(booking, { businessName }),
      }),
    ]);
  });
}

/** Tells whichever party did *not* do the cancelling. */
export async function notifyBookingCancelled(
  booking: AlertableBooking & NotifiableBooking,
  cancelledBy: "client" | "admin",
  { origin }: { origin?: string } = {}
): Promise<void> {
  await neverThrows("cancellation notification", async () => {
    const businessName = await getBusinessName();

    if (cancelledBy === "client") {
      await alertAdmin({
        telegramText: clientCancelledAlert(booking, { businessName }),
        smsText: adminClientCancelled(booking, { businessName }),
      });
      return;
    }

    await sendUnlessOptedOut(
      booking.clientPhone,
      clientAdminCancelled(booking, { businessName, origin })
    );
  });
}
