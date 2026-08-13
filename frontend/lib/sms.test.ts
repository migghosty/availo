/**
 * The SMS transport's failure behaviour.
 *
 * This is the safety property the whole notification feature rests on: a
 * booking that has committed is a real appointment, so nothing here may ever
 * throw into the caller. Every case below is a way the outside world can break
 * — no credentials, a rejected request, a network error, a hang — and in all of
 * them `sendSms` must return false and stay quiet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isSmsConfigured, sendSms } from "./sms";

const CONFIG = {
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "token",
  TWILIO_FROM_NUMBER: "+15550000000",
};

const TO = "+16191234567";

function configure(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  // Quiet: these paths log deliberately, and the logs aren't what's under test.
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  configure({
    TWILIO_ACCOUNT_SID: undefined,
    TWILIO_AUTH_TOKEN: undefined,
    TWILIO_FROM_NUMBER: undefined,
  });
  vi.restoreAllMocks();
});

describe("when unconfigured", () => {
  it("reports itself as not configured", () => {
    expect(isSmsConfigured()).toBe(false);
  });

  it("makes no request at all", async () => {
    // This is what lets local dev and the entire integration suite run with no
    // credentials and no mocking.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await sendSms(TO, "hello")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a partial configuration as unconfigured", async () => {
    // Half-set credentials would produce 401s on every booking; better to
    // behave exactly as if nothing were set.
    configure({ ...CONFIG, TWILIO_AUTH_TOKEN: undefined });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(isSmsConfigured()).toBe(false);
    expect(await sendSms(TO, "hello")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("when configured", () => {
  beforeEach(() => configure(CONFIG));

  it("posts the message to Twilio and reports success", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }));

    expect(await sendSms(TO, "hello")).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    expect(init.method).toBe("POST");

    const body = init.body as URLSearchParams;
    expect(body.get("To")).toBe(TO);
    expect(body.get("From")).toBe(CONFIG.TWILIO_FROM_NUMBER);
    expect(body.get("Body")).toBe("hello");
  });

  it("authenticates with basic auth", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }));

    await sendSms(TO, "hello");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const header = (init.headers as Record<string, string>).Authorization;
    expect(header).toBe(
      "Basic " + Buffer.from("ACtest:token").toString("base64")
    );
  });

  it("returns false on a rejected request rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"code":21608,"message":"unverified number"}', { status: 400 })
    );

    await expect(sendSms(TO, "hello")).resolves.toBe(false);
  });

  it("returns false on a network error rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));

    await expect(sendSms(TO, "hello")).resolves.toBe(false);
  });

  it("returns false rather than throwing when the request times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" })
    );

    await expect(sendSms(TO, "hello")).resolves.toBe(false);
  });

  it("refuses an empty recipient without calling out", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(await sendSms("", "hello")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
