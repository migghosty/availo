/**
 * createBooking against a real Postgres.
 *
 * These cannot be unit tests: the behaviour most worth proving is that two
 * clients picking *different but overlapping* start times cannot both succeed.
 * That guarantee lives in Postgres' Serializable isolation, not in application
 * code, so mocking the database would test nothing.
 *
 * Runs against the throwaway container in docker-compose.yml. See
 * `npm run test:integration`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createBooking } from "./booking";
import { db } from "./db";
import { instantForDateMinute } from "./availability";
import { addDaysToDateKey, todayInTimezone } from "./timezone";
import { assertLocalDatabase } from "../test/database.mjs";

const HOUR = 60;

/** Comfortably inside the 30-day horizon and always in the future. */
const targetDate = addDaysToDateKey(todayInTimezone(), 3);
const at430pm = instantForDateMinute(targetDate, 16 * HOUR + 30);
const at445pm = instantForDateMinute(targetDate, 16 * HOUR + 45);
const at500pm = instantForDateMinute(targetDate, 17 * HOUR);

const client = { clientName: "Ada Lovelace", clientEmail: "ada@example.com" };

beforeAll(async () => {
  // The global setup already checked, but this file is the one issuing the
  // deletes — so it re-checks rather than trusting a caller.
  assertLocalDatabase(process.env.DATABASE_URL ?? "");

  await db.scheduleOverride.deleteMany();
  await db.scheduleRule.deleteMany();
  await db.settings.deleteMany();

  await db.settings.create({
    data: { id: 1, slotDurationMin: 30, slotIntervalMin: 15, bookingHorizonDays: 30 },
  });

  // Open 4–10 PM every day, so the test never depends on which weekday it runs.
  await db.scheduleRule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      startMinute: 16 * HOUR,
      endMinute: 22 * HOUR,
    })),
  });
});

beforeEach(async () => {
  await db.booking.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("createBooking", () => {
  it("persists a booking and returns a cancel token", async () => {
    const result = await createBooking({ start: at430pm, ...client });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cancelToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    const row = await db.booking.findUnique({ where: { cancelToken: result.cancelToken } });
    expect(row?.startTime.toISOString()).toBe(at430pm.toISOString());
    expect(row?.clientName).toBe("Ada Lovelace");
  });

  it("copies the duration from Settings so later changes don't resize it", async () => {
    const result = await createBooking({ start: at430pm, ...client });
    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.durationMinutes).toBe(30);
  });
});

describe("validation", () => {
  it("rejects a name shorter than two characters", async () => {
    const result = await createBooking({ start: at430pm, clientName: "A", clientEmail: "a@b.co" });

    expect(result).toMatchObject({ ok: false, code: "INVALID_NAME" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects a malformed email", async () => {
    for (const clientEmail of ["nope", "no@domain", "@example.com", "a b@example.com"]) {
      const result = await createBooking({ start: at430pm, clientName: "Ada", clientEmail });
      expect(result).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    }

    expect(await db.booking.count()).toBe(0);
  });

  it("trims the name and normalizes the email to lowercase", async () => {
    const result = await createBooking({
      start: at430pm,
      clientName: "  Ada Lovelace  ",
      clientEmail: "  ADA@Example.COM  ",
    });

    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.clientName).toBe("Ada Lovelace");
    expect(row?.clientEmail).toBe("ada@example.com");
  });
});

describe("availability is re-derived, never trusted", () => {
  it("rejects a start outside the day's hours", async () => {
    const elevenAm = instantForDateMinute(targetDate, 11 * HOUR);
    const result = await createBooking({ start: elevenAm, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects a start that is not on the interval grid", async () => {
    const offGrid = instantForDateMinute(targetDate, 16 * HOUR + 5);
    const result = await createBooking({ start: offGrid, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects a start in the past", async () => {
    const yesterday = instantForDateMinute(addDaysToDateKey(todayInTimezone(), -1), 16 * HOUR);
    const result = await createBooking({ start: yesterday, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects a start beyond the booking horizon", async () => {
    const tooFar = instantForDateMinute(addDaysToDateKey(todayInTimezone(), 40), 16 * HOUR);
    const result = await createBooking({ start: tooFar, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects an overlapping start after an existing booking", async () => {
    const first = await createBooking({ start: at430pm, ...client });
    expect(first.ok).toBe(true);

    // A different start time, so the unique index on startTime would not catch
    // this — 4:45 + 30min runs into the 4:30–5:00 appointment.
    const second = await createBooking({
      start: at445pm,
      clientName: "Grace Hopper",
      clientEmail: "grace@example.com",
    });

    expect(second).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db.booking.count()).toBe(1);
  });

  it("allows the next non-overlapping start", async () => {
    await createBooking({ start: at430pm, ...client });

    const next = await createBooking({
      start: at500pm,
      clientName: "Grace Hopper",
      clientEmail: "grace@example.com",
    });

    expect(next.ok).toBe(true);
    expect(await db.booking.count()).toBe(2);
  });
});

describe("concurrent double-booking", () => {
  it("lets exactly one of two overlapping simultaneous bookings win", async () => {
    // The scenario the Serializable transaction exists for. Both start times
    // are individually valid and distinct, so neither the unique index nor a
    // naive read-then-write check would prevent both from committing.
    const [a, b] = await Promise.all([
      createBooking({ start: at430pm, clientName: "Ada Lovelace", clientEmail: "ada@example.com" }),
      createBooking({ start: at445pm, clientName: "Grace Hopper", clientEmail: "grace@example.com" }),
    ]);

    const succeeded = [a, b].filter((result) => result.ok);
    expect(succeeded).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);

    // The loser must read as "taken", not as a crash — this is what the caller
    // shows the client.
    const loser = [a, b].find((result) => !result.ok);
    expect(loser).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("lets both through when the times do not overlap", async () => {
    const [a, b] = await Promise.all([
      createBooking({ start: at430pm, clientName: "Ada Lovelace", clientEmail: "ada@example.com" }),
      createBooking({ start: at500pm, clientName: "Grace Hopper", clientEmail: "grace@example.com" }),
    ]);

    expect([a.ok, b.ok]).toEqual([true, true]);
    expect(await db.booking.count()).toBe(2);
  });

  it("lets a burst of non-overlapping bookings all through", async () => {
    // The two-client case above is a weak detector: when commit-time conflicts
    // were being misclassified as fatal, it still passed ~72% of the time.
    // Six simultaneous bookers failed ~83% of rounds under the same bug, so
    // this is the case that actually guards the retry path.
    const starts = Array.from({ length: 6 }, (_, i) =>
      instantForDateMinute(targetDate, 16 * HOUR + i * 30)
    );

    const results = await Promise.all(
      starts.map((start, i) =>
        createBooking({
          start,
          clientName: "Ada Lovelace",
          clientEmail: `client${i}@example.com`,
        })
      )
    );

    // None of these overlap, so every one of them is genuinely free.
    expect(results.filter((result) => result.ok)).toHaveLength(starts.length);
    expect(await db.booking.count()).toBe(starts.length);
  });

  it("rejects the duplicate when both pick the identical start time", async () => {
    const [a, b] = await Promise.all([
      createBooking({ start: at430pm, clientName: "Ada Lovelace", clientEmail: "ada@example.com" }),
      createBooking({ start: at430pm, clientName: "Grace Hopper", clientEmail: "grace@example.com" }),
    ]);

    expect([a, b].filter((result) => result.ok)).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);
  });
});
