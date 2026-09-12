/**
 * Resolves a list of service ids into the services themselves.
 *
 * The group-sized sibling of `getBookableService`, and held to the same
 * contract: **all or nothing**. One archived or unknown id returns `null` for
 * the whole selection, so `/slots`, `/book/[start]` and `createBooking` all
 * bounce the client back to pick again rather than quietly booking a party of
 * three as a party of two.
 */

import { db } from "./db";
import {
  getBookableServicesByIds,
  type BookableService,
} from "./serviceData";
import { MAX_GROUP_SIZE } from "./selection";
import type { PrismaClient } from "@/app/generated/prisma/client";

/** Any Prisma client or interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * One entry per person, in the order they were chosen — duplicates preserved,
 * since three people wanting the same haircut is the common case and the order
 * decides who goes first.
 *
 * Takes an optional client so `createBooking` can run it on its transaction,
 * which is what makes "archived while the client sat on the form" a write-time
 * failure rather than a stale read.
 */
export async function loadSelection(
  ids: number[],
  client: Db = db
): Promise<BookableService[] | null> {
  if (ids.length === 0 || ids.length > MAX_GROUP_SIZE) return null;
  // Mirrors getBookableService's guard: a non-integer reaching Prisma's `in`
  // clause throws, and that throw would surface as a generic ERROR.
  if (ids.some((id) => !Number.isInteger(id))) return null;

  const found = await getBookableServicesByIds(ids, client);
  const byId = new Map(found.map((service) => [service.id, service]));

  const selection: BookableService[] = [];
  for (const id of ids) {
    const service = byId.get(id);
    if (!service) return null;
    selection.push(service);
  }

  return selection;
}
