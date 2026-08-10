/**
 * Server-side loader for business details on the single `Settings` row.
 *
 * Kept out of `scheduleData.ts` on purpose: the address has nothing to do with
 * computing bookable times, and putting it there would widen
 * `AvailabilityConfig` for every caller that only wants the schedule.
 */

import { db } from "./db";

/** Empty string means the admin hasn't set one — callers should omit the field. */
export async function getBusinessAddress(): Promise<string> {
  const settings = await db.settings.findFirst({ select: { address: true } });
  return settings?.address ?? "";
}
