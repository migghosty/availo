/**
 * Walks you through wiring up the Telegram bot, and says exactly what's wrong
 * when it isn't working.
 *
 * The manual route — pasting getUpdates into a browser — fails silently: an
 * empty `{"ok":true,"result":[]}` looks like an error but is just "no messages
 * yet", and it can't tell you that you messaged a *different* bot than the
 * token belongs to. This checks each link in the chain in order and names the
 * one that's broken.
 *
 *   npx tsx scripts/telegram-setup.ts            # reads .env.local
 *   npx tsx scripts/telegram-setup.ts <BOT_TOKEN>  # before you've saved it
 *
 * Reads the same env files the app does, so once the variables are saved you
 * can run it bare and keep the token off your command line and out of your
 * shell history. If TELEGRAM_CHAT_ID is set too, it sends a test message so you
 * can confirm the whole path end to end.
 */

import { config } from "dotenv";

// Next.js loads .env.local over .env; match that so the script sees exactly
// what `npm run dev` will. dotenv never overwrites an already-set variable, so
// a real environment variable still wins.
config({ path: ".env.local" });
config();

const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error(
    "Usage: npx tsx scripts/telegram-setup.ts <BOT_TOKEN>\n" +
      "  (or set TELEGRAM_BOT_TOKEN)\n\n" +
      "Get a token by messaging @BotFather on Telegram and sending /newbot."
  );
  process.exit(1);
}

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};

async function call<T>(method: string): Promise<TelegramResponse<T>> {
  try {
    const response = await fetch(api(method), { signal: AbortSignal.timeout(10_000) });
    return (await response.json()) as TelegramResponse<T>;
  } catch (error) {
    console.error(`\n✗ Couldn't reach Telegram: ${error}`);
    process.exit(1);
  }
}

function heading(text: string) {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

async function main() {
  // ── 1. Is the token real, and which bot is it? ───────────────────────────────
  heading("1. Checking the token");

  const me = await call<{ username: string; first_name: string }>("getMe");

  if (!me.ok) {
    console.error(`✗ Telegram rejected the token: ${me.description ?? "unknown error"}`);
    console.error("\n  Get a fresh one from @BotFather — /mybots, pick the bot, API Token.");
    process.exit(1);
  }

  const botUsername = me.result!.username;
  console.log(`✓ Token is valid. This is @${botUsername} ("${me.result!.first_name}").`);

  // ── 2. A webhook would swallow every update before getUpdates saw it ─────────
  heading("2. Checking for a webhook");

  const hook = await call<{ url: string }>("getWebhookInfo");

  if (hook.ok && hook.result?.url) {
    console.error(`✗ A webhook is set (${hook.result.url}), which consumes updates.`);
    console.error(`\n  Clear it, then re-run:  curl "${api("deleteWebhook")}"`);
    process.exit(1);
  }

  console.log("✓ No webhook — updates are available to read.");

  // ── 3. Has anyone actually messaged the bot? ─────────────────────────────────
  heading("3. Looking for your chat");

  type Update = {
    message?: {
      chat: { id: number; type: string; first_name?: string; username?: string; title?: string };
    };
  };

  const updates = await call<Update[]>("getUpdates");
  const chats = new Map<number, string>();

  for (const update of updates.result ?? []) {
    const chat = update.message?.chat;
    if (!chat) continue;
    const label = chat.title ?? [chat.first_name, chat.username && `@${chat.username}`].filter(Boolean).join(" ");
    chats.set(chat.id, `${label || "(no name)"} — ${chat.type}`);
  }

  if (chats.size === 0) {
    console.error("✗ No messages yet, so Telegram has no chat ID to give.\n");
    console.error("  This is almost always one of two things:\n");
    console.error(`  a) You haven't messaged the bot. Open Telegram, search for the`);
    console.error(`     EXACT username below, and send it anything:\n`);
    console.error(`         @${botUsername}\n`);
    console.error(`     Or open it directly:  https://t.me/${botUsername}\n`);
    console.error(`  b) You messaged a different bot. If @${botUsername} isn't the one`);
    console.error(`     you've been talking to, you're using the wrong token.\n`);
    console.error("  Then run this script again.");
    console.error("\n  (Note: updates expire after 24 hours, so an old message won't count.)");
    process.exit(1);
  }

  console.log(`✓ Found ${chats.size} chat${chats.size === 1 ? "" : "s"}:\n`);
  for (const [id, label] of chats) {
    console.log(`    TELEGRAM_CHAT_ID=${id}    ${label}`);
  }

  // ── 4. Prove the whole path works ────────────────────────────────────────────
  const chatId = process.env.TELEGRAM_CHAT_ID;

  heading("4. Sending a test message");

  if (!chatId) {
    console.log("· Skipped — TELEGRAM_CHAT_ID isn't set yet.");
    console.log("\nAdd both to frontend/.env.local and to Vercel, then re-run to send");
    console.log("a test message:");
    // The token is deliberately not echoed — it's a credential, and it came
    // from either the command line or the env file you already have open.
    console.log(`\n    TELEGRAM_BOT_TOKEN=<the token from @BotFather>`);
    console.log(`    TELEGRAM_CHAT_ID=${[...chats.keys()][0]}`);
    process.exit(0);
  }

  const sent = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ Availo is connected. Booking alerts will arrive here.",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const result = (await sent.json()) as TelegramResponse<unknown>;

  if (!result.ok) {
    console.error(`✗ Send failed: ${result.description ?? sent.status}`);
    if (result.error_code === 400) {
      console.error("\n  A 400 here usually means the chat ID is wrong — use one listed above.");
    }
    process.exit(1);
  }

  console.log("✓ Sent. Check Telegram — you should have it already.");
  console.log("\nBoth values are correct. Set them in Vercel and you're done.");

}

main();
