import { describe, expect, it } from "vitest";

import {
  HISTORY_MAX_LIMIT,
  HISTORY_PAGE_SIZE,
  DEFAULT_HISTORY_RANGE,
  HISTORY_RANGES,
  historyHref,
  historyRangeStart,
  historyStatus,
  parseHistoryFilter,
  parseHistoryLimit,
  parseHistoryRange,
  toHistoryEntries,
  type HistoryRow,
} from "./bookingHistory";

const now = new Date("2026-11-19T20:00:00Z");
const MIN = 60_000;

let nextId = 1;
function row(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    id: nextId++,
    groupId: null,
    startTime: new Date(now.getTime() + 24 * 60 * MIN),
    durationMinutes: 30,
    clientName: "Ada Lovelace",
    clientPhone: "+16191234567",
    serviceName: "Haircut",
    servicePriceCents: 2500,
    bookedAt: new Date(now.getTime() - 60 * MIN),
    cancelledAt: null,
    cancelledBy: null,
    ...overrides,
  };
}

describe("historyStatus", () => {
  it("is cancelled whenever a cancellation is stamped, even for a past time", () => {
    const endTime = new Date(now.getTime() - 60 * MIN);
    expect(historyStatus({ cancelledAt: now, endTime }, now)).toBe("cancelled");
  });

  it("is past once the appointment has ended, and upcoming until then", () => {
    expect(historyStatus({ cancelledAt: null, endTime: now }, now)).toBe("past");
    expect(
      historyStatus({ cancelledAt: null, endTime: new Date(now.getTime() + MIN) }, now)
    ).toBe("upcoming");
  });

  it("counts an appointment in progress as upcoming, not past", () => {
    const [entry] = toHistoryEntries(
      [row({ startTime: new Date(now.getTime() - 10 * MIN), durationMinutes: 30 })],
      now
    );
    expect(entry.status).toBe("upcoming");
  });
});

describe("toHistoryEntries", () => {
  it("reads a solo booking as one entry", () => {
    const solo = row();
    const [entry] = toHistoryEntries([solo], now);

    expect(entry).toMatchObject({
      key: `solo-${solo.id}`,
      size: 1,
      services: ["Haircut"],
      totalPriceCents: 2500,
      status: "upcoming",
      cancelledBy: null,
    });
    expect(entry.endTime.getTime() - entry.startTime.getTime()).toBe(30 * MIN);
  });

  it("collapses a group into one entry in appointment order, whatever order rows arrive in", () => {
    const start = new Date(now.getTime() + 24 * 60 * MIN);
    const second = row({
      groupId: "g1",
      startTime: new Date(start.getTime() + 30 * MIN),
      durationMinutes: 15,
      serviceName: "Eyebrows",
      servicePriceCents: 1000,
    });
    const first = row({ groupId: "g1", startTime: start });

    const entries = toHistoryEntries([second, first], now);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      key: "g1",
      size: 2,
      services: ["Haircut", "Eyebrows"],
      totalPriceCents: 3500,
      startTime: start,
      endTime: new Date(start.getTime() + 45 * MIN),
    });
  });

  it("keeps the order in which each entry first appears", () => {
    const a = row();
    const g1 = row({ groupId: "g" });
    const b = row();
    const g2 = row({ groupId: "g" });

    const keys = toHistoryEntries([a, g1, b, g2], now).map((entry) => entry.key);
    expect(keys).toEqual([`solo-${a.id}`, "g", `solo-${b.id}`]);
  });

  it("carries who cancelled and when", () => {
    const cancelledAt = new Date(now.getTime() - 5 * MIN);
    const [entry] = toHistoryEntries(
      [row({ cancelledAt, cancelledBy: "client" })],
      now
    );

    expect(entry).toMatchObject({ status: "cancelled", cancelledAt, cancelledBy: "client" });
  });

  it("shows an unrecognised cancelledBy as no attribution rather than passing it through", () => {
    const [entry] = toHistoryEntries(
      [row({ cancelledAt: now, cancelledBy: "someone" })],
      now
    );
    expect(entry.cancelledBy).toBeNull();
    expect(entry.status).toBe("cancelled");
  });

  it("treats a partially marked group as cancelled", () => {
    const entries = toHistoryEntries(
      [
        row({ groupId: "g", cancelledAt: now, cancelledBy: "admin" }),
        row({ groupId: "g" }),
      ],
      now
    );
    expect(entries[0]).toMatchObject({ status: "cancelled", cancelledBy: "admin" });
  });

  it("uses the earliest leg's booking time for the group", () => {
    const early = new Date(now.getTime() - 90 * MIN);
    const [entry] = toHistoryEntries(
      [row({ groupId: "g" }), row({ groupId: "g", bookedAt: early })],
      now
    );
    expect(entry.bookedAt).toEqual(early);
  });
});

