/**
 * Booking cancellation, shared by the three places that can trigger it.
 *
 * Cancelling used to be a bare `db.booking.delete` repeated in a REST route, a
 * Server Action and the admin route — with no shared helper, and the Server
 * Action deleting without reading the row first, so nothing was left to compose
 * a notification from. This is the same argument that put `createBooking` in one
 * place: the paths must not be able to behave differently.
 *
 * Deleting is all that's needed to free the time. Availability is computed from
 * the schedule minus existing bookings, so there is no slot flag to flip back.
 */

import { db } from "./db";
import { notifyBookingCancelled } from "./notifications";
import type { NotifiableBooking } from "./bookingSms";

export type CancelledBy = "client" | "admin";

export type CancelResult =
  | { ok: true; booking: NotifiableBooking }
  | { ok: false };

/** Either identifier works; the token is the client's, the id is the admin's. */
export type CancelTarget = { cancelToken: string } | { id: number };

/**
 * Reads the booking, deletes it, then tells whichever party did *not* cancel.
 *
 * The read has to happen first — after the delete there is nothing left to
 * build a message from.
 */
export async function cancelBooking(
  target: CancelTarget,
  cancelledBy: CancelledBy,
  { origin }: { origin?: string } = {}
): Promise<CancelResult> {
  const booking = await db.booking.findUnique({ where: target });
  if (!booking) return { ok: false };

  try {
    await db.booking.delete({ where: { id: booking.id } });
  } catch {
    // Someone cancelled it between the read and the delete.
    return { ok: false };
  }

  // Notification failure must never turn a completed cancellation into an
  // error — the appointment is already gone either way.
  await notifyBookingCancelled(booking, cancelledBy, { origin });

  return { ok: true, booking };
}
