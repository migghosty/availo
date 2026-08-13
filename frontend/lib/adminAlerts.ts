/**
 * Admin alert copy, for channels that aren't SMS.
 *
 * The single place this wording lives, mirroring how `bookingSms.ts` owns text
 * copy and `bookingEvent.ts` owns calendar copy. Pure — no database, no
 * `next/*`, no network — so it stays in the fast unit tier.
 *
 * Deliberately separate from `bookingSms.ts` rather than shared with it,
 * because the two channels have opposite constraints:
 *
 *   SMS       160 characters per segment, GSM-7 only. An emoji anywhere flips
 *             the whole message to UCS-2 and halves the budget.
 *   Telegram  4,096 characters, any Unicode, free.
 *
 * So this file uses emoji and `·` freely, and those must **never** leak back
 * into `bookingSms.ts` — `bookingSms.test.ts` guards that side. The one thing
 * shared is `formatSmsTime`, a pure formatter whose compact output happens to
 * read well here too.
 *
 * Written as plain text with no markup: `lib/telegram.ts` sends without a
 * `parse_mode` precisely so user-controlled names and service titles can't
 * corrupt a message, and adding formatting characters here would undo that.
 */

import { formatSmsTime } from "./bookingSms";
import { formatPhone } from "./phone";
import { formatDuration, formatPrice } from "./service";

/**
 * What an alert needs. Wider than `NotifiableBooking`, because a channel with
 * room can afford to say how long the appointment is and what it's worth.
 */
export type AlertableBooking = {
  startTime: Date;
  serviceName: string;
  servicePriceCents: number;
  durationMinutes: number;
  clientName: string;
  clientPhone: string;
};

/** Bookings predating required services carry an empty snapshot. */
function serviceLabel(serviceName: string): string {
  return serviceName.trim() || "Appointment";
}

/**
 * `Haircut · 45 min · $25` — the service line. Price is omitted when a booking
 * predates the price snapshot, rather than claiming the service was free.
 */
function serviceLine(booking: AlertableBooking): string {
  const parts = [
    serviceLabel(booking.serviceName),
    formatDuration(booking.durationMinutes),
  ];

  if (booking.servicePriceCents > 0) {
    parts.push(formatPrice(booking.servicePriceCents));
  }

  return parts.join(" · ");
}

/**
 * A new booking landed.
 *
 * The client's number gets its own line: Telegram auto-links a bare phone
 * number, so this is what makes it tappable, and calling them is the action
 * this alert most often leads to.
 */
export function newBookingAlert(
  booking: AlertableBooking,
  { businessName }: { businessName: string }
): string {
  return [
    `🆕 New booking — ${businessName}`,
    "",
    booking.clientName,
    formatPhone(booking.clientPhone),
    "",
    serviceLine(booking),
    formatSmsTime(booking.startTime),
  ].join("\n");
}

/** The client cancelled; the time is free again. */
export function clientCancelledAlert(
  booking: AlertableBooking,
  { businessName }: { businessName: string }
): string {
  return [
    `❌ Cancelled by client — ${businessName}`,
    "",
    booking.clientName,
    formatPhone(booking.clientPhone),
    "",
    serviceLine(booking),
    formatSmsTime(booking.startTime),
    "",
    "That time is open again.",
  ].join("\n");
}
