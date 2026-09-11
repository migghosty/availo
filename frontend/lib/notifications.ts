/**
 * Who gets told what, over which channel.
 *
 * Sits between the copy (`bookingSms.ts` and `adminAlerts.ts`, both pure) and
 * the transports (`sms.ts`, `telegram.ts`, `webPush.ts` — the only outbound
 * calls) because it needs the database: the admin's number, the business name
 * and the opt-out list all live there. Keeping that dependency here is what lets
 * `sms.ts` and `telegram.ts` stay clear of Prisma; `webPush.ts` is the one
 * transport that cannot, since a browser subscription can only be stored.
 *
 * **The admin and the client are on different channels, for different reasons.**
 * The admin is one known person who can install anything, so alerts go to
 * Telegram — free, instant, and needing no carrier registration — and, on top
 * of that, as a push notification to the home-screen app on their phone.
 * Clients only gave a phone number, so they can only be reached by SMS, which
 * stays dormant until A2P 10DLC registration is done. Setting the Twilio env
 * vars is all it takes to switch that on.
 *
 * **Nothing in this module throws.** A booking or a cancellation that has
 * already committed is real whether or not an alert went out, so every path is
 * wrapped. If reliable delivery ever matters more than this, the answer is a
 * retry queue, not an exception the caller has to handle.
 */

import {
  clientCancelledAlert,
  clientCancelledPush,
  newBookingAlert,
  newBookingPush,
  type AlertableBooking,
  type PushAlert,
} from "./adminAlerts";
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
import { sendPushToAll } from "./webPush";

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
 * Alerts the admin by text, over exactly one channel.
 *
 * Telegram wins when configured; admin SMS is the fallback for once 10DLC
 * registration is done. Never both — one *text* per event, whatever is set up,
 * because these two carry the same words to the same person and a duplicate is
 * pure annoyance. Push is not in that pair; see `alertAdmin` below.
 */
async function alertAdminText({
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
 * Alerts the admin: one text, plus a push to their home-screen app.
 *
 * **Push is additive, deliberately.** Every other pairing in this module is
 * exclusive, so this needs justifying: Apple's Web Push implementation fails
 * quietly in ways the text channels do not. Deleting the home-screen icon,
 * restoring the phone, or an expired subscription all stop pushes with nothing
 * anywhere to say so — the admin would simply find the booking on the dashboard
 * and never know an alert was owed. So the text channel keeps firing on every
 * event regardless, and push is the faster, better-looking second copy of a
 * message that arrived either way.
 *
 * The two are independent: `sendPushToAll` and `alertAdminText` each swallow
 * their own failures, and one being unconfigured must not stop the other.
 * Both admin-facing events route through here so they can't drift apart on
 * which channels they use.
 */
async function alertAdmin({
  telegramText,
  smsText,
  push,
}: {
  telegramText: string;
  smsText: string;
  push: PushAlert;
}): Promise<void> {
  await Promise.all([
    sendPushToAll(push),
    alertAdminText({ telegramText, smsText }),
  ]);
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
        push: newBookingPush(booking),
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
        push: clientCancelledPush(booking),
      });
      return;
    }

    await sendUnlessOptedOut(
      booking.clientPhone,
      clientAdminCancelled(booking, { businessName, origin })
    );
  });
}
