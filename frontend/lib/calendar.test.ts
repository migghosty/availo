/**
 * iCalendar generation.
 *
 * These assertions are the only feedback loop that exists for this feature:
 * Apple Calendar rejects a malformed .ics silently, so a formatting mistake
 * here doesn't surface as an error, it surfaces as a client who never got the
 * appointment on their phone. The strict-format cases (CRLF, 75-octet folding,
 * TEXT escaping) matter as much as the date arithmetic.
 */

import { describe, expect, it } from "vitest";

import {
  buildIcs,
  escapeText,
  foldLine,
  googleCalendarUrl,
  toIcsUtc,
  type CalendarEvent,
} from "./calendar";

const BASE: CalendarEvent = {
  uid: "11111111-2222-3333-4444-555555555555@availo",
  // 4:30 PM PDT on Wed 12 Aug 2026.
  start: new Date("2026-08-12T23:30:00.000Z"),
  durationMinutes: 30,
  stamp: new Date("2026-08-09T18:00:00.000Z"),
  title: "Appointment at Availo",
  description: "Booked for Jamie.",
};

/** Content lines, unfolded — i.e. what a parser sees after rejoining. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").trimEnd().split("\r\n");
}

function octets(value: string): number {
  return new TextEncoder().encode(value).length;
}

describe("toIcsUtc", () => {
  it("renders an instant as a UTC date-time", () => {
    expect(toIcsUtc(new Date("2026-08-12T23:30:00.000Z"))).toBe("20260812T233000Z");
  });

  it("drops sub-second precision", () => {
    expect(toIcsUtc(new Date("2026-08-12T23:30:45.678Z"))).toBe("20260812T233045Z");
  });

  it("is unaffected by the runtime's own timezone", () => {
    // The value is derived from the instant, not from local wall time, so no
    // TZ environment variable can shift it.
    const instant = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(toIcsUtc(instant)).toBe("20260101T000000Z");
  });
});

describe("escapeText", () => {
  it("escapes the RFC 5545 TEXT separators", () => {
    expect(escapeText("Smith, Jamie; the 3rd")).toBe("Smith\\, Jamie\\; the 3rd");
  });

  it("escapes backslashes without double-escaping the separators", () => {
    expect(escapeText("a\\b,c")).toBe("a\\\\b\\,c");
  });

  it("collapses every newline form to \\n", () => {
    expect(escapeText("one\ntwo\r\nthree\rfour")).toBe("one\\ntwo\\nthree\\nfour");
  });

  it("leaves colons alone — they are only special in property parameters", () => {
    expect(escapeText("https://availo.test/cancel/abc")).toBe(
      "https://availo.test/cancel/abc"
    );
  });
});

describe("foldLine", () => {
  it("leaves a short line untouched", () => {
    expect(foldLine("SUMMARY:Appointment")).toBe("SUMMARY:Appointment");
  });

  it("folds a long line with a leading space on each continuation", () => {
    const folded = foldLine(`DESCRIPTION:${"a".repeat(200)}`);
    const segments = folded.split("\r\n");

    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments.slice(1)) {
      expect(segment.startsWith(" ")).toBe(true);
    }
    for (const segment of segments) {
      expect(octets(segment)).toBeLessThanOrEqual(75);
    }
  });

  it("round-trips: unfolding restores the original line", () => {
    const original = `DESCRIPTION:${"x".repeat(300)}`;
    expect(foldLine(original).replace(/\r\n /g, "")).toBe(original);
  });

  it("never splits a multi-byte character", () => {
    // Every character is 3 octets, so a naive slice at 75 would land mid-sequence.
    const original = `SUMMARY:${"日".repeat(60)}`;
    const folded = foldLine(original);

    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe(original);
    for (const segment of folded.split("\r\n")) {
      expect(octets(segment)).toBeLessThanOrEqual(75);
    }
  });

  it("keeps a surrogate pair intact", () => {
    const original = `SUMMARY:${"😀".repeat(40)}`;
    const folded = foldLine(original);

    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe(original);
  });
});

describe("buildIcs", () => {
  it("emits the properties a calendar client requires", () => {
    const lines = unfold(buildIcs(BASE));

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("PRODID:-//Availo//Booking//EN");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain(`UID:${BASE.uid}`);
    expect(lines).toContain("DTSTAMP:20260809T180000Z");
    expect(lines).toContain("DTSTART:20260812T233000Z");
    expect(lines).toContain("SUMMARY:Appointment at Availo");
    expect(lines).toContain("END:VEVENT");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("derives DTEND from the duration", () => {
    expect(unfold(buildIcs(BASE))).toContain("DTEND:20260813T000000Z");
    expect(unfold(buildIcs({ ...BASE, durationMinutes: 60 }))).toContain(
      "DTEND:20260813T003000Z"
    );
  });

  it("publishes rather than invites", () => {
    const ics = buildIcs(BASE);
    // An ORGANIZER/ATTENDEE pair under METHOD:REQUEST would make Apple Mail
    // demand an RSVP instead of just saving the appointment.
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).not.toContain("ATTENDEE");
    expect(ics).not.toContain("ORGANIZER");
  });

  it("terminates every line with CRLF, including the last", () => {
    const ics = buildIcs(BASE);

    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // A bare LF anywhere would be a lone \n not preceded by \r.
    expect(/(?<!\r)\n/.test(ics)).toBe(false);
  });

  it("keeps every physical line within 75 octets", () => {
    const ics = buildIcs({
      ...BASE,
      description:
        "Booked for Jamie. Need to cancel? https://availo.example.com/cancel/11111111-2222-3333-4444-555555555555",
    });

    for (const line of ics.trimEnd().split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it("escapes user-supplied text inside the description", () => {
    const ics = buildIcs({ ...BASE, description: "Smith, Jamie\nSecond line" });
    expect(unfold(ics)).toContain("DESCRIPTION:Smith\\, Jamie\\nSecond line");
  });

  it("emits LOCATION only when there is an address", () => {
    expect(unfold(buildIcs({ ...BASE, location: "123 Main St" }))).toContain(
      "LOCATION:123 Main St"
    );

    // Absent and empty must both mean "no location": calendar apps render the
    // field and offer to map it, so a blank one is a dead directions button.
    expect(buildIcs(BASE)).not.toContain("LOCATION");
    expect(buildIcs({ ...BASE, location: "" })).not.toContain("LOCATION");
  });

  it("escapes and folds a long multi-line address", () => {
    const ics = buildIcs({
      ...BASE,
      location: "1600 Amphitheatre Parkway, Building 42; Suite 100\nMountain View, CA 94043",
    });

    expect(unfold(ics)).toContain(
      "LOCATION:1600 Amphitheatre Parkway\\, Building 42\\; Suite 100\\nMountain View\\, CA 94043"
    );
    for (const line of ics.trimEnd().split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it("keeps LOCATION inside the VEVENT, before any alarm", () => {
    const lines = unfold(
      buildIcs({ ...BASE, location: "123 Main St", reminderMinutesBefore: 60 })
    );

    const location = lines.findIndex((l) => l.startsWith("LOCATION:"));
    expect(location).toBeGreaterThan(lines.indexOf("BEGIN:VEVENT"));
    expect(location).toBeLessThan(lines.indexOf("BEGIN:VALARM"));
  });

  it("adds a VALARM only when a reminder is asked for", () => {
    const withAlarm = unfold(buildIcs({ ...BASE, reminderMinutesBefore: 60 }));
    expect(withAlarm).toContain("BEGIN:VALARM");
    expect(withAlarm).toContain("ACTION:DISPLAY");
    expect(withAlarm).toContain("TRIGGER:-PT60M");
    expect(withAlarm).toContain("END:VALARM");

    expect(buildIcs(BASE)).not.toContain("VALARM");
  });

  it("is deterministic, so re-downloading yields the identical file", () => {
    // Paired with a stable UID, this is what makes a second "add to calendar"
    // update the existing event instead of creating a duplicate.
    expect(buildIcs(BASE)).toBe(buildIcs(BASE));
  });

  it("balances every BEGIN with an END", () => {
    const lines = unfold(buildIcs({ ...BASE, reminderMinutesBefore: 60 }));
    const begins = lines.filter((line) => line.startsWith("BEGIN:"));
    const ends = lines.filter((line) => line.startsWith("END:"));

    expect(begins.map((line) => line.slice(6)).reverse()).toEqual(
      ends.map((line) => line.slice(4))
    );
  });
});

describe("buildIcs across a DST transition", () => {
  // Emitting UTC means the November PDT→PST switch cannot shift an appointment.
  // These are the same wall-clock hour on either side of it.
  it("holds 4:30 PM local the day before the switch", () => {
    // 4:30 PM PDT (UTC-7) on Sat 31 Oct 2026.
    const ics = buildIcs({ ...BASE, start: new Date("2026-10-31T23:30:00.000Z") });
    expect(unfold(ics)).toContain("DTSTART:20261031T233000Z");
    expect(unfold(ics)).toContain("DTEND:20261101T000000Z");
  });

  it("holds 4:30 PM local the day after the switch", () => {
    // 4:30 PM PST (UTC-8) on Sun 1 Nov 2026 — an hour later in UTC than above,
    // which is exactly right: the offset changed, the appointment didn't.
    const ics = buildIcs({ ...BASE, start: new Date("2026-11-02T00:30:00.000Z") });
    expect(unfold(ics)).toContain("DTSTART:20261102T003000Z");
    expect(unfold(ics)).toContain("DTEND:20261102T010000Z");
  });

  it("spans midnight UTC without corrupting the date", () => {
    const ics = buildIcs({
      ...BASE,
      start: new Date("2026-08-12T23:45:00.000Z"),
      durationMinutes: 30,
    });
    expect(unfold(ics)).toContain("DTEND:20260813T001500Z");
  });
});

describe("googleCalendarUrl", () => {
  it("targets the render template with a UTC date range", () => {
    const url = new URL(googleCalendarUrl(BASE));

    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20260812T233000Z/20260813T000000Z");
  });

  it("omits ctz — the dates are already unambiguous", () => {
    expect(new URL(googleCalendarUrl(BASE)).searchParams.has("ctz")).toBe(false);
  });

  it("sends the address as a location, or omits it entirely", () => {
    const withAddress = new URL(
      googleCalendarUrl({ ...BASE, location: "123 Main St, Springfield" })
    );
    expect(withAddress.searchParams.get("location")).toBe("123 Main St, Springfield");

    expect(new URL(googleCalendarUrl(BASE)).searchParams.has("location")).toBe(false);
    expect(
      new URL(googleCalendarUrl({ ...BASE, location: "" })).searchParams.has("location")
    ).toBe(false);
  });

  it("passes title and description through unescaped, but URL-encoded", () => {
    const url = new URL(
      googleCalendarUrl({ ...BASE, description: "Smith, Jamie\nCancel: /x?a=b" })
    );

    // iCalendar TEXT escaping is not applied here — a query parameter needs
    // percent-encoding, not backslashes.
    expect(url.searchParams.get("details")).toBe("Smith, Jamie\nCancel: /x?a=b");
    expect(url.toString()).not.toContain("\\,");
    expect(url.toString()).not.toContain(" ");
  });
});
