/**
 * The loader for `/admin/history`. See `bookingHistory.ts` for the shaping.
 */

import { db } from "./db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  historyRangeStart,
  toHistoryEntries,
  type HistoryEntry,
  type HistoryFilter,
  type HistoryRange,
} from "./bookingHistory";

export async function loadBookingHistory({
  filter,
  range,
  limit,
  phone = null,
  now = new Date(),
}: {
  filter: HistoryFilter;
  range: HistoryRange;
  /** Rows, not entries — a party of three is three. */
  limit: number;
  /**
   * Already E.164 — the caller runs it through `normalizePhone()`. An exact
   * match on the stored column is the whole search, exactly as on
   * `/my-booking`; there is deliberately no second normalizer here.
   */
  phone?: string | null;
  now?: Date;
}): Promise<{ entries: HistoryEntry[]; hasMore: boolean }> {
  // The timeframe bounds the same column the list is ordered by — when it was
  // booked, or when it was cancelled — so "past 30 days" on the Cancelled tab
  // means cancellations made in the last 30 days, and both are one range scan
  // on an existing index (`bookedAt` / `cancelledAt`).
  const since = historyRangeStart(range, now);
  const where: Prisma.BookingHistoryWhereInput = {
    ...(phone ? { clientPhone: phone } : {}),
    ...(filter === "cancelled"
      ? { cancelledAt: { gte: since } }
      : { bookedAt: { gte: since } }),
  };

  // "Cancelled" orders by when it was cancelled, so a client who cancels an
  // appointment booked weeks ago shows up at the top instead of being buried
  // under everything booked since.
  const rows = await db.bookingHistory.findMany({
    where,
    orderBy:
      filter === "cancelled"
        ? [{ cancelledAt: "desc" }, { id: "desc" }]
        : [{ bookedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // The limit can cut a group in half at the bottom of the page. Fetch the
  // missing legs so that entry still shows its real size and total, rather
  // than "party of 1" for what was a party of three.
  const groupIds = [
    ...new Set(page.map((row) => row.groupId).filter((id) => id !== null)),
  ];
  const seen = new Set(page.map((row) => row.id));
  const siblings =
    groupIds.length === 0
      ? []
      : await db.bookingHistory.findMany({
          where: { groupId: { in: groupIds }, id: { notIn: [...seen] } },
        });

  return { entries: toHistoryEntries([...page, ...siblings], now), hasMore };
}

/**
 * How many bookings and cancellations one number has, for the summary line
 * above a phone search. Counted in entries, not rows, so a party of three
 * booked and cancelled once reads as "1 booking, 1 cancelled" — that is what
 * the client did.
 */
export async function loadPhoneSummary(
  phone: string,
  range: HistoryRange,
  now: Date = new Date()
): Promise<{ bookings: number; cancelled: number }> {
  // Scoped to the timeframe the same way each tab is: bookings by when they
  // were booked, cancellations by when they were cancelled. So each count
  // matches what its tab lists, including an old booking cancelled recently.
  const since = historyRangeStart(range, now);
  const rows = await db.bookingHistory.findMany({
    where: {
      clientPhone: phone,
      OR: [{ bookedAt: { gte: since } }, { cancelledAt: { gte: since } }],
    },
    select: { id: true, groupId: true, bookedAt: true, cancelledAt: true },
  });

  const entries = new Map<string, { booked: boolean; cancelled: boolean }>();
  for (const row of rows) {
    const key = row.groupId ?? `solo-${row.id}`;
    const entry = entries.get(key) ?? { booked: false, cancelled: false };
    if (row.bookedAt >= since) entry.booked = true;
    if (row.cancelledAt && row.cancelledAt >= since) entry.cancelled = true;
    entries.set(key, entry);
  }

  let bookings = 0;
  let cancelled = 0;
  for (const entry of entries.values()) {
    if (entry.booked) bookings++;
    if (entry.cancelled) cancelled++;
  }

  return { bookings, cancelled };
}
