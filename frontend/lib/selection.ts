/**
 * What the client is booking: one service, or a back-to-back block for a group.
 *
 * Pure — no database import, because `/group`'s picker is a client component
 * and would otherwise pull Prisma into the browser bundle. The loader lives in
 * `selectionData.ts`, mirroring the `service.ts` / `serviceData.ts` split.
 *
 * The point of this module is that a group is not a special case of booking:
 * it is a longer one. `lib/availability.ts` already takes `durationMin` as an
 * explicit argument precisely because there is no such thing as "the"
 * appointment length, so a party of three wanting 30 minutes each is just
 * `durationMin: 90` — the overlap and window-fit rules need no changes at all.
 * Everything here exists to get from a URL to that number and back.
 *
 * `serializeSelection` emitting `service=5` for a single id is load-bearing,
 * not cosmetic: it is what keeps every URL the one-person flow generates
 * byte-identical to what it generated before groups existed.
 */

/** Four is the most a single block can hold before it stops fitting a day. */
export const MAX_GROUP_SIZE = 4;

/** The shape the sums need — structural, so this module stays data-layer free. */
type Priced = { priceCents: number };
type Timed = { durationMinutes: number };

/**
 * Reads the service selection out of a URL's query.
 *
 * `services` wins when both are present. `withSelection` never emits both, so
 * this only arises from a hand-edited link, and the plural is the more specific
 * intent. A single id spelled `services=5` normalizes to `[5]` for the same
 * reason — a link that means one thing should not 404 over its spelling.
 *
 * Duplicates are legal and order is preserved: three people can all want the
 * same haircut, and the order decides who goes first.
 */
export function parseSelectionParam(params: {
  service?: string;
  services?: string;
}): number[] | null {
  const raw = params.services ?? params.service;
  if (!raw) return null;

  const parts = raw.split(",");
  if (parts.length < 1 || parts.length > MAX_GROUP_SIZE) return null;

  const ids: number[] = [];
  for (const part of parts) {
    // Strict: no whitespace, no signs, no empties. `Number("")` is 0 and
    // `Number(" 2 ")` is 2, so parsing without this test accepts junk.
    if (!/^\d+$/.test(part)) return null;
    const id = Number(part);
    if (!Number.isInteger(id) || id < 1) return null;
    ids.push(id);
  }

  return ids;
}

/**
 * The inverse. One id spells itself the way it always has, so `/slots` and
 * `/book/[start]` keep producing the exact URLs they produced before this
 * feature — see the test that pins it.
 */
export function serializeSelection(ids: number[]): string {
  if (ids.length === 1) return `service=${ids[0]}`;
  return `services=${ids.join(",")}`;
}

/** The block's length: what `computeAvailability` and `isStartBookable` want. */
export function totalDurationMinutes(services: Timed[]): number {
  return services.reduce((sum, service) => sum + service.durationMinutes, 0);
}

export function totalPriceCents(services: Priced[]): number {
  return services.reduce((sum, service) => sum + service.priceCents, 0);
}

export type SelectionLeg<T extends Timed> = {
  /** 0-based position in the block — person 1 is index 0. */
  index: number;
  start: Date;
  end: Date;
  service: T;
};

/**
 * Turns a block start into each person's own instant.
 *
 * This is the one place that decides who is at what time, so the booking
 * page's summary, the rows `createBooking` writes, the confirmation page and
 * the calendar file cannot disagree.
 *
 * Interior starts are not required to land on the `slotIntervalMin` grid — a
 * 20-minute service already puts the next leg at +20. That costs nothing:
 * future clients are only ever offered grid-aligned candidates, which are then
 * filtered against whatever rows exist, wherever those rows happen to start.
 */
export function selectionLegs<T extends Timed>(
  start: Date,
  services: T[]
): SelectionLeg<T>[] {
  const legs: SelectionLeg<T>[] = [];
  let cursor = start.getTime();

  services.forEach((service, index) => {
    const end = cursor + service.durationMinutes * 60_000;
    legs.push({
      index,
      start: new Date(cursor),
      end: new Date(end),
      service,
    });
    cursor = end;
  });

  return legs;
}

/** When the whole block is over — the last leg's end. */
export function selectionEnd(start: Date, services: Timed[]): Date {
  return new Date(start.getTime() + totalDurationMinutes(services) * 60_000);
}
