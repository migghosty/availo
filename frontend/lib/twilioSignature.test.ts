/**
 * Twilio request-signature validation.
 *
 * `/api/sms/inbound` is the only unauthenticated write endpoint in the app, so
 * this check *is* its security. Without it anyone could POST opt-outs for
 * arbitrary numbers and silently stop other people's appointment texts.
 *
 * The expected signature below is not copied from the implementation — it is
 * computed independently in the test from Twilio's published algorithm, so a
 * bug in the implementation cannot agree with a matching bug here.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { expectedSignature, isValidTwilioSignature } from "./twilioSignature";

const TOKEN = "12345678901234567890123456789012";
const URL_ = "https://availo.example.com/api/sms/inbound";

const PARAMS = {
  From: "+16191234567",
  To: "+15550000000",
  Body: "STOP",
  MessageSid: "SM11111111111111111111111111111111",
};

/** Twilio's algorithm, written out longhand rather than reusing the module. */
function signIndependently(
  token: string,
  url: string,
  params: Record<string, string>
): string {
  let payload = url;
  for (const key of Object.keys(params).sort()) {
    payload += key + params[key];
  }
  return createHmac("sha1", token).update(payload, "utf8").digest("base64");
}

describe("expectedSignature", () => {
  it("matches an independently computed signature", () => {
    expect(expectedSignature(TOKEN, URL_, PARAMS)).toBe(
      signIndependently(TOKEN, URL_, PARAMS)
    );
  });

  it("sorts parameters by key, not by insertion order", () => {
    // Twilio sorts; a Map/object iteration order that happened to match would
    // pass by luck and fail on the next request.
    const reordered = {
      To: PARAMS.To,
      MessageSid: PARAMS.MessageSid,
      Body: PARAMS.Body,
      From: PARAMS.From,
    };

    expect(expectedSignature(TOKEN, URL_, reordered)).toBe(
      expectedSignature(TOKEN, URL_, PARAMS)
    );
  });

  it("depends on the URL, so a signature can't be replayed at another route", () => {
    expect(expectedSignature(TOKEN, `${URL_}/other`, PARAMS)).not.toBe(
      expectedSignature(TOKEN, URL_, PARAMS)
    );
  });
});

describe("isValidTwilioSignature", () => {
  const valid = () => signIndependently(TOKEN, URL_, PARAMS);

  it("accepts a genuine request", () => {
    expect(
      isValidTwilioSignature({
        authToken: TOKEN,
        url: URL_,
        params: PARAMS,
        signature: valid(),
      })
    ).toBe(true);
  });

  it("rejects a tampered parameter", () => {
    // The attack this exists to stop: same signature, someone else's number.
    expect(
      isValidTwilioSignature({
        authToken: TOKEN,
        url: URL_,
        params: { ...PARAMS, From: "+16195550199" },
        signature: valid(),
      })
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(
      isValidTwilioSignature({
        authToken: TOKEN,
        url: URL_,
        params: { ...PARAMS, Body: "START" },
        signature: valid(),
      })
    ).toBe(false);
  });

  it("rejects a signature made with a different token", () => {
    expect(
      isValidTwilioSignature({
        authToken: TOKEN,
        url: URL_,
        params: PARAMS,
        signature: signIndependently("a".repeat(32), URL_, PARAMS),
      })
    ).toBe(false);
  });

  it("rejects when no token is configured", () => {
    // The opposite of sendSms's fail-open rule: an unconfigured deployment must
    // refuse writes, not accept unsigned ones.
    expect(
      isValidTwilioSignature({
        authToken: undefined,
        url: URL_,
        params: PARAMS,
        signature: valid(),
      })
    ).toBe(false);

    expect(
      isValidTwilioSignature({
        authToken: "",
        url: URL_,
        params: PARAMS,
        signature: valid(),
      })
    ).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    for (const signature of [null, "", "not-base64-of-the-right-length", "!!!"]) {
      expect(
        isValidTwilioSignature({
          authToken: TOKEN,
          url: URL_,
          params: PARAMS,
          signature,
        })
      ).toBe(false);
    }
  });
});
