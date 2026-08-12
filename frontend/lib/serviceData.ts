/**
 * Server-side loaders for services.
 *
 * `getBookableService` is the single decision about what a client may book, so
 * the landing page, `/slots`, `/book/[start]` and `createBooking` cannot drift
 * apart about whether a service still exists — the same reason
 * `scheduleData.ts` is the one loader for availability inputs.
 */

import { db } from "./db";
import type { PrismaClient } from "@/app/generated/prisma/client";

/** Any Prisma client or interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** The fields the booking flow needs. Archived services are never returned. */
export type BookableService = {
  id: number;
  name: string;
  emoji: string;
  priceCents: number;
  durationMinutes: number;
};

const BOOKABLE_FIELDS = {
  id: true,
  name: true,
  emoji: true,
  priceCents: true,
  durationMinutes: true,
} as const;

/** Everything a client is allowed to book, in creation order. */
export async function getBookableServices(client: Db = db): Promise<BookableService[]> {
  return client.service.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: BOOKABLE_FIELDS,
  });
}

/**
 * One bookable service, or null if it doesn't exist or has been archived.
 * `createBooking` calls this inside its transaction, so a service archived
 * while a client sat on the booking form is caught at write time.
 */
export async function getBookableService(
  id: number,
  client: Db = db
): Promise<BookableService | null> {
  if (!Number.isInteger(id)) return null;

  return client.service.findFirst({
    where: { id, isActive: true },
    select: BOOKABLE_FIELDS,
  });
}

/** Admin view: archived services included, since the admin manages them. */
export async function getAllServices(client: Db = db) {
  return client.service.findMany({ orderBy: { id: "asc" } });
}
