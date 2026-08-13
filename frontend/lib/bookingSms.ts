/**
 * Turns a Booking into the text messages people actually receive.
 *
 * The single place notification copy is written, so the four messages can't
 * drift apart on tone or detail — the same reason `bookingEvent.ts` exists for
 * calendar copy. Pure: no database, no `next/*`, no network, so the same
 * booking always composes the same string and this stays in the fast unit tier.
 *
 * Two constraints shape every line below, and both cost real money to get wrong:
 *
 * 1. **Length.** A GSM-7 text is 160 characters, or 153 each once a message
 *    splits into segments. A cancel URL with a UUID eats ~69 of them on its own.
 *    Two segments is the budget; past that every message costs another send.
 *
 * 2. **Character set.** Anything outside GSM-7 flips the *entire* message to
 *    UCS-2, which halves the budget to 70 characters. That means plain ASCII
 *    only — no curly apostrophes, no em dashes, and none of the `·` separators
 *    used elsewhere in this codebase. `bookingSms.test.ts` guards this, because
 *    the failure is silent: the text still sends, it just costs double and may
 *    arrive truncated.
 */

import { formatPhone } from "./phone";
import { BUSINESS_TIMEZONE } from "./timezone";

/**
 * Options every message takes.
 *
 * `businessName` is injected rather than imported for the same reason `origin`
 * and `address` are — it lives in `Settings`, and this module may not reach for
 * the database. It is also what carriers match against the samples submitted
 * during A2P 10DLC registration, so it must be the admin's real trading name
 * rather than a constant compiled in.
 */
export type MessageContext = {
  businessName: string;
  origin?: string;
  address?: string;
};

/**
 * Carriers require an opt-out instruction. It rides on the confirmation — the
 * first message any number receives — and not on the cancellation notices,
 * which go to numbers that have already had it and where the segment budget is
 * tighter.
 */
const OPT_OUT_NOTICE = "Reply STOP to opt out.";

/** The fields of a Booking a notification needs. Narrow, like `BookableEvent`. */
export type NotifiableBooking = {
  startTime: Date;
  serviceName: string;
  clientName: string;
  clientPhone: string;
  cancelToken: string;
};

/**
 * "Wed, Aug 12 at 5:00 PM" — deliberately shorter than the calendar's
 * `formatBusinessTime`, which spells out the weekday, month and timezone. That
 * form costs ~35 characters against a 160-character budget, and a barber's
 * clients are all in the shop's timezone anyway, so the abbreviation loses
 * nothing a client needed.
 */
export function formatSmsTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    // Intl gives "Wed, Aug 12, 5:00 PM"; "at" reads better than a third comma.
    .replace(/,([^,]*)$/, " at$1");
}

/** Bookings predating required services carry an empty snapshot. */
function serviceLabel(serviceName: string): string {
  return serviceName.trim() || "appointment";
}

/**
 * Collapses a stored address onto one line.
 *
 * `normalizeAddress` keeps interior newlines because an address reads better
 * over two or three lines on a page. A text is different: the message is
 * already several lines (when / where / cancel link), so keeping the address to
 * one keeps those parts visually distinct instead of running together.
 */
function oneLineAddress(address: string): string {
  return address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Confirmation to the client — when, where, and how to get out of it.
 *
 * `origin` and `address` are injected rather than derived, matching
 * `toCalendarEvent`'s signature: `getOrigin()` reads request headers, which
 * would make `lib/booking.ts` request-bound and break the integration tests,
 * and the address is a database read. Either being absent drops its line
 * entirely rather than emitting a dangling label — the same treatment
 * `toCalendarEvent` gives an unset address.
 *
 * Note the address is the one part of this message whose length the admin
 * controls, and `MAX_ADDRESS_LENGTH` is 500. A long one pushes the text into
 * more segments; it is included in full anyway, since a truncated address is
 * worse than a slightly dearer message.
 */
export function clientBookingConfirmed(
  booking: NotifiableBooking,
  { businessName, origin, address = "" }: MessageContext
): string {
  const lines = [
    `${businessName}: You're booked for ${serviceLabel(booking.serviceName)} on ` +
      `${formatSmsTime(booking.startTime)}.`,
  ];

  const where = oneLineAddress(address);
  if (where) lines.push(where);

  if (origin) {
    lines.push(`Need to cancel? ${origin}/cancel/${booking.cancelToken}`);
  }

  lines.push(OPT_OUT_NOTICE);

  return lines.join("\n");
}

/**
 * Heads-up to the admin. Carries the client's number because calling them is
 * the action this message most often leads to. No opt-out notice: this goes to
 * the admin's own number, which is not an A2P recipient in the same sense.
 */
export function adminNewBooking(
  booking: NotifiableBooking,
  { businessName }: MessageContext
): string {
  return (
    `${businessName}: New booking. ${booking.clientName}, ` +
    `${serviceLabel(booking.serviceName)}, ${formatSmsTime(booking.startTime)}. ` +
    `${formatPhone(booking.clientPhone)}`
  );
}

/** The client cancelled; tell the admin the time is free again. */
export function adminClientCancelled(
  booking: NotifiableBooking,
  { businessName }: MessageContext
): string {
  return (
    `${businessName}: ${booking.clientName} cancelled ` +
    `${serviceLabel(booking.serviceName)} on ${formatSmsTime(booking.startTime)}. ` +
    `That time is open again.`
  );
}

/**
 * The admin cancelled; tell the client. Links to the landing page rather than
 * `/slots`, which needs a `?service=` to render anything.
 */
export function clientAdminCancelled(
  booking: NotifiableBooking,
  { businessName, origin }: MessageContext
): string {
  const lines = [
    `${businessName}: Your ${serviceLabel(booking.serviceName)} on ` +
      `${formatSmsTime(booking.startTime)} has been cancelled. Sorry about that.`,
  ];

  if (origin) {
    lines.push(`Book another time: ${origin}`);
  }

  return lines.join("\n");
}
