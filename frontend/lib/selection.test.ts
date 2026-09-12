/**
 * The URL <-> selection round trip and the arithmetic of a back-to-back block.
 *
 * Two things here are worth more than the rest. `serializeSelection([5])`
 * spelling itself `service=5` is what keeps every URL the one-person flow
 * generates byte-identical to what it generated before groups existed — the
 * requirement "the standard booking must not change", in executable form. And
 * `selectionLegs` is the one place that decides who is seen at what time, so if
 * it drifts the booking page, the rows written and the calendar file all drift
 * with it.
 *
 * Pure functions over plain data — no database, no mocking.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_GROUP_SIZE,
  parseSelectionParam,
  selectionEnd,
  selectionLegs,
  serializeSelection,
  totalDurationMinutes,
  totalPriceCents,
} from "./selection";

/** Stands in for a `BookableService`; only these two fields are read. */
const service = (durationMinutes: number, priceCents = 0) => ({
  durationMinutes,
  priceCents,
});

const HAIRCUT = service(30, 2500);
const EYEBROWS = service(15, 1000);
const HAIR_AND_BEARD = service(60, 4000);

/** 5:00 PM as an instant; the timezone is irrelevant to pure offsets. */
const start = new Date("2026-08-10T17:00:00Z");

/** Minutes from `start`, so expectations read as offsets rather than clocks. */
const offset = (date: Date) => (date.getTime() - start.getTime()) / 60_000;

describe("serializeSelection", () => {
  it("spells a single service exactly the way it always has", () => {
    // Load-bearing. Every /slots link, month arrow and time pill is built from
    // this, so anything but `service=5` silently changes the one-person flow.
    expect(serializeSelection([5])).toBe("service=5");
  });

  it("uses the plural form for a group", () => {
    expect(serializeSelection([5, 5, 3])).toBe("services=5,5,3");
  });
});

describe("parseSelectionParam", () => {
  it("reads a single service", () => {
    expect(parseSelectionParam({ service: "5" })).toEqual([5]);
  });

  it("reads a group, keeping duplicates and order", () => {
    // Three people can all want the same haircut, and the order decides who
    // goes first — neither may be collapsed or sorted away.
    expect(parseSelectionParam({ services: "5,5,3" })).toEqual([5, 5, 3]);
    expect(parseSelectionParam({ services: "3,5,5" })).toEqual([3, 5, 5]);
  });

  it("round-trips whatever serializeSelection produced", () => {
    const cases = [[5], [5, 5], [1, 2, 3], [4, 4, 4, 4]];

    for (const ids of cases) {
      const query = new URLSearchParams(serializeSelection(ids));
      expect(
        parseSelectionParam({
          service: query.get("service") ?? undefined,
          services: query.get("services") ?? undefined,
        })
      ).toEqual(ids);
    }
  });

  it("normalizes a single id spelled as a group", () => {
    // Only reachable from a hand-edited link, and it means one thing clearly
    // enough that refusing it would be pedantry.
    expect(parseSelectionParam({ services: "5" })).toEqual([5]);
  });

  it("prefers the plural when a link carries both", () => {
    // `withSelection` never emits both, so this is a tampered URL; the more
    // specific intent wins.
    expect(parseSelectionParam({ service: "1", services: "2,3" })).toEqual([2, 3]);
  });

  it("returns null when neither is present", () => {
    expect(parseSelectionParam({})).toBeNull();
    expect(parseSelectionParam({ service: "" })).toBeNull();
  });

  it("rejects anything that isn't a plain positive integer", () => {
    // `Number("")` is 0 and `Number(" 2 ")` is 2, so a loose parse accepts junk.
    for (const services of ["1,,2", "1, 2", "0", "-1", "1,a", "1.5", " ", "1,"]) {
      expect(parseSelectionParam({ services })).toBeNull();
    }
  });

  it("rejects a party larger than the maximum", () => {
    const tooMany = Array.from({ length: MAX_GROUP_SIZE + 1 }, () => "1").join(",");
    expect(parseSelectionParam({ services: tooMany })).toBeNull();

    const theMost = Array.from({ length: MAX_GROUP_SIZE }, () => "1").join(",");
    expect(parseSelectionParam({ services: theMost })).toHaveLength(MAX_GROUP_SIZE);
  });
});

describe("totals", () => {
  it("sums duration across a block, duplicates included", () => {
    // This number is what gets passed to computeAvailability as `durationMin`,
    // which is the whole mechanism by which a group blocks a range.
    expect(totalDurationMinutes([HAIRCUT, HAIRCUT, HAIRCUT])).toBe(90);
    expect(totalDurationMinutes([HAIRCUT, EYEBROWS, HAIR_AND_BEARD])).toBe(105);
  });

  it("sums price the same way", () => {
    expect(totalPriceCents([HAIRCUT, HAIRCUT, EYEBROWS])).toBe(6000);
  });

  it("treats an empty selection as zero rather than throwing", () => {
    expect(totalDurationMinutes([])).toBe(0);
    expect(totalPriceCents([])).toBe(0);
  });
});

describe("selectionLegs", () => {
  it("puts one person at the block's start", () => {
    const legs = selectionLegs(start, [HAIRCUT]);

    expect(legs).toHaveLength(1);
    expect(offset(legs[0].start)).toBe(0);
    expect(offset(legs[0].end)).toBe(30);
  });

  it("chains each person onto the end of the one before", () => {
    // Mixed lengths, so a bug that used a fixed step rather than each service's
    // own duration would show up here rather than cancelling itself out.
    const legs = selectionLegs(start, [HAIRCUT, HAIR_AND_BEARD, EYEBROWS]);

    expect(legs.map((leg) => offset(leg.start))).toEqual([0, 30, 90]);
    expect(legs.map((leg) => offset(leg.end))).toEqual([30, 90, 105]);
  });

  it("gives every leg a distinct start", () => {
    // What keeps `startTime @unique` satisfiable within one group.
    const legs = selectionLegs(start, [HAIRCUT, HAIRCUT, HAIRCUT, HAIRCUT]);
    const starts = legs.map((leg) => leg.start.getTime());

    expect(new Set(starts).size).toBe(legs.length);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("numbers the legs from zero, in the order chosen", () => {
    const legs = selectionLegs(start, [EYEBROWS, HAIRCUT]);

    expect(legs.map((leg) => leg.index)).toEqual([0, 1]);
    expect(legs.map((leg) => leg.service)).toEqual([EYEBROWS, HAIRCUT]);
  });

  it("ends where the total duration says it does", () => {
    const services = [HAIRCUT, EYEBROWS, HAIR_AND_BEARD];
    const legs = selectionLegs(start, services);

    expect(selectionEnd(start, services).getTime()).toBe(
      legs[legs.length - 1].end.getTime()
    );
    expect(offset(selectionEnd(start, services))).toBe(
      totalDurationMinutes(services)
    );
  });
});
