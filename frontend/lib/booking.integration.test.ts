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

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createBooking } from "./booking";
import { cancelBooking } from "./cancellation";
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

const client = {
  clientName: "Ada Lovelace",
  clientPhone: "(619) 123-4567",
  smsConsent: true,
};

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
      clientPhone: "(619) 123-4567",
      smsConsent: true,
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_NAME" });
    expect(await db.booking.count()).toBe(0);
  });

  it("rejects a phone number it could not have stored", async () => {
    const malformed = [
      "nope",
      "12345",
      "619-123-456", // nine digits
      "+44 20 7946 0958", // not NANP
      "(019) 123-4567", // no area code starts with 0
      "",
    ];

    for (const clientPhone of malformed) {
      const result = await createBooking({
        start: at430pm,
        serviceId: haircut,
        clientName: "Ada",
        clientPhone,
        smsConsent: true,
      });
      expect(result).toMatchObject({ ok: false, code: "INVALID_PHONE" });
    }

    expect(await db.booking.count()).toBe(0);
  });

  it("trims the name and stores the phone number in canonical form", async () => {
    const result = await createBooking({
      start: at430pm,
      serviceId: haircut,
      clientName: "  Ada Lovelace  ",
      clientPhone: "  (619) 123-4567  ",
      smsConsent: true,
    });

    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.clientName).toBe("Ada Lovelace");
    expect(row?.clientPhone).toBe("+16191234567");
  });

  it("finds every spelling of one number under a single stored value", async () => {
    // The actual requirement, end to end: six clients typing the same number
    // six different ways must all be reachable by one lookup. A unit test can
    // prove the normalizer agrees with itself; only this proves the column
    // ends up holding one value that `/my-booking` can match exactly.
    const spellings = [
      "(619) 123-4567",
      "6191234567",
      "619-123-4567",
      "619.123.4567",
      "+1 (619) 123-4567",
      "1-619-123-4567",
    ];

    // Non-overlapping 30-minute starts, so availability never rejects one.
    for (const [i, clientPhone] of spellings.entries()) {
      const result = await createBooking({
        start: instantForDateMinute(targetDate, 16 * HOUR + i * 30),
        serviceId: haircut,
        clientName: "Ada Lovelace",
        clientPhone,
        smsConsent: true,
      });
      expect(result.ok).toBe(true);
    }

    const found = await db.booking.findMany({
      where: { clientPhone: "+16191234567" },
    });
    expect(found).toHaveLength(spellings.length);
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
      clientPhone: "(619) 987-6543",
      smsConsent: true,
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
      clientPhone: "(619) 987-6543",
      smsConsent: true,
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
      clientPhone: "(619) 987-6543",
      smsConsent: true,
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
        clientPhone: "(619) 123-4567",
        smsConsent: true,
      }),
      createBooking({
        start: at445pm,
        serviceId: haircut,
        clientName: "Grace Hopper",
        clientPhone: "(619) 987-6543",
        smsConsent: true,
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
        clientPhone: "(619) 123-4567",
        smsConsent: true,
      }),
      createBooking({
        start: at445pm,
        serviceId: eyebrows,
        clientName: "Grace Hopper",
        clientPhone: "(619) 987-6543",
        smsConsent: true,
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
        clientPhone: "(619) 123-4567",
        smsConsent: true,
      }),
      createBooking({
        start: at500pm,
        serviceId: haircut,
        clientName: "Grace Hopper",
        clientPhone: "(619) 987-6543",
        smsConsent: true,
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
          clientPhone: `619555${String(100 + i).padStart(4, "0")}`,
          smsConsent: true,
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
        clientPhone: "(619) 123-4567",
        smsConsent: true,
      }),
      createBooking({
        start: at430pm,
        serviceId: eyebrows,
        clientName: "Grace Hopper",
        clientPhone: "(619) 987-6543",
        smsConsent: true,
      }),
    ]);

    expect([a, b].filter((result) => result.ok)).toHaveLength(1);
    expect(await db.booking.count()).toBe(1);
  });
});

