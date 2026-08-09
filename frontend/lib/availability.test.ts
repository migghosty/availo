/**
 * The availability engine's arithmetic: window expansion, the overlap rule that
 * makes one booking consume neighbouring start times, per-date overrides, split
 * shifts, past filtering, the booking horizon, and DST.
 *
 * Ported from the former `scripts/verify-availability.ts`.
 *
 * Pure functions over plain data — no database, no mocking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  availabilityForDate,
  computeAvailability,
  instantForDateMinute,
  isStartBookable,
  overridesByDate,
  windowsForDate,
  type AvailabilityConfig,
  type BookingLike,
  type ScheduleRuleLike,
} from "./availability";
import { BUSINESS_TIMEZONE } from "./timezone";

const HOUR = 60;

/** Seeded schedule: Mon/Wed/Fri 4–10 PM, Tue/Thu 7–10 PM. */
const rules: ScheduleRuleLike[] = [
  { dayOfWeek: 1, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 2, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 3, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 4, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 5, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
];

const config: AvailabilityConfig = {
  slotDurationMin: 30,
  slotIntervalMin: 15,
  bookingHorizonDays: 30,
};

const MONDAY = "2026-08-10";
const TUESDAY = "2026-08-11";
const NEXT_MONDAY = "2026-08-17";

/** Well before any test date, so nothing is filtered out as "past". */
const now = new Date("2026-01-01T00:00:00Z");

const noBookings: BookingLike[] = [];
const noOverrides = overridesByDate([]);

/** Renders an instant as the wall-clock time the client would actually see. */
function at(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Bookable times on a date, as wall-clock strings. */
const timesOn = (dateKey: string, bookings: BookingLike[] = noBookings) =>
  availabilityForDate(dateKey, rules, noOverrides, bookings, config, now).map(at);

describe("window expansion", () => {
  it("offers a start every slotIntervalMin across the day's window", () => {
    const starts = availabilityForDate(MONDAY, rules, noOverrides, noBookings, config, now);

    // 4:00 PM through 9:30 PM every 15 minutes.
    expect(starts).toHaveLength(23);
    expect(at(starts[0])).toBe("4:00 PM");
    expect(at(starts[starts.length - 1])).toBe("9:30 PM");
  });

  it("stops early enough that the whole appointment fits before closing", () => {
    const starts = timesOn(MONDAY);

    // Closing is 10:00 PM and appointments are 30 minutes, so 9:45 would run over.
    expect(starts).toContain("9:30 PM");
    expect(starts).not.toContain("9:45 PM");
  });

  it("uses each weekday's own hours", () => {
    const starts = availabilityForDate(TUESDAY, rules, noOverrides, noBookings, config, now);

    // Tuesday is the shorter 7–10 PM window.
    expect(starts).toHaveLength(11);
    expect(at(starts[0])).toBe("7:00 PM");
    expect(at(starts[starts.length - 1])).toBe("9:30 PM");
  });

  it("returns nothing for a weekday with no rule", () => {
    // Sunday — the seeded schedule has no rule for it.
    expect(availabilityForDate("2026-08-16", rules, noOverrides, noBookings, config, now)).toEqual([]);
  });
});

describe("the overlap rule", () => {
  // The single most important behaviour in the app, and the one a naive unique
  // index on Booking.startTime would miss entirely.
  const booked430: BookingLike[] = [
    { startTime: instantForDateMinute(MONDAY, 16 * HOUR + 30), durationMinutes: 30 },
  ];

  const remaining = () =>
    availabilityForDate(MONDAY, rules, noOverrides, booked430, config, now).map(at);

  it("consumes the booked start itself", () => {
    expect(remaining()).not.toContain("4:30 PM");
  });

  it("consumes a LATER start that would overlap", () => {
    // 4:45 + 30min runs to 5:15, into the 4:30–5:00 booking.
    expect(remaining()).not.toContain("4:45 PM");
  });

  it("consumes an EARLIER start that would run into the booking", () => {
    // The surprising one: 4:15 + 30min runs to 4:45, colliding with 4:30.
    expect(remaining()).not.toContain("4:15 PM");
  });

  it("keeps a start that ends exactly when the booking begins", () => {
    // 4:00 + 30min ends at 4:30. Touching is not overlapping.
    expect(remaining()).toContain("4:00 PM");
  });

  it("keeps the first start after the booking ends", () => {
    expect(remaining()).toContain("5:00 PM");
  });

  it("removes exactly three candidates for a 30-minute booking", () => {
    const before = availabilityForDate(MONDAY, rules, noOverrides, noBookings, config, now);
    const after = availabilityForDate(MONDAY, rules, noOverrides, booked430, config, now);

    expect(before.length - after.length).toBe(3);
  });

  it("removes proportionally more when appointments are longer", () => {
    // 60-minute appointments: 4:00, 4:15, 4:30 and 4:45 all collide.
    const longConfig = { ...config, slotDurationMin: 60 };
    const before = availabilityForDate(MONDAY, rules, noOverrides, noBookings, longConfig, now);
    const after = availabilityForDate(MONDAY, rules, noOverrides, booked430, longConfig, now);

    expect(before.length - after.length).toBe(4);
  });
});

describe("overrides", () => {
  it("yields nothing when the day is marked closed", () => {
    const closed = overridesByDate([{ date: MONDAY, isClosed: true, windows: [] }]);

    expect(availabilityForDate(MONDAY, rules, closed, noBookings, config, now)).toEqual([]);
  });

  it("replaces the weekday's rules rather than merging with them", () => {
    const overrides = overridesByDate([
      { date: MONDAY, isClosed: false, windows: [{ startMinute: 9 * HOUR, endMinute: 11 * HOUR }] },
    ]);
    const starts = availabilityForDate(MONDAY, rules, overrides, noBookings, config, now).map(at);

    expect(starts[0]).toBe("9:00 AM");
    expect(starts[starts.length - 1]).toBe("10:30 AM");
    // The regular 4–10 PM Monday hours are gone for this date, not added to.
    expect(starts).not.toContain("4:00 PM");
  });

  it("leaves other dates on the same weekday untouched", () => {
    const overrides = overridesByDate([
      { date: MONDAY, isClosed: true, windows: [] },
    ]);

    expect(
      availabilityForDate(NEXT_MONDAY, rules, overrides, noBookings, config, now)
    ).toHaveLength(23);
  });

  it("sorts override windows by start time", () => {
    const overrides = overridesByDate([
      {
        date: MONDAY,
        isClosed: false,
        windows: [
          { startMinute: 14 * HOUR, endMinute: 16 * HOUR },
          { startMinute: 9 * HOUR, endMinute: 11 * HOUR },
        ],
      },
    ]);

    expect(windowsForDate(MONDAY, rules, overrides)).toEqual([
      { startMinute: 9 * HOUR, endMinute: 11 * HOUR },
      { startMinute: 14 * HOUR, endMinute: 16 * HOUR },
    ]);
  });
});

describe("split shifts", () => {
  const split: ScheduleRuleLike[] = [
    { dayOfWeek: 1, startMinute: 9 * HOUR, endMinute: 11 * HOUR },
    { dayOfWeek: 1, startMinute: 14 * HOUR, endMinute: 16 * HOUR },
  ];

  it("offers starts in both windows and none in the gap", () => {
    const starts = availabilityForDate(MONDAY, split, noOverrides, noBookings, config, now).map(at);

    expect(starts).toHaveLength(14);
    expect(starts[0]).toBe("9:00 AM");
    expect(starts[starts.length - 1]).toBe("3:30 PM");
    expect(starts).not.toContain("12:00 PM");
  });

  it("does not double-count a start shared by two overlapping windows", () => {
    // candidateMinutes dedupes through a Set.
    const overlapping: ScheduleRuleLike[] = [
      { dayOfWeek: 1, startMinute: 9 * HOUR, endMinute: 11 * HOUR },
      { dayOfWeek: 1, startMinute: 9 * HOUR, endMinute: 10 * HOUR },
    ];
    const starts = availabilityForDate(MONDAY, overlapping, noOverrides, noBookings, config, now);

    expect(new Set(starts.map((s) => s.getTime())).size).toBe(starts.length);
  });
});

describe("past times", () => {
  it("drops starts at or before now", () => {
    const sixPM = instantForDateMinute(MONDAY, 18 * HOUR);
    const starts = availabilityForDate(MONDAY, rules, noOverrides, noBookings, config, sixPM);

    expect(starts.every((start) => start > sixPM)).toBe(true);
    // 6:00 PM itself is gone — the filter is strictly greater-than.
    expect(at(starts[0])).toBe("6:15 PM");
  });
});

describe("isStartBookable", () => {
  // Fixed "today" so horizon arithmetic is deterministic. 2026-08-09 is a
  // Sunday; 12:00Z is 05:00 in America/Los_Angeles, safely the same date.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const check = (start: Date, bookings: BookingLike[] = []) =>
    isStartBookable({ start, rules, overrides: [], bookings, config });

  it("accepts a start the schedule actually offers", () => {
    expect(check(instantForDateMinute(MONDAY, 16 * HOUR + 30))).toBe(true);
  });

  it("rejects a start that falls between offered times", () => {
    // 4:05 PM is not on the 15-minute grid.
    expect(check(instantForDateMinute(MONDAY, 16 * HOUR + 5))).toBe(false);
  });

  it("rejects a start outside the day's hours", () => {
    expect(check(instantForDateMinute(MONDAY, 11 * HOUR))).toBe(false);
  });

  it("rejects a start on a day with no rule", () => {
    expect(check(instantForDateMinute("2026-08-16", 16 * HOUR))).toBe(false);
  });

  it("rejects a start blocked by an overlapping booking", () => {
    const bookings: BookingLike[] = [
      { startTime: instantForDateMinute(MONDAY, 16 * HOUR + 30), durationMinutes: 30 },
    ];

    expect(check(instantForDateMinute(MONDAY, 16 * HOUR + 15), bookings)).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(check(new Date("nonsense"))).toBe(false);
  });

  it("accepts the last day inside the booking horizon", () => {
    // today + 30 days = 2026-09-08, a Tuesday (7–10 PM).
    expect(check(instantForDateMinute("2026-09-08", 19 * HOUR))).toBe(true);
  });

  it("rejects the first day beyond the booking horizon", () => {
    // today + 31 days = 2026-09-09, a Wednesday with 4–10 PM hours it would
    // otherwise qualify for. The horizon is what excludes it.
    expect(check(instantForDateMinute("2026-09-09", 16 * HOUR))).toBe(false);
  });
});

describe("computeAvailability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("omits days with nothing available", () => {
    const days = computeAvailability({ rules, overrides: [], bookings: [], config });
    const dateKeys = days.map((day) => day.dateKey);

    // Sunday 2026-08-09 (today) and 2026-08-16 have no rules.
    expect(dateKeys).not.toContain("2026-08-09");
    expect(dateKeys).not.toContain("2026-08-16");
    expect(dateKeys).toContain(MONDAY);
  });

  it("returns days in chronological order", () => {
    const days = computeAvailability({ rules, overrides: [], bookings: [], config });

    expect([...days].map((d) => d.dateKey).sort()).toEqual(days.map((d) => d.dateKey));
  });

  it("spans today through the horizon inclusive", () => {
    const days = computeAvailability({ rules, overrides: [], bookings: [], config });

    expect(days[days.length - 1].dateKey <= "2026-09-08").toBe(true);
  });
});

