/**
 * Turns the admin's schedule into concrete bookable start times.
 *
 * Nothing is materialized in the database: a day's openings come from the
 * recurring weekly rules (or a per-date override, which replaces them wholesale),
 * candidate start times are generated at `slotIntervalMin` granularity, and any
 * candidate whose appointment would overlap an existing booking is dropped.
 *
 * That last part is what makes booking 4:30 also consume 4:45 — with a 30-minute
 * duration the 4:45 appointment would run into the 4:30–5:00 booking.
 *
 * `durationMin` is the length of the appointment being *considered*, which comes
 * from the service the client picked, and is passed separately from `config`
 * rather than living inside it. There is no global appointment length: the same
 * schedule yields a different set of start times for a 15-minute service than
 * for a 60-minute one, so every caller has to say which it means.
 */

import {
  BUSINESS_TIMEZONE,
  addDaysToDateKey,
  dateKeyInTimezone,
  todayInTimezone,
  zonedWallTimeToUtc,
} from "./timezone";
import { minutesToTimeInput, weekdayOfDateKey, type TimeWindow } from "./schedule";

export type ScheduleRuleLike = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type ScheduleOverrideLike = {
  date: string;
  isClosed: boolean;
  windows: TimeWindow[];
};

export type BookingLike = {
  startTime: Date;
  durationMinutes: number;
};

/**
 * The schedule-wide knobs. Appointment length is deliberately absent — it
 * belongs to a Service, and is threaded through as `durationMin`.
 */
export type AvailabilityConfig = {
  slotIntervalMin: number;
  bookingHorizonDays: number;
};

export type DayAvailability = {
  /** YYYY-MM-DD in BUSINESS_TIMEZONE. */
  dateKey: string;
  starts: Date[];
};

/** The UTC instant of a wall-clock minute-of-day on a given calendar date. */
export function instantForDateMinute(
  dateKey: string,
  minute: number,
  timeZone: string = BUSINESS_TIMEZONE
): Date {
  return zonedWallTimeToUtc(`${dateKey}T${minutesToTimeInput(minute)}:00`, timeZone);
}

export function overridesByDate(
  overrides: ScheduleOverrideLike[]
): Map<string, ScheduleOverrideLike> {
  return new Map(overrides.map((override) => [override.date, override]));
}

/**
 * The open windows for one calendar date. An override replaces that day's
 * weekly rules entirely — that's what lets the admin change a single day
 * without disturbing the rest of the week.
 */
export function windowsForDate(
  dateKey: string,
  rules: ScheduleRuleLike[],
  overrideMap: Map<string, ScheduleOverrideLike>
): TimeWindow[] {
  const override = overrideMap.get(dateKey);

  if (override) {
    if (override.isClosed) return [];
    return [...override.windows].sort((a, b) => a.startMinute - b.startMinute);
  }

  const weekday = weekdayOfDateKey(dateKey);
  return rules
    .filter((rule) => rule.dayOfWeek === weekday)
    .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

function overlapsBooking(
  startMs: number,
  durationMin: number,
  bookings: BookingLike[]
): boolean {
  const endMs = startMs + durationMin * 60_000;

  return bookings.some((booking) => {
    const bookingStart = booking.startTime.getTime();
    const bookingEnd = bookingStart + booking.durationMinutes * 60_000;
    return startMs < bookingEnd && endMs > bookingStart;
  });
}

/**
 * Candidate start times for a single date, before any past/booking filtering.
 * A candidate only counts if the whole appointment fits inside its window —
 * which is why a longer service loses the late starts a short one keeps.
 */
function candidateMinutes(
  windows: TimeWindow[],
  config: AvailabilityConfig,
  durationMin: number
): number[] {
  const interval = Math.max(1, config.slotIntervalMin);
  const minutes = new Set<number>();

  for (const window of windows) {
    for (
      let minute = window.startMinute;
      minute + durationMin <= window.endMinute;
      minute += interval
    ) {
      minutes.add(minute);
    }
  }

  return [...minutes].sort((a, b) => a - b);
}

/** Bookable start times for one date, with past times and conflicts removed. */
export function availabilityForDate(
  dateKey: string,
  rules: ScheduleRuleLike[],
  overrideMap: Map<string, ScheduleOverrideLike>,
  bookings: BookingLike[],
  config: AvailabilityConfig,
  durationMin: number,
  now: Date = new Date()
): Date[] {
  const windows = windowsForDate(dateKey, rules, overrideMap);
  if (windows.length === 0) return [];

  const nowMs = now.getTime();

  return candidateMinutes(windows, config, durationMin)
    .map((minute) => instantForDateMinute(dateKey, minute))
    .filter((start) => start.getTime() > nowMs)
    .filter((start) => !overlapsBooking(start.getTime(), durationMin, bookings));
}

/**
 * Bookable start times per day from today through the booking horizon, for an
 * appointment of `durationMin`. Days with nothing available are omitted.
 */
export function computeAvailability({
  rules,
  overrides,
  bookings,
  config,
  durationMin,
  now = new Date(),
}: {
  rules: ScheduleRuleLike[];
  overrides: ScheduleOverrideLike[];
  bookings: BookingLike[];
  config: AvailabilityConfig;
  durationMin: number;
  now?: Date;
}): DayAvailability[] {
  const overrideMap = overridesByDate(overrides);
  const startDateKey = todayInTimezone();
  const days: DayAvailability[] = [];

  for (let offset = 0; offset <= config.bookingHorizonDays; offset++) {
    const dateKey = addDaysToDateKey(startDateKey, offset);
    const starts = availabilityForDate(
      dateKey,
      rules,
      overrideMap,
      bookings,
      config,
      durationMin,
      now
    );
    if (starts.length > 0) days.push({ dateKey, starts });
  }

  return days;
}

/**
 * Whether a specific instant is a legitimate, still-open start time for an
 * appointment of `durationMin`.
 *
 * Deliberately re-derives the day's availability rather than trusting the
 * caller, so the booking endpoint and the times shown to clients can never
 * disagree about what's bookable. Note the answer depends on the service: 4:15
 * may be open for a 15-minute appointment and closed for a 30-minute one.
 */
export function isStartBookable({
  start,
  rules,
  overrides,
  bookings,
  config,
  durationMin,
  now = new Date(),
}: {
  start: Date;
  rules: ScheduleRuleLike[];
  overrides: ScheduleOverrideLike[];
  bookings: BookingLike[];
  config: AvailabilityConfig;
  durationMin: number;
  now?: Date;
}): boolean {
  if (Number.isNaN(start.getTime())) return false;

  const horizonEnd = instantForDateMinute(
    addDaysToDateKey(todayInTimezone(), config.bookingHorizonDays + 1),
    0
  );
  if (start >= horizonEnd) return false;

  const dateKey = dateKeyInTimezone(start);
  const starts = availabilityForDate(
    dateKey,
    rules,
    overridesByDate(overrides),
    bookings,
    config,
    durationMin,
    now
  );

  return starts.some((candidate) => candidate.getTime() === start.getTime());
}