describe("notification failures never fail the booking", () => {
  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    vi.restoreAllMocks();
  });

  it("still books when the SMS provider is down", async () => {
    // The property the whole notification feature rests on. A committed
    // booking is a real appointment; a provider outage must never turn it into
    // an error the client sees.
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550000000";

    await db.settings.update({ where: { id: 1 }, data: { adminPhone: "+16195550100" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider is down"));

    const result = await createBooking({
      start: at430pm,
      serviceId: haircut,
      ...client,
      origin: "https://availo.example.com",
    });

    expect(result.ok).toBe(true);
    expect(await db.booking.count()).toBe(1);

    await db.settings.update({ where: { id: 1 }, data: { adminPhone: "" } });
  });
});

describe("cancellation", () => {
  it("cancels by the client's token and hands back the booking", async () => {
    const created = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await cancelBooking({ cancelToken: created.cancelToken }, "client");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The row is read before deletion precisely so a message can be composed
    // from it — after the delete there would be nothing left.
    expect(result.booking.clientName).toBe("Ada Lovelace");
    expect(result.booking.serviceName).toBe("Haircut");
    expect(await db.booking.count()).toBe(0);
  });

  it("cancels by id, which is how the admin does it", async () => {
    await createBooking({ start: at430pm, serviceId: haircut, ...client });
    const row = await db.booking.findFirst();

    const result = await cancelBooking({ id: row!.id }, "admin");

    expect(result.ok).toBe(true);
    expect(await db.booking.count()).toBe(0);
  });

  it("reports not-ok for a token that doesn't exist", async () => {
    const result = await cancelBooking(
      { cancelToken: "11111111-2222-3333-4444-555555555555" },
      "client"
    );

    expect(result.ok).toBe(false);
  });

  it("frees the time again", async () => {
    // Deleting is the whole mechanism — availability is computed, so there is
    // no slot flag to flip back.
    const created = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await cancelBooking({ cancelToken: created.cancelToken }, "client");

    const rebooked = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(rebooked.ok).toBe(true);
  });
});

describe("what actually gets sent", () => {
  afterEach(async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    vi.restoreAllMocks();
    await db.settings.update({
      where: { id: 1 },
      data: { adminPhone: "", address: "" },
    });
  });

  /** Captures the bodies Twilio would have received, keyed by recipient. */
  function captureSends(): Map<string, string> {
    const sent = new Map<string, string>();

    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550000000";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = (init as RequestInit).body as URLSearchParams;
      sent.set(body.get("To")!, body.get("Body")!);
      return new Response("{}", { status: 201 });
    });

    return sent;
  }

  it("puts the configured address in the client's confirmation", async () => {
    // The composer is unit-tested, but only this proves the address actually
    // travels from Settings through notifications.ts into the message body.
    await db.settings.update({
      where: { id: 1 },
      data: { address: "7787 Bloomfield Road, CA 92114" },
    });
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.get("+16191234567")).toContain("7787 Bloomfield Road, CA 92114");
  });

  it("leaves the address out when none is configured", async () => {
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    const message = sent.get("+16191234567")!;
    expect(message).toContain("Haircut");
    // booking line + opt-out notice; no address, and no origin passed here
    expect(message.split("\n")).toHaveLength(2);
    expect(message).not.toContain("Bloomfield");
  });

  it("texts both parties, but only the client gets the address", async () => {
    // The admin knows where their own shop is.
    await db.settings.update({
      where: { id: 1 },
      data: { adminPhone: "+16195550100", address: "7787 Bloomfield Road, CA 92114" },
    });
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.size).toBe(2);
    expect(sent.get("+16191234567")).toContain("Bloomfield");
    expect(sent.get("+16195550100")).not.toContain("Bloomfield");
    expect(sent.get("+16195550100")).toContain("Ada Lovelace");
  });
});

describe("SMS consent", () => {
  it("refuses to book without it", async () => {
    // Re-checked server-side because a checkbox is trivially removed from the
    // DOM, and this record is what has to hold up if a carrier ever asks.
    const result = await createBooking({
      start: at430pm,
      serviceId: haircut,
      clientName: "Ada Lovelace",
      clientPhone: "(619) 123-4567",
      smsConsent: false,
    });

    expect(result).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(await db.booking.count()).toBe(0);
  });

  it("records when it was given", async () => {
    const before = new Date();
    const result = await createBooking({ start: at430pm, serviceId: haircut, ...client });
    expect(result.ok).toBe(true);

    const row = await db.booking.findFirst();
    expect(row?.smsConsentAt).toBeInstanceOf(Date);
    expect(row!.smsConsentAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("opt-out suppression", () => {
  afterEach(async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    vi.restoreAllMocks();
    await db.smsOptOut.deleteMany();
    await db.settings.update({
      where: { id: 1 },
      data: { adminPhone: "", businessName: "Availo" },
    });
  });

  function captureSends(): Map<string, string> {
    const sent = new Map<string, string>();
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550000000";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = (init as RequestInit).body as URLSearchParams;
      sent.set(body.get("To")!, body.get("Body")!);
      return new Response("{}", { status: 201 });
    });

    return sent;
  }

  it("does not text a number that has opted out", async () => {
    // Twilio would refuse it anyway; skipping saves a pointless call and keeps
    // a misleading error out of the logs.
    await db.smsOptOut.create({ data: { phone: "+16191234567" } });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sent = captureSends();

    const result = await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(result.ok).toBe(true); // the booking is unaffected
    expect(sent.has("+16191234567")).toBe(false);
  });

  it("still texts the admin when the client has opted out", async () => {
    await db.smsOptOut.create({ data: { phone: "+16191234567" } });
    await db.settings.update({ where: { id: 1 }, data: { adminPhone: "+16195550100" } });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.has("+16191234567")).toBe(false);
    expect(sent.has("+16195550100")).toBe(true);
  });

  it("resumes once the opt-out is cleared", async () => {
    await db.smsOptOut.create({ data: { phone: "+16191234567" } });
    await db.smsOptOut.deleteMany({ where: { phone: "+16191234567" } });
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.has("+16191234567")).toBe(true);
  });

  it("puts the configured business name on the wire", async () => {
    // The carriers match this against the samples submitted at registration.
    await db.settings.update({
      where: { id: 1 },
      data: { businessName: "Ada's Barbershop" },
    });
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.get("+16191234567")).toContain("Ada's Barbershop");
    expect(sent.get("+16191234567")).not.toContain("Availo");
  });

  it("includes opt-out instructions in the confirmation", async () => {
    const sent = captureSends();

    await createBooking({ start: at430pm, serviceId: haircut, ...client });

    expect(sent.get("+16191234567")).toContain("Reply STOP to opt out.");
  });
});
