/**
 * Wall-clock ↔ UTC conversion.
 *
 * The app stores opening hours as minutes from midnight and resolves them
 * against a specific calendar date, so every one of these functions sits
 * between what the admin typed and what instant a client actually books. A
 * silent one-hour error here moves real appointments.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUSINESS_TIMEZONE,
  addDaysToDateKey,
  dateKeyInTimezone,
  todayInTimezone,
  zonedWallTimeToUtc,
} from "./timezone";

describe("zonedWallTimeToUtc", () => {
  it("interprets a naive wall time in the business timezone", () => {
    // 4 PM PDT (UTC-7) is 23:00 UTC the same day.
    expect(zonedWallTimeToUtc("2026-08-10T16:00:00").toISOString()).toBe(
      "2026-08-10T23:00:00.000Z"
    );
  });

  it("rolls into the next UTC day for late evening local times", () => {
    expect(zonedWallTimeToUtc("2026-08-10T22:00:00").toISOString()).toBe(
      "2026-08-11T05:00:00.000Z"
    );
  });

  it("applies the standard-time offset in winter", () => {
    // 4 PM PST (UTC-8) is midnight UTC the next day.
    expect(zonedWallTimeToUtc("2026-01-15T16:00:00").toISOString()).toBe(
      "2026-01-16T00:00:00.000Z"
    );
  });

  it("uses the offset in force on that date, not a fixed one", () => {
    // The whole point: same wall time, different UTC instants, because DST
    // begins on 2026-03-08 in America/Los_Angeles.
    const before = zonedWallTimeToUtc("2026-03-07T12:00:00");
    const after = zonedWallTimeToUtc("2026-03-09T12:00:00");

    expect(before.toISOString()).toBe("2026-03-07T20:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-09T19:00:00.000Z");
  });

  it("honours an explicitly passed timezone", () => {
    expect(zonedWallTimeToUtc("2026-08-10T16:00:00", "UTC").toISOString()).toBe(
      "2026-08-10T16:00:00.000Z"
    );
  });

  it("accepts an input that already carries a Z suffix", () => {
    expect(zonedWallTimeToUtc("2026-08-10T16:00:00Z", "UTC").toISOString()).toBe(
      "2026-08-10T16:00:00.000Z"
    );
  });
});

describe("dateKeyInTimezone", () => {
  it("uses the business timezone rather than the runtime's", () => {
    // 05:00 UTC is still the previous evening in Los Angeles. Tests run in
    // whatever zone CI happens to use, so this must not depend on it.
    expect(dateKeyInTimezone(new Date("2026-08-10T05:00:00Z"))).toBe("2026-08-09");
  });

  it("rolls to the next date at local midnight", () => {
    expect(dateKeyInTimezone(new Date("2026-08-10T07:00:00Z"))).toBe("2026-08-10");
  });

  it("honours an explicitly passed timezone", () => {
    expect(dateKeyInTimezone(new Date("2026-08-10T05:00:00Z"), "UTC")).toBe("2026-08-10");
  });

  it("round-trips with zonedWallTimeToUtc", () => {
    const instant = zonedWallTimeToUtc("2026-08-10T16:00:00");

    expect(dateKeyInTimezone(instant)).toBe("2026-08-10");
  });
});

describe("todayInTimezone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the business-timezone date, not the UTC one", () => {
    vi.useFakeTimers();
    // 03:00 UTC on the 10th is 20:00 on the 9th in Los Angeles.
    vi.setSystemTime(new Date("2026-08-10T03:00:00Z"));

    expect(todayInTimezone()).toBe("2026-08-09");
  });
});

describe("addDaysToDateKey", () => {
  it("adds days within a month", () => {
    expect(addDaysToDateKey("2026-08-10", 5)).toBe("2026-08-15");
  });

  it("crosses month and year boundaries", () => {
    expect(addDaysToDateKey("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap days", () => {
    expect(addDaysToDateKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDateKey("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("subtracts with a negative offset", () => {
    expect(addDaysToDateKey("2026-09-02", -3)).toBe("2026-08-30");
  });

  it("returns the same date for zero", () => {
    expect(addDaysToDateKey("2026-08-10", 0)).toBe("2026-08-10");
  });

  it("is unaffected by DST transitions", () => {
    // Calendar arithmetic, not elapsed-time arithmetic: the day the clocks
    // change is still one day long.
    expect(addDaysToDateKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("BUSINESS_TIMEZONE", () => {
  it("is a timezone the runtime's Intl data actually knows", () => {
    expect(() =>
      new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIMEZONE }).format(new Date())
    ).not.toThrow();
  });
});
