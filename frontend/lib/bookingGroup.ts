/**
 * Stored `Booking` rows, read back as the group they belong to.
 *
 * The mirror of `selection.ts`: that module is about *intent* (ids and services
 * chosen before anything is written), this one is about *fact* (rows that
 * exist). They stay separate because they take different inputs and nothing
 * needs both — the confirmation page, `/my-booking`, cancellation and the
 * `.ics` route all start from rows.
 *
 * Pure — no database import. The callers do the querying.
 *
 * A group is stored as one row per person, back to back, sharing a `groupId`.
 * There is deliberately no `groupSize` or `groupIndex` column: size is the row
 * count and order is `startTime` ascending, both of which cancellation's
 * all-or-nothing delete keeps exact. A stored copy could only ever disagree.
 */

/** The columns a group summary reads. Structurally satisfied by a Booking row. */
export type GroupRow = {
  id: number;
  startTime: Date;
  durationMinutes: number;
  serviceName: string;
  servicePriceCents: number;
  clientName: string;
  clientPhone: string;
  cancelToken: string;
  createdAt: Date;
  groupId: string | null;
};

export type BookingGroup<T extends GroupRow = GroupRow> = {
  /** Null for a solo booking, which is a group of one everywhere below. */
  groupId: string | null;
  size: number;
  startTime: Date;
  endTime: Date;
  totalDurationMinutes: number;
  totalPriceCents: number;
  clientName: string;
  clientPhone: string;
  /**
   * The earliest leg's token, and the only one any URL uses. Every leg has its
   * own — the column is `@unique`, so they cannot be shared — but cancelling
   * through any of them takes the whole group, so one is enough to link to.
   */
  cancelToken: string;
  /** Sorted by `startTime`, so index 0 is person 1. */
  legs: T[];
};

/**
 * Collapses a group's rows into one summary. Sorts defensively rather than
 * trusting the caller's `orderBy` — `cancelToken` and `startTime` are read off
 * the first leg, so the wrong order would produce a subtly wrong page.
 *
 * The end is the last leg's end, not the sum, because those agree only when the
 * rows really are contiguous, and the last leg is the one the client is
 * actually waiting for.
 */
export function toBookingGroup<T extends GroupRow>(rows: T[]): BookingGroup<T> {
  if (rows.length === 0) {
    throw new Error("toBookingGroup needs at least one booking");
  }

  const legs = [...rows].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const first = legs[0];
  const last = legs[legs.length - 1];
  const endTime = new Date(
    last.startTime.getTime() + last.durationMinutes * 60_000
  );

  return {
    groupId: first.groupId,
    size: legs.length,
    startTime: first.startTime,
    endTime,
    totalDurationMinutes: Math.round(
      (endTime.getTime() - first.startTime.getTime()) / 60_000
    ),
    totalPriceCents: legs.reduce((sum, leg) => sum + leg.servicePriceCents, 0),
    clientName: first.clientName,
    clientPhone: first.clientPhone,
    cancelToken: first.cancelToken,
    legs,
  };
}

/**
 * Buckets a flat list of rows into groups, preserving the order they arrived
 * in. `/my-booking` needs this: the query returns every row for a phone
 * number, and a party of three must render as one card rather than three
 * near-identical ones each offering a "cancel" that would take all three.
 *
 * Rows without a `groupId` are their own group of one.
 */
export function groupRows<T extends GroupRow>(rows: T[]): T[][] {
  const buckets = new Map<string, T[]>();

  for (const row of rows) {
    const key = row.groupId ?? `solo-${row.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets.values()];
}
