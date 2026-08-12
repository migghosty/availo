/**
 * createBooking against a real Postgres.
 *
 * These cannot be unit tests: the behaviour most worth proving is that two
 * clients picking *different but overlapping* start times cannot both succeed.
 * That guarantee lives in Postgres' Serializable isolation, not in application
 * code, so mocking the database would test nothing.
 *
 * Per-service durations widen that problem rather than narrowing it — two
 * clients can now collide while booking different services of different
 * lengths — so the concurrency cases below deliberately mix lengths.
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
const at400pm = instantForDateMinute(targetDate, 16 * HOUR);
const at415pm = instantForDateMinute(targetDate, 16 * HOUR + 15);
const at430pm = instantForDateMinute(targetDate, 16 * HOUR + 30);
const at445pm = instantForDateMinute(targetDate, 16 * HOUR + 45);
const at500pm = instantForDateMinute(targetDate, 17 * HOUR);
/** 15 minutes before the 10 PM close: only a short service fits. */
const at945pm = instantForDateMinute(targetDate, 21 * HOUR + 45);

/** Assigned in beforeAll — ids are whatever the sequence hands out. */
let haircut: number; // 30 min, $25
let eyebrows: number; // 15 min, $10
let hairAndBeard: number; // 60 min, $40
let retired: number; // 30 min, archived

const client = { clientName: "Ada Lovelace", clientEmail: "ada@example.com" };

beforeAll(async () => {
  // The global setup already checked, but this file is the one issuing the
  // deletes — so it re-checks rather than trusting a caller.
  assertLocalDatabase(process.env.DATABASE_URL ?? "");

  await db.scheduleOverride.deleteMany();
  await db.scheduleRule.deleteMany();
  await db.settings.deleteMany();
  // Bookings first: the serviceId FK is ON DELETE RESTRICT.
  await db.booking.deleteMany();
  await db.service.deleteMany();

  await db.settings.create({
    data: { id: 1, slotIntervalMin: 15, bookingHorizonDays: 30 },
  });

  // Three live lengths plus an archived one, so every branch below has a
  // service that exercises it.
  const created = await Promise.all([
    db.service.create({
      data: { name: "Haircut", emoji: "✂️", priceCents: 2500, durationMinutes: 30 },
    }),
    db.service.create({
      data: { name: "Eyebrows", emoji: "✨", priceCents: 1000, durationMinutes: 15 },
    }),
    db.service.create({
      data: { name: "Hair & Beard", emoji: "💈", priceCents: 4000, durationMinutes: 60 },
    }),
    db.service.create({
      data: {
        name: "Hot Towel Shave",
        emoji: "🪒",
        priceCents: 3000,
        durationMinutes: 30,
        isActive: false,
      },
    }),
  ]);

  [haircut, eyebrows, hairAndBeard, retired] = created.map((service) => service.id);

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
  await db.booking.deleteMany();
  await db.service.deleteMany();
  await db.$disconnect();
});

describe("createBooking", () => {
  it("persists a booking and returns a cancel token", async () => {
    const result = await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cancelToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    const row = await db.booking.findUnique({ where: { cancelToken: result.cancelToken } });
    expect(row?.startTime.toISOString()).toBe(at430pm.toISOString());
    expect(row?.clientName).toBe("Ada Lovelace");
  });

  it("snapshots duration, name and price from the Service", async () => {
    const result = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.serviceId).toBe(haircut);
    expect(row?.durationMinutes).toBe(30);
    expect(row?.serviceName).toBe("Haircut");
    expect(row?.servicePriceCents).toBe(2500);
  });

  it("keeps the snapshot when the service is later renamed and repriced", async () => {
    // The reason the columns are copied rather than joined: a client's
    // confirmation and .ics must not silently change under them.
    const result = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(result.ok).toBe(true);

    await db.service.update({
      where: { id: haircut },
      data: { name: "Signature Cut", priceCents: 3500, durationMinutes: 45 },
    });

    const row = await db.booking.findFirst();
    expect(row?.serviceName).toBe("Haircut");
    expect(row?.servicePriceCents).toBe(2500);
    expect(row?.durationMinutes).toBe(30);

    await db.service.update({
      where: { id: haircut },
      data: { name: "Haircut", priceCents: 2500, durationMinutes: 30 },
    });
  });

  it("takes each service's own length", async () => {
    const result = await createBooking({ start: at400pm, serviceId: eyebrows, ...client });
    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.durationMinutes).toBe(15);
    expect(row?.serviceName).toBe("Eyebrows");
  });
});

