/**
 * `BookingHistory` rows, shaped for the admin's history page.
 *
 * Pure — no database import; `bookingHistoryData.ts` does the querying, the
 * same split as `bookingGroup.ts` and its callers.
 *
 * A group booking is recorded as one row per person (mirroring `Booking`), but
 * it was one decision by one client, booked and cancelled whole. So it reads as
 * one entry here, exactly as it does on `/my-booking`.
 */

export type HistoryRow = {
  id: number;
  groupId: string | null;
  startTime: Date;
  durationMinutes: number;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  servicePriceCents: number;
  bookedAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
};

/**
 * "past" means the time came and went without a cancellation, not that the
 * client showed up. Nothing in the app records attendance, so the label must
 * not claim it.
 */
export type HistoryStatus = "upcoming" | "past" | "cancelled";

export type CancelledBy = "client" | "admin";

export type HistoryEntry = {
  /** Stable React key: the groupId, or the row id for a solo booking. */
  key: string;
  size: number;
  startTime: Date;
  endTime: Date;
  totalPriceCents: number;
  clientName: string;
  clientPhone: string;
  /** One per person, in appointment order. */
  services: string[];
  bookedAt: Date;
  cancelledAt: Date | null;
  cancelledBy: CancelledBy | null;
  status: HistoryStatus;
};

/** Anything else in the column (a hand edit) is shown as no attribution. */
function parseCancelledBy(value: string | null): CancelledBy | null {
  return value === "client" || value === "admin" ? value : null;
}

export function historyStatus(
  entry: { cancelledAt: Date | null; endTime: Date },
  now: Date
): HistoryStatus {
  if (entry.cancelledAt) return "cancelled";
  return entry.endTime.getTime() <= now.getTime() ? "past" : "upcoming";
}

function toEntry(key: string, rows: HistoryRow[], now: Date): HistoryEntry {
  const legs = [...rows].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const first = legs[0];
  const last = legs[legs.length - 1];
  const endTime = new Date(
    last.startTime.getTime() + last.durationMinutes * 60_000
  );

  // A group is cancelled whole, so its legs share a stamp. Reading the latest
  // one anyway means a partially-marked group (only possible by hand-editing
  // the table) still shows as cancelled rather than half-standing.
  const cancelled = legs.filter((leg) => leg.cancelledAt !== null);
  const latestCancel = cancelled.reduce<HistoryRow | null>(
    (latest, leg) =>
      latest && latest.cancelledAt!.getTime() >= leg.cancelledAt!.getTime()
        ? latest
        : leg,
    null
  );
  const cancelledAt = latestCancel?.cancelledAt ?? null;

  return {
    key,
    size: legs.length,
    startTime: first.startTime,
    endTime,
    totalPriceCents: legs.reduce((sum, leg) => sum + leg.servicePriceCents, 0),
    clientName: first.clientName,
    clientPhone: first.clientPhone,
    services: legs.map((leg) => leg.serviceName),
    bookedAt: legs.reduce(
      (earliest, leg) => (leg.bookedAt < earliest ? leg.bookedAt : earliest),
      first.bookedAt
    ),
    cancelledAt,
    cancelledBy: parseCancelledBy(latestCancel?.cancelledBy ?? null),
    status: historyStatus({ cancelledAt, endTime }, now),
  };
}

/**
 * Buckets rows into entries, keeping the order in which each entry's first row
 * arrived. The caller's `orderBy` (newest booking first, or newest
 * cancellation first) is therefore the page's order.
 */
export function toHistoryEntries(rows: HistoryRow[], now: Date): HistoryEntry[] {
  const buckets = new Map<string, HistoryRow[]>();

  for (const row of rows) {
    const key = row.groupId ?? `solo-${row.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets].map(([key, bucket]) => toEntry(key, bucket, now));
}

export type HistoryFilter = "all" | "cancelled";

export function parseHistoryFilter(value: unknown): HistoryFilter {
  return value === "cancelled" ? "cancelled" : "all";
}

/**
 * How far back the page looks. The default keeps the common case — "what
 * happened lately" — to a small, index-bounded scan instead of reading the
 * table from the top until the page fills.
 */
export const HISTORY_RANGES = [
  { value: "30d", label: "Past 30 days", days: 30 },
  { value: "60d", label: "Past 60 days", days: 60 },
  { value: "90d", label: "Past 90 days", days: 90 },
  { value: "1y", label: "Past year", days: 365 },
  { value: "2y", label: "Past 2 years", days: 730 },
] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number]["value"];

export const DEFAULT_HISTORY_RANGE: HistoryRange = "30d";

export function parseHistoryRange(value: unknown): HistoryRange {
  const match = HISTORY_RANGES.find((range) => range.value === value);
  return match ? match.value : DEFAULT_HISTORY_RANGE;
}

export function historyRangeLabel(range: HistoryRange): string {
  return HISTORY_RANGES.find((r) => r.value === range)!.label;
}

/**
 * The earliest instant a range includes. Counted in whole 24-hour days back
 * from `now` rather than calendar days in the business timezone — the cutoff
 * is a coarse window, and an hour either side of a DST change can't matter.
 */
export function historyRangeStart(range: HistoryRange, now: Date): Date {
  const { days } = HISTORY_RANGES.find((r) => r.value === range)!;
  return new Date(now.getTime() - days * 24 * 60 * 60_000);
}

export const HISTORY_PAGE_SIZE = 100;
export const HISTORY_MAX_LIMIT = 2000;

/**
 * `?limit=` from the URL, rounded to a whole page and clamped so a hand-typed
 * value can neither be zero nor ask for the whole table at once.
 */
export function parseHistoryLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < HISTORY_PAGE_SIZE) {
    return HISTORY_PAGE_SIZE;
  }
  const pages = Math.ceil(parsed / HISTORY_PAGE_SIZE);
  return Math.min(pages * HISTORY_PAGE_SIZE, HISTORY_MAX_LIMIT);
}

/**
 * Every link the history page generates goes through here — the tabs, "Show
 * older" and "Clear" — so a search or a timeframe can't silently drop out of the URL when the
 * admin switches tab, the way `?service=` would on `/slots` without
 * `withService()`.
 *
 * `phone` is whatever the admin typed, passed through as-is: the page
 * normalizes it on every render, so keeping their spelling in the URL keeps
 * the search box showing what they entered.
 */
export function historyHref({
  filter,
  range = DEFAULT_HISTORY_RANGE,
  limit,
  phone,
}: {
  filter: HistoryFilter;
  range?: HistoryRange;
  limit?: number;
  phone?: string;
}): string {
  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (filter !== "all") params.set("filter", filter);
  if (range !== DEFAULT_HISTORY_RANGE) params.set("range", range);
  if (limit && limit > HISTORY_PAGE_SIZE) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `/admin/history?${query}` : "/admin/history";
}
