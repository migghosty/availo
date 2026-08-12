/**
 * Turns a Booking row into the calendar event a client sees.
 *
 * The single place event copy is written, so the .ics file and the Google
 * Calendar link can't drift apart on wording, duration or reminder.
 */

import type { CalendarEvent } from "./calendar";
import { BUSINESS_TIMEZONE } from "./timezone";

/**
 * No business name is stored anywhere yet — `Settings` holds only scheduling
 * knobs — so this matches the brand in `app/(public)/layout.tsx`. One constant
 * to change if a name ever lands in the database.
 */
export const BUSINESS_LABEL = "Availo";

/**
 * "Haircut at Availo" beats "Appointment at Availo" in a crowded calendar.
 * Falls back to the generic title for bookings made before a service was
 * required, whose snapshot is empty.
 */
export function eventTitle(serviceName: string): string {
  const service = serviceName.trim();
  return `${service || "Appointment"} at ${BUSINESS_LABEL}`;
}

/** Long enough to leave for a local appointment, short enough not to be noise. */
const REMINDER_MINUTES_BEFORE = 60;

/** The fields of a Booking a calendar event actually needs. */
export type BookableEvent = {
  startTime: Date;
  durationMinutes: number;
  serviceName: string;
  clientName: string;
  cancelToken: string;
  createdAt: Date;
};

function formatBusinessTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function toCalendarEvent(
  booking: BookableEvent,
  { origin, address = "" }: { origin: string; address?: string }
): CalendarEvent {
  // The business time is spelled out even though the calendar already shows a
  // time: a client whose phone is in another timezone sees the converted hour on
  // the event and the shop's actual hour here.
  const description = [
    `Booked for ${booking.clientName}.`,
    `${formatBusinessTime(booking.startTime)} · ${booking.durationMinutes} min`,
    `Need to cancel? ${origin}/cancel/${booking.cancelToken}`,
  ].join("\n\n");

  return {
    // Stable across regenerations, so adding the same booking twice updates the
    // existing event rather than creating a duplicate.
    uid: `${booking.cancelToken}@availo`,
    start: booking.startTime,
    durationMinutes: booking.durationMinutes,
    // Fixed to the booking, not the moment of download, so the file is
    // byte-identical every time it's fetched.
    stamp: booking.createdAt,
    title: eventTitle(booking.serviceName),
    description,
    // The admin may not have set one; `buildIcs` then omits LOCATION entirely.
    location: address || undefined,
    reminderMinutesBefore: REMINDER_MINUTES_BEFORE,
  };
}
