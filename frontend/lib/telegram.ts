/**
 * Telegram Bot API transport, for alerting the admin.
 *
 * Exists because US carriers require A2P 10DLC registration before SMS will
 * deliver, and that is weeks of vetting plus a fee. A Telegram bot needs no
 * registration, no business entity and no identity check, and arrives as a push
 * notification within a second. It only works for the admin — a client would
 * have to install Telegram — which is exactly the party that needs alerting.
 *
 * Two env vars, both runtime-only:
 *
 *   TELEGRAM_BOT_TOKEN    from @BotFather
 *   TELEGRAM_CHAT_ID      the admin's own chat with the bot
 *
 * Follows `lib/sms.ts`'s two load-bearing rules exactly, and for the same
 * reasons: it **never throws**, because a committed booking is real whether or
 * not an alert went out; and with either variable missing it is a **no-op that
 * makes no request**, which is what lets local development and the whole test
 * suite run with no credentials and no mocking.
 */

/** Long enough for a normal API call, short enough not to hold a booking open. */
const ATTEMPT_TIMEOUT_MS = 4_000;

/**
 * A transient reset lost a real booking alert during testing — one failure in
 * five sends, with the next attempt succeeding untouched. A single try was
 * leaving the admin to find that booking on the dashboard instead.
 */
const MAX_ATTEMPTS = 3;

/**
 * The ceiling on *all* attempts together, which is what actually bounds the
 * damage. This is awaited on the booking request, so without a deadline a
 * Telegram outage would hold a client's confirmation open for the sum of every
 * timeout. With it, a hard outage costs a few seconds and then gives up; the
 * booking is already committed either way.
 */
const TOTAL_BUDGET_MS = 9_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Full jitter, the same shape as `createBooking`'s retry delay. Short, because
 * the failure this exists for is a momentary reset rather than congestion.
 */
function retryDelayMs(attempt: number): number {
  return Math.random() * 250 * 2 ** (attempt - 1);
}

type Attempt =
  /** Telegram took it. */
  | { kind: "sent" }
  /** Telegram said no, and would say no again — a bad token or chat ID. */
  | { kind: "rejected"; detail: string }
  /** Something momentary: a reset, a timeout, a 5xx, or a rate limit. */
  | { kind: "retryable"; detail: string; retryAfterMs?: number };

async function attemptSend(config: TelegramConfig, text: string): Promise<Attempt> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          // Links in an alert are for the admin's reference, not for reading.
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      }
    );

    if (response.ok) return { kind: "sent" };

    // The body carries Telegram's own description, which is the only way to
    // tell a bad token from a chat the bot was never introduced to.
    const detail = await response.text().catch(() => "");
    const status = `${response.status} ${detail}`;

    if (response.status === 429) {
      // Telegram says how long to wait; honour it, but the deadline still wins.
      const retryAfter = Number(
        detail.match(/"retry_after"\s*:\s*(\d+)/)?.[1] ?? NaN
      );
      return {
        kind: "retryable",
        detail: status,
        retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1_000 : undefined,
      };
    }

    // 5xx is Telegram's problem and may pass; 4xx is ours and won't.
    return response.status >= 500
      ? { kind: "retryable", detail: status }
      : { kind: "rejected", detail: status };
  } catch (error) {
    // Timeouts, DNS failures, connection resets — the transient class.
    return { kind: "retryable", detail: String(error) };
  }
}

type TelegramConfig = { token: string; chatId: string };

function readConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return null;
  return { token, chatId };
}

/** True when Telegram alerting is actually wired up. */
export function isTelegramConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Sends one alert, retrying the failures that are worth retrying. Returns
 * whether Telegram accepted it — never throws, and never makes a request when
 * unconfigured.
 *
 * Sent as **plain text, with no `parse_mode`**. Telegram's MarkdownV2 and HTML
 * modes require escaping, and every value in these alerts is user-controlled: a
 * client named `O'Neil & Sons` or a service called `Hair & Beard` would either
 * corrupt the message or make the send fail outright. Plain text has no
 * escaping rules to get wrong, and Telegram still auto-links phone numbers and
 * URLs — so a tappable number survives without the risk.
 *
 * A rejection is never retried. A bad token or an unknown chat ID fails
 * identically every time, so retrying only delays the booking response for a
 * result that cannot change.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const config = readConfig();

  if (!config) {
    // Not an error: this is the normal state in development and in tests.
    console.info("[telegram] not configured, skipping alert");
    return false;
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptSend(config, text);

    if (outcome.kind === "sent") return true;

    if (outcome.kind === "rejected") {
      console.error(`[telegram] send rejected: ${outcome.detail}`);
      return false;
    }

    const delay = outcome.retryAfterMs ?? retryDelayMs(attempt);
    const outOfAttempts = attempt === MAX_ATTEMPTS;
    const outOfTime = Date.now() + delay >= deadline;

    if (outOfAttempts || outOfTime) {
      console.error(
        `[telegram] send failed after ${attempt} attempt${attempt === 1 ? "" : "s"}: ` +
          outcome.detail
      );
      return false;
    }

    console.warn(`[telegram] attempt ${attempt} failed, retrying: ${outcome.detail}`);
    await sleep(delay);
  }

  return false;
}
