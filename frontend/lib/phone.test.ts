/**
 * Phone normalization.
 *
 * The requirement this file exists for: a client may write their number any
 * way they like, and every spelling has to reach the same booking. That is a
 * statement about *sameness*, so the central case below asserts a set of
 * spellings collapsing to one value rather than checking each in isolation.
 */

import { describe, expect, it } from "vitest";

import { formatPhone, formatPhoneInput, normalizePhone } from "./phone";

const CANONICAL = "+16191234567";

describe("normalizePhone", () => {
  it("collapses every spelling of one number to a single stored value", () => {
    const spellings = [
      "(619) 123-4567",
      "6191234567",
      "619-123-4567",
      "619.123.4567",
      "619 123 4567",
      "+1 (619) 123-4567",
      "1-619-123-4567",
      "1 (619) 123 4567",
      "+16191234567",
      "16191234567",
      "  (619) 123-4567  ",
    ];

    // One entry in the set means every spelling agreed. A per-spelling loop
    // would pass just as well, but this is the property that actually matters.
    const stored = new Set(spellings.map((s) => normalizePhone(s)));
    expect(stored).toEqual(new Set([CANONICAL]));
  });

  it("accepts a number typed with stray punctuation", () => {
    expect(normalizePhone("(619)123-4567")).toBe(CANONICAL);
    expect(normalizePhone("619/123/4567")).toBe(CANONICAL);
  });

  it("rejects numbers that are too short or too long", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("619-123-456")).toBeNull(); // 9 digits
    expect(normalizePhone("619-123-45678")).toBeNull(); // 11, not country-coded
  });

  it("rejects a non-NANP international number rather than mangling it", () => {
    // The failure mode worth preventing: silently clipping this to ten digits
    // would store a different, real US number.
    expect(normalizePhone("+44 20 7946 0958")).toBeNull();
    expect(normalizePhone("+52 55 1234 5678")).toBeNull();
    expect(normalizePhone("+33 1 42 68 53 00")).toBeNull();
  });

  it("rejects an explicit + that isn't +1", () => {
    // With a +, the caller is declaring a country code — believe them.
    expect(normalizePhone("+2 619 123 4567")).toBeNull();
  });

  it("rejects an area code that can't start a real number", () => {
    // No NANP area code begins 0 or 1, so this is a cheap catch for a
    // leading-digit slip.
    expect(normalizePhone("(019) 123-4567")).toBeNull();
    expect(normalizePhone("(119) 123-4567")).toBeNull();
    expect(normalizePhone("(619) 123-4567")).toBe(CANONICAL); // control
  });

  it("does not enforce the exchange-code rule", () => {
    // Strict NANP forbids an exchange starting 0 or 1, which would reject
    // (619) 123-4567 — the number everyone tests with. Rejecting a real
    // client's booking is a far worse failure than accepting a number that
    // won't connect, so this stays permissive on purpose.
    expect(normalizePhone("(619) 023-4567")).toBe("+16190234567");
  });

  it("rejects letters, empty and non-string junk", () => {
    expect(normalizePhone("nope")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone({})).toBeNull();
  });

  it("is idempotent", () => {
    expect(normalizePhone(CANONICAL)).toBe(CANONICAL);
    expect(normalizePhone(normalizePhone("619.123.4567"))).toBe(CANONICAL);
  });

  it("round-trips through the display format", () => {
    // A client who re-submits the value the form showed them must not be
    // rejected — this is the path that closes the loop between the two.
    expect(normalizePhone(formatPhone(CANONICAL))).toBe(CANONICAL);
  });
});

describe("formatPhone", () => {
  it("renders the stored form as a phone number", () => {
    expect(formatPhone(CANONICAL)).toBe("(619) 123-4567");
  });

  it("handles a bare ten-digit value", () => {
    expect(formatPhone("6191234567")).toBe("(619) 123-4567");
  });

  it("returns anything unreadable untouched rather than blank", () => {
    // Better to show a client something odd than an empty row where their
    // number belongs.
    expect(formatPhone("")).toBe("");
    expect(formatPhone("not a number")).toBe("not a number");
  });
});

describe("formatPhoneInput", () => {
  it("formats progressively as digits arrive", () => {
    expect(formatPhoneInput("6")).toBe("6");
    expect(formatPhoneInput("61")).toBe("61");
    expect(formatPhoneInput("619")).toBe("619");
    expect(formatPhoneInput("6191")).toBe("(619) 1");
    expect(formatPhoneInput("619123")).toBe("(619) 123");
    expect(formatPhoneInput("6191234")).toBe("(619) 123-4");
    expect(formatPhoneInput("6191234567")).toBe("(619) 123-4567");
  });

  it("re-derives from digits, so backspacing walks back cleanly", () => {
    // Deleting the trailing "7" of "(619) 123-4567" leaves this, and it must
    // not immediately re-add anything the user just removed.
    expect(formatPhoneInput("(619) 123-456")).toBe("(619) 123-456");
    expect(formatPhoneInput("(619) ")).toBe("619");
    expect(formatPhoneInput("(61")).toBe("61");
  });

  it("drops a leading country code once there's a digit behind it", () => {
    expect(formatPhoneInput("1")).toBe("1");
    expect(formatPhoneInput("16")).toBe("6");
    expect(formatPhoneInput("+1 (619) 123-4567")).toBe("(619) 123-4567");
    expect(formatPhoneInput("16191234567")).toBe("(619) 123-4567");
  });

  it("never renders more than a full number", () => {
    expect(formatPhoneInput("6191234567").replace(/\D/g, "")).toHaveLength(10);
  });

  it("leaves an over-long international paste exactly as typed", () => {
    // Truncating would turn this into a valid-looking US number.
    expect(formatPhoneInput("+52 55 1234 5678")).toBe("+52 55 1234 5678");
    expect(formatPhoneInput("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("handles empty input", () => {
    expect(formatPhoneInput("")).toBe("");
  });
});