describe("the service must exist and be bookable", () => {
  it("rejects an unknown serviceId", async () => {
    const result = await createBooking({ start: at430pm, serviceId: 999999, ...client });

    expect(result).toMatchObject({ ok: false, code: "INVALID_SERVICE" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects an archived service", async () => {
    // The lookup lives inside the transaction precisely so a service archived
    // while the client sat on the booking form is caught at write time.
    const result = await createBooking({ start: at430pm, serviceId: retired, ...client });

    expect(result).toMatchObject({ ok: false, code: "INVALID_SERVICE" });
    expect(await db.booking.count()).toBe(0);
  });
});

describe("validation", () => {
  it("rejects a name shorter than two characters", async () => {
    const result = await createBooking({
      start: at430pm,
      serviceId: haircut,
      clientName: "A",
      clientEmail: "a@b.co",
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_NAME" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects a malformed email", async () => {
    for (const clientEmail of ["nope", "no@domain", "@example.com", "a b@example.com"]) {
      const result = await createBooking({
        start: at430pm,
        serviceId: haircut,
        clientName: "Ada",
        clientEmail,
      });
      expect(result).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    }

    expect(await db.booking.count()).toBe(0);
  });

  it("trims the name and normalizes the email to lowercase", async () => {
    const result = await createBooking({
      start: at430pm,
      serviceId: haircut,
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
    const result = await createBooking({ start: elevenAm, serviceId: haircut, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects a start that is not on the interval grid", async () => {
    const offGrid = instantForDateMinute(targetDate, 16 * HOUR + 5);
    const result = await createBooking({ start: offGrid, serviceId: haircut, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects a start in the past", async () => {
    const yesterday = instantForDateMinute(addDaysToDateKey(todayInTimezone(), -1), 16 * HOUR);
    const result = await createBooking({ start: yesterday, serviceId: haircut, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects a start beyond the booking horizon", async () => {
    const tooFar = instantForDateMinute(addDaysToDateKey(todayInTimezone(), 40), 16 * HOUR);
    const result = await createBooking({ start: tooFar, serviceId: haircut, ...client });

    expect(result).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("rejects a start the service is too long to finish before closing", async () => {
    // The same instant, judged by the service: 9:45 PM + 60 min runs past the
    // 10 PM close, while + 15 min fits exactly.
    const tooLong = await createBooking({
      start: at945pm,
      serviceId: hairAndBeard,
      ...client,
    });
    expect(tooLong).toMatchObject({ ok: false, code: "UNAVAILABLE" });

    const fits = await createBooking({ start: at945pm, serviceId: eyebrows, ...client });
    expect(fits.ok).toBe(true);
  });

  it("rejects an overlapping start after an existing booking", async () => {
    const first = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(first.ok).toBe(true);

    // A different start time, so the unique index on startTime would not catch
    // this — 4:45 + 30min runs into the 4:30–5:00 appointment.
    const second = await createBooking({
      start: at445pm,
      serviceId: haircut,
      clientName: "Grace Hopper",
      clientEmail: "grace@example.com",
    });

    expect(second).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db.booking.count()).toBe(1);
  });

  it("allows the next non-overlapping start", async () => {
    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    const next = await createBooking({
      start: at500pm,
      serviceId: haircut,
      clientName: "Grace Hopper",
      clientEmail: "grace@example.com",
    });

    expect(next.ok).toBe(true);
    expect(await db.booking.count()).toBe(2);
  });

  it("packs a short service against a longer one with no gap", async () => {
    // The payoff of per-service durations: 15 minutes at 4:00 ends at 4:15,
    // which a 30-minute booking can start on exactly. Under one global
    // 30-minute length, 4:15 would not have been offered at all.
    const short = await createBooking({ start: at400pm, serviceId: eyebrows, ...client });
    expect(short.ok).toBe(true);

    const long = await createBooking({
      start: at415pm,
      serviceId: haircut,
      clientName: "Grace Hopper",
      clientEmail: "grace@example.com",
    });

    expect(long.ok).toBe(true);
    expect(await db.booking.count()).toBe(2);
  });
});

describe("concurrent double-booking", () => {
  it("lets exactly one of two overlapping simultaneous bookings win", async () => {
    // The scenario the Serializable transaction exists for. Both start times
    // are individually valid and distinct, so neither the unique index nor a
    // naive read-then-write check would prevent both from committing.
    const [a, b] = await Promise.all([
      createBooking({
        start: at430pm,
        serviceId: haircut,
        clientName: "Ada Lovelace",
        clientEmail: "ada@example.com",
      }),
      createBooking({
        start: at445pm,
        serviceId: haircut,
        clientName: "Grace Hopper",
        clientEmail: "grace@example.com",
      }),
    ]);

    const succeeded = [a, b].filter((result) => result.ok);
    expect(succeeded).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);

    // The loser must read as "taken", not as a crash — this is what the caller
    // shows the client.
    const loser = [a, b].find((result) => !result.ok);
    expect(loser).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("lets exactly one win when the two services are different lengths", async () => {
    // The widest overlap the app can produce: a 60-minute booking at 4:00 runs
    // to 5:00, so a 15-minute one at 4:45 collides — across two services whose
    // start times are 45 minutes apart.
    const [a, b] = await Promise.all([
      createBooking({
        start: at400pm,
        serviceId: hairAndBeard,
        clientName: "Ada Lovelace",
        clientEmail: "ada@example.com",
      }),
      createBooking({
        start: at445pm,
        serviceId: eyebrows,
        clientName: "Grace Hopper",
        clientEmail: "grace@example.com",
      }),
    ]);

    expect([a, b].filter((result) => result.ok)).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);
    expect([a, b].find((result) => !result.ok)).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
  });

  it("lets both through when the times do not overlap", async () => {
    const [a, b] = await Promise.all([
      createBooking({
        start: at430pm,
        serviceId: haircut,
        clientName: "Ada Lovelace",
        clientEmail: "ada@example.com",
      }),
      createBooking({
        start: at500pm,
        serviceId: haircut,
        clientName: "Grace Hopper",
        clientEmail: "grace@example.com",
      }),
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
          serviceId: haircut,
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
      createBooking({
        start: at430pm,
        serviceId: haircut,
        clientName: "Ada Lovelace",
        clientEmail: "ada@example.com",
      }),
      createBooking({
        start: at430pm,
        serviceId: eyebrows,
        clientName: "Grace Hopper",
        clientEmail: "grace@example.com",
      }),
    ]);

    expect([a, b].filter((result) => result.ok)).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);
  });
});
