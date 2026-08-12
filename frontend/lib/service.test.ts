/**
 * Service input parsing.
 *
 * Both of these guard values that reach the database from an admin form, and
 * `parseDurationMinutes` guards one that also decides which start times exist —
 * a service with a nonsense length would corrupt every calendar it appears on.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  formatDuration,
  formatPrice,
  parseDurationMinutes,
  parsePriceCents,
} from "./service";

describe("parsePriceCents", () => {
  it("converts dollars to cents", () => {
    expect(parsePriceCents(25)).toBe(2500);
    expect(parsePriceCents("12.50")).toBe(1250);
  });

  it("rounds rather than truncating, so 0.1 + 0.2 style drift can't accumulate", () => {
    expect(parsePriceCents(19.999)).toBe(2000);
  });

  it("accepts free", () => {
    expect(parsePriceCents(0)).toBe(0);
  });

  it("rejects negatives and non-numbers", () => {
    expect(parsePriceCents(-1)).toBeNull();
    expect(parsePriceCents("free")).toBeNull();
    expect(parsePriceCents(undefined)).toBeNull();
    expect(parsePriceCents(Infinity)).toBeNull();
  });
});

describe("parseDurationMinutes", () => {
  it("accepts whole minutes inside the bounds", () => {
    expect(parseDurationMinutes(15)).toBe(15);
    expect(parseDurationMinutes("60")).toBe(60);
    expect(parseDurationMinutes(MIN_DURATION_MINUTES)).toBe(MIN_DURATION_MINUTES);
    expect(parseDurationMinutes(MAX_DURATION_MINUTES)).toBe(MAX_DURATION_MINUTES);
  });

  it("rejects values outside the bounds", () => {
    expect(parseDurationMinutes(MIN_DURATION_MINUTES - 1)).toBeNull();
    expect(parseDurationMinutes(MAX_DURATION_MINUTES + 1)).toBeNull();
  });

  it("rejects zero, negatives and fractions", () => {
    // A fractional length would put candidate starts off the minute grid.
    expect(parseDurationMinutes(0)).toBeNull();
    expect(parseDurationMinutes(-30)).toBeNull();
    expect(parseDurationMinutes(22.5)).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseDurationMinutes("half an hour")).toBeNull();
    expect(parseDurationMinutes(undefined)).toBeNull();
    expect(parseDurationMinutes(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("drops trailing zero cents but keeps real ones", () => {
    expect(formatPrice(2500)).toBe("$25");
    expect(formatPrice(1250)).toBe("$12.50");
    expect(formatPrice(0)).toBe("$0");
  });

  it("labels durations in minutes", () => {
    expect(formatDuration(15)).toBe("15 min");
  });
});
