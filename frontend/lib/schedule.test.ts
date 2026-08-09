/**
 * Parsing, formatting and validation for the weekly schedule vocabulary.
 *
 * normalizeWindows is the one that guards real data: it is what stops the admin
 * from saving a day whose hours run backwards or double-book themselves.
 */

import { describe, expect, it } from "vitest";

import {
  DAY_ABBREVIATIONS,
  DAY_NAMES,
  MINUTES_IN_DAY,
  WEEK_ORDER,
  formatMinutes,
  formatWindow,
  minutesToTimeInput,
  normalizeWindows,
  timeInputToMinutes,
  weekdayOfDateKey,
} from "./schedule";

describe("timeInputToMinutes", () => {
  it("parses a HH:MM time into minutes from midnight", () => {
    expect(timeInputToMinutes("16:30")).toBe(990);
    expect(timeInputToMinutes("00:00")).toBe(0);
    expect(timeInputToMinutes("23:59")).toBe(1439);
  });

  it("accepts a single-digit hour", () => {
    expect(timeInputToMinutes("9:05")).toBe(545);
  });

  it("ignores surrounding whitespace", () => {
    expect(timeInputToMinutes("  16:30  ")).toBe(990);
  });

  it("returns null rather than throwing on malformed input", () => {
    for (const bad of ["", "abc", "1630", "16:3", "16-30", ":30", "16:"]) {
      expect(timeInputToMinutes(bad)).toBeNull();
    }
  });

  it("returns null for out-of-range values", () => {
    expect(timeInputToMinutes("24:00")).toBeNull();
    expect(timeInputToMinutes("16:60")).toBeNull();
  });
});

describe("minutesToTimeInput", () => {
  it("renders the zero-padded HH:MM an <input type=\"time\"> expects", () => {
    expect(minutesToTimeInput(990)).toBe("16:30");
    expect(minutesToTimeInput(0)).toBe("00:00");
    expect(minutesToTimeInput(545)).toBe("09:05");
  });

  it("round-trips with timeInputToMinutes", () => {
    for (let minute = 0; minute < MINUTES_IN_DAY; minute += 7) {
      expect(timeInputToMinutes(minutesToTimeInput(minute))).toBe(minute);
    }
  });
});

describe("formatMinutes", () => {
  it("renders 12-hour times for display", () => {
    expect(formatMinutes(990)).toBe("4:30 PM");
    expect(formatMinutes(545)).toBe("9:05 AM");
  });

  it("renders both midnights as 12, not 0", () => {
    expect(formatMinutes(0)).toBe("12:00 AM");
    expect(formatMinutes(12 * 60)).toBe("12:00 PM");
  });

  it("formats a window as a range", () => {
    expect(formatWindow({ startMinute: 16 * 60, endMinute: 22 * 60 })).toBe(
      "4:00 PM – 10:00 PM"
    );
  });
});

describe("weekdayOfDateKey", () => {
  it("maps a date key to its weekday, 0 = Sunday", () => {
    expect(weekdayOfDateKey("2026-08-09")).toBe(0);
    expect(weekdayOfDateKey("2026-08-10")).toBe(1);
    expect(weekdayOfDateKey("2026-08-15")).toBe(6);
  });

  it("agrees with the day name tables", () => {
    expect(DAY_NAMES[weekdayOfDateKey("2026-08-10")]).toBe("Monday");
    expect(DAY_ABBREVIATIONS[weekdayOfDateKey("2026-08-10")]).toBe("Mon");
  });

  it("orders the admin week Monday-first while storage stays Sunday-indexed", () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(DAY_NAMES[WEEK_ORDER[0]]).toBe("Monday");
    expect(DAY_NAMES[WEEK_ORDER[6]]).toBe("Sunday");
  });
});

describe("normalizeWindows", () => {
  const ok = (windows: Parameters<typeof normalizeWindows>[0]) => {
    const result = normalizeWindows(windows);
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
    return result.windows;
  };

  const err = (windows: Parameters<typeof normalizeWindows>[0]) => {
    const result = normalizeWindows(windows);
    if (result.ok) throw new Error("expected an error, got ok");
    return result.error;
  };

  it("accepts an empty day", () => {
    expect(ok([])).toEqual([]);
  });

  it("sorts windows by start time", () => {
    expect(
      ok([
        { startMinute: 14 * 60, endMinute: 16 * 60 },
        { startMinute: 9 * 60, endMinute: 11 * 60 },
      ])
    ).toEqual([
      { startMinute: 9 * 60, endMinute: 11 * 60 },
      { startMinute: 14 * 60, endMinute: 16 * 60 },
    ]);
  });

  it("allows one window to start exactly when another ends", () => {
    // Touching is not overlapping — a split shift can be back-to-back.
    expect(
      ok([
        { startMinute: 9 * 60, endMinute: 12 * 60 },
        { startMinute: 12 * 60, endMinute: 15 * 60 },
      ])
    ).toHaveLength(2);
  });

  it("rejects a window that ends before it starts", () => {
    expect(err([{ startMinute: 16 * 60, endMinute: 9 * 60 }])).toBe(
      "Each end time must come after its start time."
    );
  });

  it("rejects a zero-length window", () => {
    expect(err([{ startMinute: 9 * 60, endMinute: 9 * 60 }])).toBe(
      "Each end time must come after its start time."
    );
  });

  it("rejects overlapping windows regardless of input order", () => {
    const message = "Time ranges on the same day can't overlap.";

    expect(
      err([
        { startMinute: 9 * 60, endMinute: 13 * 60 },
        { startMinute: 12 * 60, endMinute: 15 * 60 },
      ])
    ).toBe(message);

    expect(
      err([
        { startMinute: 12 * 60, endMinute: 15 * 60 },
        { startMinute: 9 * 60, endMinute: 13 * 60 },
      ])
    ).toBe(message);
  });

  it("rejects times outside a single day", () => {
    const message = "Times must fall within a single day.";

    expect(err([{ startMinute: -1, endMinute: 60 }])).toBe(message);
    expect(err([{ startMinute: 0, endMinute: MINUTES_IN_DAY + 1 }])).toBe(message);
  });

  it("allows a window ending exactly at midnight", () => {
    expect(ok([{ startMinute: 22 * 60, endMinute: MINUTES_IN_DAY }])).toHaveLength(1);
  });

  it("rejects non-integer minutes", () => {
    expect(err([{ startMinute: 9.5, endMinute: 11 * 60 }])).toBe(
      "Times must fall within a single day."
    );
  });

  it("does not mutate its input", () => {
    const windows = [
      { startMinute: 14 * 60, endMinute: 16 * 60 },
      { startMinute: 9 * 60, endMinute: 11 * 60 },
    ];
    const snapshot = structuredClone(windows);

    normalizeWindows(windows);

    expect(windows).toEqual(snapshot);
  });
});
