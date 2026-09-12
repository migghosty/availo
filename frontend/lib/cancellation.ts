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
 *
 * **A group cancels whole.** A block of back-to-back appointments was booked by
 * one person as one decision, so any leg's token or id takes all of them —
 * leaving a gap in the middle of somebody's block would be a stranger outcome
 * than cancelling it. That is also why the admin's button has to say how many
 * it will remove; see `AdminCancelBookingButton`.
 */

import { db } from "./db";
import {
  notifyBookingCancelled,
  notifyGroupBookingCancelled,
} from "./notifications";
import type { AlertableBooking } from "./adminAlerts";
import type { NotifiableBooking } from "./bookingSms";

export type CancelledBy = "client" | "admin";

/** Everything either channel's copy needs: SMS is terse, Telegram is not. */
export type CancelledBooking = AlertableBooking & NotifiableBooking;

export type CancelResult =
  | {
      ok: true;
      /** The earliest leg — the whole booking, for a solo one. */
      booking: CancelledBooking;
      /** Every row removed, earliest first. Length 1 for a solo booking. */
      group: CancelledBooking[];
    }
  | { ok: false };

/** Either identifier works; the token is the client's, the id is the admin's. */
export type CancelTarget = { cancelToken: string } | { id: number };

/**
 * Reads the booking, deletes it — with its group, if it has one — then tells
 * whichever party did *not* cancel.
 *
 * The read has to happen first: after the delete there is nothing left to build
 * a message from.
 */
export async function cancelBooking(
  target: CancelTarget,
  cancelledBy: CancelledBy,
  { origin }: { origin?: string } = {}
): Promise<CancelResult> {
  const booking = await db.booking.findUnique({ where: target });
  if (!booking) return { ok: false };

  const group = booking.groupId
    ? await db.booking.findMany({
        where: { groupId: booking.groupId },
        orderBy: { startTime: "asc" },
      })
    : [booking];

  // Note this is `deleteMany`, which returns a count rather than throwing on a
  // missing row the way `delete` does. The `count === 0` test below is what
  // replaces that throw: without it, cancelling an already-cancelled booking
  // would report success and send a second cancellation text.
  const { count } = await db.booking.deleteMany({
    where: booking.groupId ? { groupId: booking.groupId } : { id: booking.id },
  });

  // Someone cancelled it between the read and the delete.
  if (count === 0) return { ok: false };

  // Notification failure must never turn a completed cancellation into an
  // error — the appointment is already gone either way. One message for the
  // whole block, never one per person.
  if (group.length === 1) {
    await notifyBookingCancelled(group[0], cancelledBy, { origin });
  } else {
    await notifyGroupBookingCancelled(group, cancelledBy, { origin });
  }

  return { ok: true, booking: group[0], group };
}
