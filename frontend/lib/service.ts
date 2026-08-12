/**
 * Service vocabulary, validation and formatting.
 *
 * Pure — no database import, because the admin service forms are client
 * components and would otherwise pull Prisma into the browser bundle. The
 * server-side loaders live in `serviceData.ts`, mirroring the
 * `settings.ts` / `settingsData.ts` split.
 */

/** Lengths offered in the admin picker. Anything in range is accepted. */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

/**
 * Five minutes is the shortest length that produces a usable grid; eight hours
 * is longer than any single day's window is likely to be. The upper bound also
 * keeps `getRelevantBookings`' 24-hour lookback in `scheduleData.ts` correct —
 * no appointment can start yesterday and still be running now.
 */
export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 480;

/** Dollars in, cents out. Cents are stored so prices never hit float rounding. */
export function parsePriceCents(price: unknown): number | null {
  const dollars = Number(price);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export function parseDurationMinutes(value: unknown): number | null {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return null;
  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) return null;
  return minutes;
}

/** `$25` rather than `$25.00`, but `$12.50` keeps its cents. */
export function formatPrice(priceCents: number): string {
  const dollars = priceCents / 100;
  return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  return `${minutes} min`;
}