describe("parseHistoryFilter", () => {
  it("accepts only 'cancelled', defaulting everything else to all", () => {
    expect(parseHistoryFilter("cancelled")).toBe("cancelled");
    expect(parseHistoryFilter("all")).toBe("all");
    expect(parseHistoryFilter(undefined)).toBe("all");
    expect(parseHistoryFilter("CANCELLED")).toBe("all");
  });
});

describe("parseHistoryLimit", () => {
  it("defaults to one page and never goes below it", () => {
    expect(parseHistoryLimit(undefined)).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryLimit("0")).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryLimit("-5")).toBe(HISTORY_PAGE_SIZE);
    expect(parseHistoryLimit("abc")).toBe(HISTORY_PAGE_SIZE);
  });

  it("rounds up to whole pages and caps at the maximum", () => {
    expect(parseHistoryLimit("150")).toBe(2 * HISTORY_PAGE_SIZE);
    expect(parseHistoryLimit("200")).toBe(2 * HISTORY_PAGE_SIZE);
    expect(parseHistoryLimit("999999")).toBe(HISTORY_MAX_LIMIT);
  });
});

describe("parseHistoryRange", () => {
  it("accepts each offered range and defaults everything else to 30 days", () => {
    for (const range of HISTORY_RANGES) {
      expect(parseHistoryRange(range.value)).toBe(range.value);
    }
    expect(DEFAULT_HISTORY_RANGE).toBe("30d");
    expect(parseHistoryRange(undefined)).toBe("30d");
    expect(parseHistoryRange("all")).toBe("30d");
    expect(parseHistoryRange("10y")).toBe("30d");
  });
});

describe("historyRangeStart", () => {
  it("counts whole days back from now", () => {
    const day = 24 * 60 * MIN;
    expect(historyRangeStart("30d", now)).toEqual(new Date(now.getTime() - 30 * day));
    expect(historyRangeStart("1y", now)).toEqual(new Date(now.getTime() - 365 * day));
    expect(historyRangeStart("2y", now)).toEqual(new Date(now.getTime() - 730 * day));
  });
});

describe("historyHref", () => {
  it("is the bare path with nothing set", () => {
    expect(historyHref({ filter: "all" })).toBe("/admin/history");
  });

  it("keeps the search through tab switches and paging", () => {
    expect(historyHref({ filter: "cancelled", phone: "(619) 123-4567" })).toBe(
      "/admin/history?phone=%28619%29+123-4567&filter=cancelled"
    );
    expect(
      historyHref({ filter: "all", limit: 2 * HISTORY_PAGE_SIZE, phone: "6191234567" })
    ).toBe(`/admin/history?phone=6191234567&limit=${2 * HISTORY_PAGE_SIZE}`);
  });

  it("leaves out a limit that is just the default page", () => {
    expect(historyHref({ filter: "all", limit: HISTORY_PAGE_SIZE })).toBe("/admin/history");
  });

  it("carries a non-default range through every link, and omits the default", () => {
    expect(historyHref({ filter: "all", range: "30d" })).toBe("/admin/history");
    expect(
      historyHref({ filter: "cancelled", range: "1y", phone: "6191234567" })
    ).toBe("/admin/history?phone=6191234567&filter=cancelled&range=1y");
  });
});
