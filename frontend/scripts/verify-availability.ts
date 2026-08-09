/**
 * Checks the availability engine's arithmetic — window expansion, the
 * overlap rule that makes one booking consume neighbouring start times,
 * per-date overrides, split shifts, and past-time filtering.
 *
 * Pure functions only, no database. Run with `npm run verify:availability`.
 */

import {
  availabilityForDate,
  overridesByDate,
  instantForDateMinute,
  type AvailabilityConfig,
  type ScheduleRuleLike,
  type ScheduleOverrideLike,
  type BookingLike,
} from "../lib/availability";
import { weekdayOfDateKey, DAY_NAMES } from "../lib/schedule";
import { BUSINESS_TIMEZONE } from "../lib/timezone";

const HOUR = 60;

// Seeded schedule: Mon/Wed/Fri 4–10 PM, Tue/Thu 7–10 PM.
const rules: ScheduleRuleLike[] = [
  { dayOfWeek: 1, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 3, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 5, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 2, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
  { dayOfWeek: 4, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
];

const config: AvailabilityConfig = {
  slotDurationMin: 30,
  slotIntervalMin: 15,
  bookingHorizonDays: 30,
};

// Well before any test date, so nothing is filtered out as "past".
const now = new Date("2026-01-01T00:00:00Z");

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`        expected: ${e}`);
    console.log(`        actual:   ${a}`);
  }
}

// Find a Monday and a Tuesday in range.
let monday = "";
let tuesday = "";
for (let d = 10; d < 25; d++) {
  const key = `2026-08-${String(d).padStart(2, "0")}`;
  if (weekdayOfDateKey(key) === 1 && !monday) monday = key;
  if (weekdayOfDateKey(key) === 2 && !tuesday) tuesday = key;
}
console.log(`Monday  = ${monday} (${DAY_NAMES[weekdayOfDateKey(monday)]})`);
console.log(`Tuesday = ${tuesday} (${DAY_NAMES[weekdayOfDateKey(tuesday)]})\n`);

const noBookings: BookingLike[] = [];
const empty = overridesByDate([]);

// 1. Monday 4–10 PM, 30min appts every 15min => 4:00 … 9:30
const mon = availabilityForDate(monday, rules, empty, noBookings, config, now);
check("Monday slot count (4:00–9:30 every 15m)", mon.length, 23);
check("Monday first slot", fmt(mon[0]), "4:00 PM");
check("Monday last slot fits before close", fmt(mon[mon.length - 1]), "9:30 PM");

// 2. Tuesday uses the shorter 7–10 PM window
const tue = availabilityForDate(tuesday, rules, empty, noBookings, config, now);
check("Tuesday first slot", fmt(tue[0]), "7:00 PM");
check("Tuesday last slot", fmt(tue[tue.length - 1]), "9:30 PM");
check("Tuesday slot count", tue.length, 11);

// 3. THE CORE RULE: booking 4:30 must also consume 4:45, next free is 5:00
const booked430: BookingLike[] = [
  { startTime: instantForDateMinute(monday, 16 * HOUR + 30), durationMinutes: 30 },
];
const afterBooking = availabilityForDate(monday, rules, empty, booked430, config, now);
const times = afterBooking.map(fmt);
check("4:00 PM still open (ends exactly at 4:30)", times.includes("4:00 PM"), true);
// Blocking runs backward too: a 4:15 start would run to 4:45, into the booking.
check("4:15 PM consumed (would run into the booking)", times.includes("4:15 PM"), false);
check("4:30 PM consumed (booked)", times.includes("4:30 PM"), false);
check("4:45 PM consumed (would overlap)", times.includes("4:45 PM"), false);
check("5:00 PM is next available", times.includes("5:00 PM"), true);
check("three slots removed total", afterBooking.length, mon.length - 3);

// 4. Longer appointments consume proportionally more candidates
const longConfig = { ...config, slotDurationMin: 60 };
const monLong = availabilityForDate(monday, rules, empty, noBookings, longConfig, now);
const afterLong = availabilityForDate(monday, rules, empty, booked430, longConfig, now);
check("60min duration removes 4:00/4:15/4:30/4:45", monLong.length - afterLong.length, 4);

// 5. Override: closed for the day
const closed = overridesByDate([{ date: monday, isClosed: true, windows: [] }]);
check("closed override yields nothing", availabilityForDate(monday, rules, closed, noBookings, config, now).length, 0);

// 6. Override: custom hours replace the weekly ones for that day only
const custom: ScheduleOverrideLike[] = [
  { date: monday, isClosed: false, windows: [{ startMinute: 9 * HOUR, endMinute: 11 * HOUR }] },
];
const overridden = availabilityForDate(monday, rules, overridesByDate(custom), noBookings, config, now);
check("override first slot", fmt(overridden[0]), "9:00 AM");
check("override last slot", fmt(overridden[overridden.length - 1]), "10:30 AM");
check("weekly schedule untouched next Monday", availabilityForDate(`2026-08-${Number(monday.slice(-2)) + 7}`, rules, overridesByDate(custom), noBookings, config, now).length, 23);

// 7. Multiple windows in one day (split shift)
const split: ScheduleRuleLike[] = [
  { dayOfWeek: weekdayOfDateKey(monday), startMinute: 9 * HOUR, endMinute: 11 * HOUR },
  { dayOfWeek: weekdayOfDateKey(monday), startMinute: 14 * HOUR, endMinute: 16 * HOUR },
];
const splitDay = availabilityForDate(monday, split, empty, noBookings, config, now);
check("split shift count", splitDay.length, 14);
check("split shift has morning + afternoon", [fmt(splitDay[0]), fmt(splitDay[splitDay.length - 1])], ["9:00 AM", "3:30 PM"]);

// 8. Past times are filtered
const midMonday = instantForDateMinute(monday, 18 * HOUR);
const laterToday = availabilityForDate(monday, rules, empty, noBookings, config, midMonday);
check("past slots filtered", laterToday.every((s) => s > midMonday), true);
check("first remaining is after 'now'", fmt(laterToday[0]), "6:15 PM");

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
