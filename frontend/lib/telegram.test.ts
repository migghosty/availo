/**
 * The Telegram transport's failure behaviour.
 *
 * Same properties as `sms.test.ts`, because the same rules apply: a booking
 * that has committed is a real appointment, so nothing here may throw into the
 * caller, and an unconfigured environment must make no request at all. That
 * second property is what lets local development and the whole integration
 * suite run with no bot token and no mocking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isTelegramConfigured, sendTelegram } from "./telegram";

const CONFIG = {
  TELEGRAM_BOT_TOKEN: "8123456789:AAHtesttoken",
  TELEGRAM_CHAT_ID: "123456789",
};

function configure(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  // Quiet: these paths log deliberately, and the logs aren't what's under test.
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  configure({ TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_CHAT_ID: undefined });
  vi.restoreAllMocks();
});

describe("when unconfigured", () => {
  it("reports itself as not configured", () => {
    expect(isTelegramConfigured()).toBe(false);
  });

  it("makes no request at all", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a half-set configuration as unconfigured", async () => {
    // A token with no chat ID would 400 on every booking; better to behave
    // exactly as if nothing were set.
    configure({ ...CONFIG, TELEGRAM_CHAT_ID: undefined });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(isTelegramConfigured()).toBe(false);
    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("when configured", () => {
  beforeEach(() => configure(CONFIG));

  it("posts the alert to the bot's sendMessage endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    expect(await sendTelegram("a new booking")).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`
    );
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe(CONFIG.TELEGRAM_CHAT_ID);
    expect(body.text).toBe("a new booking");
  });

  it("sends without a parse_mode", async () => {
    // The whole reason alerts are plain text: MarkdownV2 and HTML need
    // escaping, and every value in an alert is user-controlled. A client called
    // "O'Neil & Sons <test>" would corrupt the message or fail the send.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    await sendTelegram("O'Neil & Sons <test> *not bold* _not italic_");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.parse_mode).toBeUndefined();
    expect(body.text).toBe("O'Neil & Sons <test> *not bold* _not italic_");
  });

  it("returns false on a network error rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    await expect(sendTelegram("hello")).resolves.toBe(false);
  });

  it("returns false rather than throwing when the request times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" })
    );

    await expect(sendTelegram("hello")).resolves.toBe(false);
  });
});

describe("retrying", () => {
  beforeEach(() => configure(CONFIG));

  it("recovers from a transient reset on the next attempt", async () => {
    // The exact failure observed in testing: one ECONNRESET lost a real
    // booking alert, and the following send succeeded untouched.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("read ECONNRESET"))
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    expect(await sendTelegram("a new booking")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of attempts", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("read ECONNRESET"));

    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("retries a 5xx, which is Telegram's problem and may pass", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream error", { status: 502 }))
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    expect(await sendTelegram("hello")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a bad chat ID", async () => {
    // A 400 fails identically every time; retrying only delays the booking
    // response for a result that cannot change.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('{"ok":false,"description":"chat not found"}', { status: 400 })
      );

    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry a bad token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('{"ok":false,"description":"Unauthorized"}', { status: 401 })
      );

    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("gives up rather than waiting out a long rate-limit backoff", async () => {
    // Telegram asks for 60s; the booking response can't wait that long, so the
    // total budget wins and the alert is dropped.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '{"ok":false,"error_code":429,"description":"Too Many Requests: retry after 60",' +
          '"parameters":{"retry_after":60}}',
        { status: 429 }
      )
    );

    expect(await sendTelegram("hello")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
