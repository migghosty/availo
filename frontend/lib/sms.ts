/**
 * The only module in this app that makes an outbound network call.
 *
 * Sending is **fail-open, always**. A booking that has committed is a real
 * appointment whether or not a text went out, so `sendSms` swallows every error
 * and returns false rather than throwing. Nothing upstream should ever branch on
 * a booking having failed because a message didn't send — if that ever becomes
 * tempting, the fix is a retry queue, not an exception.
 *
 * Twilio's REST API is a form POST with basic auth, so it is called directly
 * rather than through the SDK — the same reasoning that keeps `calendar.ts` and
 * `phone.ts` hand-rolled. Three env vars, all runtime-only:
 *
 *   TWILIO_ACCOUNT_SID    ACxxxxxxxx…
 *   TWILIO_AUTH_TOKEN     the account's auth token
 *   TWILIO_FROM_NUMBER    the sending number, E.164
 *
 * With any of them missing this module is a no-op that makes no request. That is
 * deliberate and load-bearing: it is what lets local development and the whole
 * integration suite run untouched, with no credentials and no mocking.
 */

/** Long enough for a normal API call, short enough not to hold a booking open. */
const SEND_TIMEOUT_MS = 5_000;

type TwilioConfig = { accountSid: string; authToken: string; from: string };

function readConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/** True when texting is actually wired up. Exported for diagnostics/tests. */
export function isSmsConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Sends one message. Returns whether it was accepted by the provider — never
 * throws, and never makes a request when unconfigured.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const config = readConfig();

  if (!config) {
    // Not an error: this is the normal state in development and in tests.
    console.info(`[sms] not configured, skipping message to ${to}`);
    return false;
  }

  if (!to) return false;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Basic auth, per Twilio's REST API.
          Authorization:
            "Basic " +
            Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: config.from, Body: body }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      // The body carries Twilio's error code and message, which is the only
      // way to tell an unverified number from a bad credential.
      const detail = await response.text().catch(() => "");
      console.error(`[sms] send to ${to} failed: ${response.status} ${detail}`);
      return false;
    }

    return true;
  } catch (error) {
    // Timeouts, DNS failures, aborts — all non-fatal by design.
    console.error(`[sms] send to ${to} threw:`, error);
    return false;
  }
}

