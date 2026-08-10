/**
 * iCalendar (RFC 5545) generation and calendar-provider links.
 *
 * Hand-rolled rather than pulled from a package: the surface needed for a
 * single confirmed appointment is small, and the output has to be exactly
 * right for Apple Calendar, which rejects malformed files without saying why.
 *
 * Pure — no database, no `next/*`, no `Date.now()`. Every value comes from the
 * caller, so the same booking always produces a byte-identical file.
 */

export type CalendarEvent = {
  /** Stable across regenerations, so re-adding updates rather than duplicates. */
  uid: string;
  start: Date;
  durationMinutes: number;
  /** DTSTAMP. Pass a fixed value (e.g. the booking's createdAt), never `new Date()`. */
  stamp: Date;
  title: string;
  description: string;
  /** Free-text address. Omit (or leave empty) to emit no LOCATION at all. */
  location?: string;
  /** Minutes before the start to fire a reminder. Omit for no VALARM. */
  reminderMinutesBefore?: number;
};

/** RFC 5545 caps a content line at 75 octets before folding. */
const MAX_LINE_OCTETS = 75;

const PRODID = "-//Availo//Booking//EN";

/**
 * Formats an instant as an iCalendar UTC date-time: `20260812T233000Z`.
 *
 * Emitting UTC is what lets this module ignore DST entirely. `Booking.startTime`
 * is already a UTC instant, so there is no wall-clock time to resolve and no
 * VTIMEZONE block to ship — unlike everywhere else in this codebase, the
 * timezone problem simply doesn't arise here. Do not "improve" this into a
 * TZID-based local time.
 */
export function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * Escapes a value for an iCalendar TEXT property. Backslash goes first, or it
 * would double-escape the separators added after it.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line to 75 octets, continuing with a leading space.
 *
 * The limit is octets, not characters, and a fold must never land inside a
 * multi-byte sequence — an accented client name split down the middle produces
 * mojibake or an outright parse failure. Measuring the encoded length of each
 * code point keeps whole characters together.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;

  const parts: string[] = [];
  let current = "";
  let octets = 0;
  // A continuation line spends one octet on its leading space.
  let limit = MAX_LINE_OCTETS;

  // Iterating the string yields whole code points, so surrogate pairs stay intact.
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

/** Serializes an event as a complete .ics document, CRLF-terminated throughout. */
export function buildIcs(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    // PUBLISH, with no ORGANIZER or ATTENDEE, means "here is an event to keep".
    // METHOD:REQUEST plus an attendee would make Apple Mail treat this as a
    // meeting invitation demanding an RSVP, which is not what a client wants.
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(event.stamp)}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "SEQUENCE:0",
  ];

  // An empty LOCATION is worse than none: calendar apps render the field and
  // offer to map it, so a blank one is a dead "get directions" button.
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  if (event.reminderMinutesBefore !== undefined) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:-PT${event.reminderMinutesBefore}M`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // Trailing CRLF included: RFC 5545 terminates every content line, the last one
  // no differently.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * A "add this to Google Calendar" link. Google reads the same UTC form used in
 * the .ics, so no `ctz` parameter is needed — adding one would only reintroduce
 * the ambiguity that emitting UTC avoids.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsUtc(event.start)}/${toIcsUtc(end)}`,
    details: event.description,
  });

  // Same reasoning as LOCATION in the .ics — omit rather than send an empty one.
  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params}`;
}
