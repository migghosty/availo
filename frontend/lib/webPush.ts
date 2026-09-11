/**
 * Web Push transport, for the admin's home-screen app.
 *
 * The third channel, alongside `lib/sms.ts` (clients) and `lib/telegram.ts`
 * (admin). It exists because the admin runs this app from an icon on their
 * iPhone home screen, and since iOS 16.4 Safari will deliver real push
 * notifications to a site installed that way — lock screen, badge, the lot —
 * with no App Store, no native app and no developer account.
 *
 * Follows the same two load-bearing rules as the other two transports:
 * it **never throws**, because a committed booking is a real appointment
 * whether or not an alert went out; and with the VAPID keys missing it is a
 * **no-op that makes no request**, which is what lets local development and the
 * whole test suite run with no credentials and no mocking.
 *
 * Three runtime-only env vars:
 *
 *   VAPID_PUBLIC_KEY     from `npx web-push generate-vapid-keys`
 *   VAPID_PRIVATE_KEY    the matching private key
 *   VAPID_SUBJECT        mailto: or https: contact, required by the spec
 *
 * The key pair must be **identical** in every environment that shares
 * subscriptions, and must not be rotated casually: a subscription is bound to
 * the public key it was created with, so new keys silently invalidate every
 * existing one.
 *
 * ## Two ways this differs from its siblings, both deliberate
 *
 * **It reads the database.** `sms.ts` and `telegram.ts` are handed a
 * destination; here the recipient list *is* a table, because a browser
 * subscription is issued by the browser and can only be stored. That is also
 * why this module, not `notifications.ts`, does the pruning.
 *
 * **It does not retry.** `telegram.ts` retries because it is the admin's only
 * alert; a lost message there is a booking the admin never hears about. Push is
 * always accompanied by a Telegram or SMS alert for the same event, so a failed
 * push costs the nicer-looking copy of a message that still arrived. Retrying
 * would add latency to a client's confirmation to fix nothing.
 *
 * ## Why `web-push` rather than hand-rolled
 *
 * Twilio and Telegram are called with bare `fetch` — an HTTP form POST and a
 * JSON POST — in the same spirit as `calendar.ts` and `phone.ts`. Web push is
 * not in that class: RFC 8291 requires the payload be encrypted with an
 * ephemeral ECDH P-256 key agreement, HKDF-derived keys and AES-128-GCM, and
 * RFC 8292 requires a signed ES256 JWT per push service origin. Hand-rolling
 * that is a security exercise, not a convenience one.
 */

import webpush, { WebPushError, type PushSubscription } from "web-push";
import { db } from "./db";

/** Socket timeout per push service request. */
const SEND_TIMEOUT_MS = 4_000;

/**
 * The ceiling on a whole `sendPushToAll` call. Sends run in parallel, so this
 * is not a sum — it is the backstop for a push service that accepts a
 * connection and then says nothing, since `timeout` above is a *socket*
 * timeout and would not fire in that case. This is awaited on the booking
 * request, so an outage must not hold a client's confirmation open.
 */
const TOTAL_BUDGET_MS = 6_000;

/**
 * How long the push service should hold the message for a phone that is off.
 *
 * Twelve hours rather than the four-week default: a "new booking" notification
 * arriving days later is noise, and the appointment itself may already have
 * happened. Short enough to stay meaningful, long enough to survive a night
 * with the phone in a drawer.
 */
const TTL_SECONDS = 12 * 60 * 60;

/**
 * What the service worker in `public/sw.js` expects to receive. Kept in step
 * with it by hand — the worker is not compiled by the Next build, so there is
 * no shared type to import.
 */
export type PushPayload = {
  /** Bold first line. Keep it short; iOS truncates hard on the lock screen. */
  title: string;
  body: string;
  /** Where a tap should land. Defaults to the dashboard in the worker. */
  url?: string;
  /** Same tag replaces rather than stacks an earlier notification. */
  tag?: string;
};

type VapidConfig = { subject: string; publicKey: string; privateKey: string };

function readConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}

/** True when push is actually wired up. */
export function isWebPushConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * The public key a browser needs to subscribe, or null when unconfigured.
 *
 * Read on the server and passed to `PushToggle` as a prop, the same way
 * `isSmsConfigured()` reaches the booking form. Deliberately not a
 * `NEXT_PUBLIC_*` variable: those are inlined at build time, so one build could
 * not serve preview and production with different keys, and a key rotation
 * would need a rebuild rather than a redeploy.
 */
export function getVapidPublicKey(): string | null {
  return readConfig()?.publicKey ?? null;
}

/**
 * A 404 or 410 from the push service means this endpoint is permanently gone —
 * the home-screen app was deleted, the browser data cleared, iOS restored.
 * Anything else (a 429, a 5xx, a network error) may work next time.
 *
 * Every other status is left alone on purpose: deleting a subscription because
 * of a transient failure would silently turn notifications off for good, and
 * the admin's only clue would be their absence.
 */
function isGone(error: unknown): boolean {
  return (
    error instanceof WebPushError &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type PushResult = { sent: number; failed: number; pruned: number };

/**
 * Sends one notification to every subscribed browser.
 *
 * Never throws, and makes no request when unconfigured or when nobody has
 * subscribed. Returns a count, which the "send test notification" endpoint
 * reports back to the admin so a silent failure is at least visible somewhere.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  const config = readConfig();
  const empty: PushResult = { sent: 0, failed: 0, pruned: 0 };

  if (!config) {
    // Not an error: this is the normal state in development and in tests.
    console.info("[push] not configured, skipping notification");
    return empty;
  }

  let subscriptions;
  try {
    subscriptions = await db.pushSubscription.findMany();
  } catch (error) {
    console.error("[push] could not read subscriptions:", error);
    return empty;
  }

  if (subscriptions.length === 0) return empty;

  const body = JSON.stringify(payload);
  const result: PushResult = { ...empty };

  const sends = subscriptions.map(async (row) => {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, body, {
        vapidDetails: config,
        timeout: SEND_TIMEOUT_MS,
        TTL: TTL_SECONDS,
      });

      result.sent++;
      // Not awaited as part of the send's success: a bookkeeping write must not
      // be able to turn a delivered notification into a reported failure.
      await db.pushSubscription
        .update({ where: { id: row.id }, data: { lastSuccessAt: new Date() } })
        .catch(() => {});
    } catch (error) {
      if (isGone(error)) {
        result.pruned++;
        console.info(`[push] endpoint gone, removing subscription ${row.id}`);
        await db.pushSubscription.delete({ where: { id: row.id } }).catch(() => {});
        return;
      }

      result.failed++;
      console.error(`[push] send to subscription ${row.id} failed:`, error);
    }
  });

  /**
   * `allSettled` cannot reject, so the race only ever decides whether we stop
   * waiting. Anything still in flight when the budget expires keeps running
   * detached — its pruning may or may not land before the serverless instance
   * freezes, which is fine: the next send re-discovers a dead endpoint.
   */
  const finished = await Promise.race([
    Promise.allSettled(sends).then(() => true as const),
    sleep(TOTAL_BUDGET_MS).then(() => false as const),
  ]);

  if (!finished) {
    console.error(`[push] gave up waiting after ${TOTAL_BUDGET_MS}ms`);
  }

  return result;
}