describe("daylight saving time", () => {
  // lib/schedule.ts claims minutes-from-midnight "describe wall clock intent …
  // and only get resolved to real instants against a specific calendar date,
  // which is where DST is handled". These pin that claim.
  it("resolves the same wall time to different instants either side of spring forward", () => {
    // PST (UTC-8) on 2026-03-07; PDT (UTC-7) from 2026-03-08.
    expect(instantForDateMinute("2026-03-07", 16 * HOUR).toISOString()).toBe(
      "2026-03-08T00:00:00.000Z"
    );
    expect(instantForDateMinute("2026-03-09", 16 * HOUR).toISOString()).toBe(
      "2026-03-09T23:00:00.000Z"
    );
  });

  it("resolves the same wall time to different instants either side of fall back", () => {
    // PDT (UTC-7) on 2026-10-31; PST (UTC-8) from 2026-11-01.
    expect(instantForDateMinute("2026-10-31", 16 * HOUR).toISOString()).toBe(
      "2026-10-31T23:00:00.000Z"
    );
    expect(instantForDateMinute("2026-11-01", 16 * HOUR).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z"
    );
  });

  it("keeps a 4-10 PM window six hours long across a DST boundary", () => {
    // The count must not change just because the clocks moved: these are wall
    // clock hours, not a fixed span of elapsed time.
    const springForward = availabilityForDate("2026-03-09", rules, noOverrides, noBookings, config, now);
    const ordinary = availabilityForDate(MONDAY, rules, noOverrides, noBookings, config, now);

    expect(springForward).toHaveLength(ordinary.length);
  });

  it("maps a non-existent wall time onto a real instant", () => {
    // 2:30 AM does not occur on 2026-03-08 — the clocks jump 2:00 → 3:00.
    // Documenting current behaviour: it lands on 3:30 AM PDT rather than
    // throwing or producing an invalid date.
    const resolved = instantForDateMinute("2026-03-08", 2 * HOUR + 30);

    expect(Number.isNaN(resolved.getTime())).toBe(false);
    expect(resolved.toISOString()).toBe("2026-03-08T10:30:00.000Z");
  });

  it("picks the first occurrence of an ambiguous wall time", () => {
    // 1:30 AM happens twice on 2026-11-01. Current behaviour takes the earlier
    // (still PDT) one.
    expect(instantForDateMinute("2026-11-01", 1 * HOUR + 30).toISOString()).toBe(
      "2026-11-01T08:30:00.000Z"
    );
  });
});
