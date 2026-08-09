/**
 * Shared vocabulary for the weekly schedule: a "window" is an open stretch of a
 * day, stored as minutes from midnight in BUSINESS_TIMEZONE (e.g. 4 PM = 960).
 * Minutes-from-midnight keeps windows timezone-agnostic — they describe wall
 * clock intent ("I work 4pm to 10pm"), and only get resolved to real instants
 * against a specific calendar date, which is where DST is handled.
 */

export type TimeWindow = { startMinute: number; endMinute: number };

export const MINUTES_IN_DAY = 24 * 60;

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getUTCDay()`. */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Weekday order for the admin UI. Business schedules read more naturally
 * starting on Monday, while storage stays 0-indexed from Sunday.
 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "16:30" → 990. Returns null when the input isn't a valid HH:MM time. */
export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** 990 → "16:30", the format `<input type="time">` expects. */
export function minutesToTimeInput(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** 990 → "4:30 PM", for display. */
export function formatMinutes(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "4:00 PM – 10:00 PM" */
export function formatWindow(window: TimeWindow): string {
  return `${formatMinutes(window.startMinute)} – ${formatMinutes(window.endMinute)}`;
}

/** The weekday a YYYY-MM-DD calendar date falls on (0 = Sunday). */
export function weekdayOfDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/*
 * Month keys ("YYYY-MM") drive the booking calendar grid. Like date keys they
 * describe a calendar position rather than an instant, so all the arithmetic
 * goes through Date.UTC and never touches the runtime's local timezone.
 */

/** "2026-08-12" → "2026-08" */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** "2026-08" → "2026-08-01" */
export function firstDateKeyOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

/** "2026-08" → 31. Day 0 of the *next* month is the last day of this one. */
export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-12" + 1 → "2027-01" */
export function addMonthsToMonthKey(monthKey: string, months: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7);
}

/** "2026-08" → "August 2026" */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Validates and normalizes a set of windows for a single day: each must be a
 * well-formed, non-empty range within the day, and none may overlap another.
 * Returns sorted windows, or an error message describing the first problem.
 */
export function normalizeWindows(
  windows: TimeWindow[]
): { ok: true; windows: TimeWindow[] } | { ok: false; error: string } {
  for (const window of windows) {
    if (
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      window.startMinute < 0 ||
      window.endMinute > MINUTES_IN_DAY
    ) {
      return { ok: false, error: "Times must fall within a single day." };
    }
    if (window.endMinute <= window.startMinute) {
      return { ok: false, error: "Each end time must come after its start time." };
    }
  }

  const sorted = [...windows].sort((a, b) => a.startMinute - b.startMinute);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinute < sorted[i - 1].endMinute) {
      return { ok: false, error: "Time ranges on the same day can't overlap." };
    }
  }

  return { ok: true, windows: sorted };
}
