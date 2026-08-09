export const BUSINESS_TIMEZONE = "America/Los_Angeles";

/**
 * Constructing an Intl.DateTimeFormat is comparatively expensive, and computed
 * availability resolves hundreds of wall times per page render. Formatters are
 * stateless, so cache one per timezone.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function offsetPartsToUtc(instant: Date, timeZone: string): Date {
  const parts = wallClockFormatter(timeZone).formatToParts(instant);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const hour = map.hour === "24" ? "00" : map.hour;

  return new Date(
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(hour),
      Number(map.minute),
      Number(map.second)
    )
  );
}

/**
 * Converts a timezone-less wall-clock string (e.g. "2026-08-01T06:00:00", as
 * produced by combining a <input type="date"> and <input type="time">) into
 * the UTC instant it represents in `timeZone`. Handles DST via a guess-and-
 * correct pass against the IANA database instead of a fixed offset.
 */
export function zonedWallTimeToUtc(
  wallTime: string,
  timeZone: string = BUSINESS_TIMEZONE
): Date {
  const naiveUtc = new Date(wallTime.endsWith("Z") ? wallTime : `${wallTime}Z`);
  const asIfLocal = offsetPartsToUtc(naiveUtc, timeZone);
  const diff = naiveUtc.getTime() - asIfLocal.getTime();
  return new Date(naiveUtc.getTime() + diff);
}

/** The calendar date (YYYY-MM-DD) `date` falls on as observed in `timeZone`. */
export function dateKeyInTimezone(date: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Today's date (YYYY-MM-DD) as observed in `timeZone`, not the runtime's own zone. */
export function todayInTimezone(timeZone: string = BUSINESS_TIMEZONE): string {
  return dateKeyInTimezone(new Date(), timeZone);
}

/** Adds `days` calendar days to a YYYY-MM-DD date key. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
