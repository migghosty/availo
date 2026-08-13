import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getOrigin } from "@/lib/siteUrl";
import { isValidTwilioSignature } from "@/lib/twilioSignature";

/**
 * Twilio's inbound-message webhook, used only to learn who has opted out.
 *
 * Twilio's Advanced Opt-Out already blocks a number that texts STOP and already
 * auto-replies to it, so this endpoint does not enforce anything — it records,
 * so the admin dashboard can show "opted out of texts" instead of a client
 * appearing to be ignored, and so `notifications.ts` can skip a send that could
 * only be refused.
 *
 * This is the one unauthenticated write endpoint in the app. Every request is
 * signature-checked; see `lib/twilioSignature.ts` for why that is the whole
 * security model here.
 */

export const dynamic = "force-dynamic";

/** Keywords Twilio treats as opt-out / opt-in. Compared case-insensitively. */
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_WORDS = new Set(["start", "unstop", "yes"]);

export async function POST(req: Request) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  // Twilio signs the URL it was configured with. Behind Vercel's proxy the
  // request's own URL has the internal host, so rebuild it from the forwarded
  // headers the same way every other absolute link in this app is built.
  const url = `${await getOrigin()}/api/sms/inbound`;

  const valid = isValidTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    url,
    params,
    signature: req.headers.get("x-twilio-signature"),
  });

  if (!valid) {
    // Deliberately terse: a caller who isn't Twilio learns nothing about why.
    return new Response("Forbidden", { status: 403 });
  }

  const phone = normalizePhone(params.From ?? "");
  const keyword = (params.Body ?? "").trim().toLowerCase();

  if (phone) {
    if (STOP_WORDS.has(keyword)) {
      await db.smsOptOut.upsert({
        where: { phone },
        update: {},
        create: { phone },
      });
      console.info(`[sms] ${phone} opted out`);
    } else if (START_WORDS.has(keyword)) {
      await db.smsOptOut.deleteMany({ where: { phone } });
      console.info(`[sms] ${phone} opted back in`);
    }
  }

  // Empty 204 rather than TwiML: Twilio already auto-replies to STOP and HELP,
  // and returning a message here would text them twice.
  return new Response(null, { status: 204 });
}
