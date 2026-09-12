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

import {
  formatSmsClock,
  formatSmsTime,
  formatSmsTimeRange,
} from "./bookingSms";
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

/**
 * Push notification copy, for the admin's home-screen app.
 *
 * Structured rather than a single string, because a notification has real
 * fields: a bold `title`, a `body`, a tap target and a replacement `tag`. The
 * shape matches what `public/sw.js` reads and what `lib/webPush.ts` sends.
 *
 * Titles are kept to a few words on purpose — iOS truncates the title hard on
 * the lock screen, and the part worth seeing at a glance ("New booking") must
 * survive. The detail goes in the body, which gets two or three lines.
 *
 * `tag` is per booking, so re-sending an alert for the same appointment
 * replaces the earlier notification instead of stacking a second copy on the
 * lock screen.
 */
export type PushAlert = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Everything in the app taps through to the same place. */
const DASHBOARD_URL = "/admin/dashboard";

/**
 * Neither composer takes a `businessName`, unlike every other function in this
 * file. A notification is already labelled with the app that sent it — the icon
 * and the app name sit right above the title — so repeating the brand would
 * only eat the few characters iOS gives the title before truncating. The SMS
 * and Telegram versions need it because a text arrives from an unknown number.
 *
 * The tag is derived from `startTime`, which is `@unique` on `Booking` and so
 * identifies the appointment without needing the row id (which the notify
 * callers do not all have). New-booking and cancellation tags are kept distinct
 * so the two can sit side by side: being told a slot was booked *and* then
 * cancelled is information, not noise.
 */
function bookingTag(kind: string, startTime: Date): string {
  return `${kind}-${startTime.getTime()}`;
}

/** A new booking landed. */
export function newBookingPush(booking: AlertableBooking): PushAlert {
  return {
    title: `New booking · ${booking.clientName}`,
    body: [
      serviceLine(booking),
      formatSmsTime(booking.startTime),
      formatPhone(booking.clientPhone),
    ].join("\n"),
    url: DASHBOARD_URL,
    tag: bookingTag("new", booking.startTime),
  };
}

/** The client cancelled; the time is free again. */
export function clientCancelledPush(booking: AlertableBooking): PushAlert {
  return {
    title: `Cancelled · ${booking.clientName}`,
    body: [
      serviceLine(booking),
      formatSmsTime(booking.startTime),
      "That time is open again.",
    ].join("\n"),
    url: DASHBOARD_URL,
    tag: bookingTag("cancelled", booking.startTime),
  };
}

/* ------------------------------------------------------------------------- *
 * Group bookings
 *
 * Telegram and push have room the client's SMS does not, so these do list
 * every person with their own time — that is precisely the detail the admin
 * needs to work the block. One alert per group, never one per person.
 * ------------------------------------------------------------------------- */

/** A whole block: the legs, plus the totals a channel with room can afford. */
export type AlertableGroup = {
  startTime: Date;
  endTime: Date;
  clientName: string;
  clientPhone: string;
  /** One per person, in the order they will be seen. */
  legs: AlertableBooking[];
  totalDurationMinutes: number;
  totalPriceCents: number;
};

/** `5:00 PM · Haircut · 30 min · $25` — one person's line within the block. */
function legLine(leg: AlertableBooking): string {
  return `${formatSmsClock(leg.startTime)} · ${serviceLine(leg)}`;
}

/** The block's own summary line: when it runs, how long, what it's worth. */
function groupTotalsLine(group: AlertableGroup): string {
  const parts = [
    formatSmsTimeRange(group.startTime, group.endTime),
    formatDuration(group.totalDurationMinutes),
  ];

  if (group.totalPriceCents > 0) {
    parts.push(formatPrice(group.totalPriceCents));
  }

  return parts.join(" · ");
}

/** A group booked a block. */
export function newGroupBookingAlert(
  group: AlertableGroup,
  { businessName }: { businessName: string }
): string {
  return [
    `🆕 New group booking (${group.legs.length}) — ${businessName}`,
    "",
    group.clientName,
    formatPhone(group.clientPhone),
    "",
    ...group.legs.map(legLine),
    "",
    groupTotalsLine(group),
  ].join("\n");
}

/** The group cancelled; the whole block is free again. */
export function groupCancelledAlert(
  group: AlertableGroup,
  { businessName }: { businessName: string }
): string {
  return [
    `❌ Group cancelled (${group.legs.length}) — ${businessName}`,
    "",
    group.clientName,
    formatPhone(group.clientPhone),
    "",
    ...group.legs.map(legLine),
    "",
    groupTotalsLine(group),
    "",
    "That whole block is open again.",
  ].join("\n");
}

/**
 * Push for a new group. The tag reuses the first leg's `startTime`, which is
 * still `@unique`, so a group produces one notification rather than a stack.
 */
export function newGroupBookingPush(group: AlertableGroup): PushAlert {
  return {
    title: `New group booking (${group.legs.length})`,
    body: [
      group.clientName,
      groupTotalsLine(group),
      formatPhone(group.clientPhone),
    ].join("\n"),
    url: DASHBOARD_URL,
    tag: bookingTag("new", group.startTime),
  };
}

/** Push for a cancelled group. */
export function groupCancelledPush(group: AlertableGroup): PushAlert {
  return {
    title: `Group cancelled (${group.legs.length})`,
    body: [
      group.clientName,
      groupTotalsLine(group),
      "That whole block is open again.",
    ].join("\n"),
    url: DASHBOARD_URL,
    tag: bookingTag("cancelled", group.startTime),
  };
}
