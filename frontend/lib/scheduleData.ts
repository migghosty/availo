/**
 * Server-side loaders for everything the availability engine needs.
 *
 * Both the client-facing pages and the booking endpoint go through here, so
 * what a client is shown and what the server will accept are derived from
 * exactly the same inputs.
 */

import { db } from "./db";
import type {
  AvailabilityConfig,
  BookingLike,
  ScheduleOverrideLike,
  ScheduleRuleLike,
} from "./availability";
import type { PrismaClient } from "@/app/generated/prisma/client";

export const DEFAULT_CONFIG: AvailabilityConfig = {
  slotDurationMin: 30,
  slotIntervalMin: 15,
  bookingHorizonDays: 30,
};

/** Any Prisma client or interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function getConfig(client: Db = db): Promise<AvailabilityConfig> {
  const settings = await client.settings.findFirst();
  if (!settings) return DEFAULT_CONFIG;

  return {
    slotDurationMin: settings.slotDurationMin,
    slotIntervalMin: settings.slotIntervalMin,
    bookingHorizonDays: settings.bookingHorizonDays,
  };
}

export async function getScheduleRules(client: Db = db): Promise<ScheduleRuleLike[]> {
  return client.scheduleRule.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    select: { dayOfWeek: true, startMinute: true, endMinute: true },
  });
}

export async function getOverrides(client: Db = db): Promise<ScheduleOverrideLike[]> {
  const rows = await client.scheduleOverride.findMany({
    include: { windows: { orderBy: { startMinute: "asc" } } },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    date: row.date,
    isClosed: row.isClosed,
    windows: row.windows.map((w) => ({
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    })),
  }));
}

/**
 * Bookings that could conflict with an upcoming candidate. Reaches back a day
 * so a long appointment that started before "now" still blocks correctly.
 */
export async function getRelevantBookings(client: Db = db): Promise<BookingLike[]> {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return client.booking.findMany({
    where: { startTime: { gte: from } },
    orderBy: { startTime: "asc" },
    select: { startTime: true, durationMinutes: true },
  });
}

export type AvailabilityInputs = {
  config: AvailabilityConfig;
  rules: ScheduleRuleLike[];
  overrides: ScheduleOverrideLike[];
  bookings: BookingLike[];
};

export async function loadAvailabilityInputs(client: Db = db): Promise<AvailabilityInputs> {
  const [config, rules, overrides, bookings] = await Promise.all([
    getConfig(client),
    getScheduleRules(client),
    getOverrides(client),
    getRelevantBookings(client),
  ]);

  return { config, rules, overrides, bookings };
}
