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

/**
 * Where booking notifications are texted, in E.164. Empty means the admin
 * hasn't set one, and admin texts are then skipped rather than failing.
 */
export async function getAdminPhone(): Promise<string> {
  const settings = await db.settings.findFirst({ select: { adminPhone: true } });
  return settings?.adminPhone ?? "";
}

/**
 * The trading name clients see. Falls back to the app's own name rather than
 * an empty string — a text starting ": You're booked" would be worse than a
 * slightly generic one, and this value is never optional the way an address is.
 */
export async function getBusinessName(): Promise<string> {
  const settings = await db.settings.findFirst({ select: { businessName: true } });
  return settings?.businessName?.trim() || "Availo";
}
