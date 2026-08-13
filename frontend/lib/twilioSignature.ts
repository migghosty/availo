/**
 * Validation of Twilio's request signature.
 *
 * `/api/sms/inbound` is the only unauthenticated *write* endpoint in this app —
 * anyone on the internet can POST to it. Without this check they could opt
 * arbitrary numbers out of their own appointment reminders, so the validation
 * is the endpoint's entire security model rather than a hardening extra.
 *
 * Twilio's algorithm (documented under "Validating Signatures from Twilio"):
 *
 *   1. Take the full URL the request was sent to, including query string.
 *   2. Append every POST parameter, sorted by key, as key then value, with no
 *      separators at all.
 *   3. HMAC-SHA1 that string with the account's auth token, base64-encode it.
 *   4. Compare with the `X-Twilio-Signature` header.
 *
 * Hand-rolled with `node:crypto` rather than pulling the SDK, consistent with
 * `lib/sms.ts` calling the REST API directly.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** The signature Twilio would have sent for this request. */
export function expectedSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

/**
 * Whether a request genuinely came from Twilio.
 *
 * Returns false rather than throwing for every failure mode — a missing token,
 * a missing header, a wrong signature — because the caller's response to all of
 * them is identical, and an unconfigured deployment must reject rather than
 * fall open. This is the opposite of `sendSms`'s fail-open rule: failing open
 * on an outbound text costs a notification, failing open here costs integrity.
 */
export function isValidTwilioSignature({
  authToken,
  url,
  params,
  signature,
}: {
  authToken: string | undefined;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!authToken || !signature) return false;

  const expected = expectedSignature(authToken, url, params);

  // Both are base64 of a 20-byte digest, so equal length is expected; the
  // guard is for a malformed header, which would make timingSafeEqual throw.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
