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
const SEND_TIMEOUT_MS = 5_000;

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
 * Sends one alert. Returns whether Telegram accepted it — never throws, and
 * never makes a request when unconfigured.
 *
 * Sent as **plain text, with no `parse_mode`**. Telegram's MarkdownV2 and HTML
 * modes require escaping, and every value in these alerts is user-controlled: a
 * client named `O'Neil & Sons` or a service called `Hair & Beard` would either
 * corrupt the message or make the send fail outright. Plain text has no
 * escaping rules to get wrong, and Telegram still auto-links phone numbers and
 * URLs — so a tappable number survives without the risk.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const config = readConfig();

  if (!config) {
    // Not an error: this is the normal state in development and in tests.
    console.info("[telegram] not configured, skipping alert");
    return false;
  }

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
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      // The body carries Telegram's own description, which is the only way to
      // tell a bad token from a chat the bot was never introduced to.
      const detail = await response.text().catch(() => "");
      console.error(`[telegram] send failed: ${response.status} ${detail}`);
      return false;
    }

    return true;
  } catch (error) {
    // Timeouts, DNS failures, aborts — all non-fatal by design.
    console.error("[telegram] send threw:", error);
    return false;
  }
}
