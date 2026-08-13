/**
 * Booking → calendar event mapping.
 *
 * This is where the client-facing copy and the reminder decision live, and
 * where the cancel URL becomes absolute. A relative link here would ship a dead
 * link inside every calendar event.
 */

import { describe, expect, it } from "vitest";

import { toCalendarEvent, type BookableEvent } from "./bookingEvent";
import { buildIcs } from "./calendar";

const BOOKING: BookableEvent = {
  // 4:30 PM PDT on Wed 12 Aug 2026.
  startTime: new Date("2026-08-12T23:30:00.000Z"),
  durationMinutes: 30,
  serviceName: "Haircut",
  clientName: "Jamie Smith",
  cancelToken: "11111111-2222-3333-4444-555555555555",
  createdAt: new Date("2026-08-09T18:00:00.000Z"),
};

const ORIGIN = "https://availo.example.com";
/** Injected now that the trading name lives in Settings, not a constant. */
const BRAND = "Ada's Barbershop";

describe("toCalendarEvent", () => {
  it("carries the booking's own duration, not the service's current one", () => {
    // Booking.durationMinutes is snapshotted at booking time, so an admin
    // relengthening the service later must not resize a confirmed appointment.
    const event = toCalendarEvent({ ...BOOKING, durationMinutes: 60 }, { origin: ORIGIN, businessName: BRAND });
    expect(event.durationMinutes).toBe(60);
  });

  it("derives a stable UID from the cancel token", () => {
    expect(toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND }).uid).toBe(
      "11111111-2222-3333-4444-555555555555@availo"
    );
  });

  it("stamps from createdAt so the file never changes between downloads", () => {
    expect(toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND }).stamp).toEqual(BOOKING.createdAt);
  });

  it("names the service in the title", () => {
    expect(toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND }).title).toBe("Haircut at Ada's Barbershop");
  });

  it("falls back to a generic title when the service snapshot is empty", () => {
    // Bookings made before a service was required carry "".
    expect(
      toCalendarEvent({ ...BOOKING, serviceName: "" }, { origin: ORIGIN, businessName: BRAND }).title
    ).toBe("Appointment at Ada's Barbershop");
  });

  it("asks for a one-hour reminder", () => {
    expect(toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND }).reminderMinutesBefore).toBe(60);
  });

  it("builds an absolute cancel link", () => {
    const { description } = toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND });
    expect(description).toContain(
      "https://availo.example.com/cancel/11111111-2222-3333-4444-555555555555"
    );
  });

  it("names the client and states the time in the business timezone", () => {
    const { description } = toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND });

    expect(description).toContain("Jamie Smith");
    // Pacific, regardless of the machine running this — 23:30 UTC is 4:30 PM PDT.
    expect(description).toContain("4:30 PM PDT");
    expect(description).toContain("30 min");
  });

  it("reports Pacific standard time on the winter side of the DST switch", () => {
    const { description } = toCalendarEvent(
      { ...BOOKING, startTime: new Date("2026-11-02T00:30:00.000Z") },
      { origin: ORIGIN, businessName: BRAND }
    );
    expect(description).toContain("4:30 PM PST");
  });

  it("survives a client name containing iCalendar separators", () => {
    const ics = buildIcs(
      toCalendarEvent({ ...BOOKING, clientName: "O'Neil, Jr.; Sam" }, { origin: ORIGIN, businessName: BRAND })
    );
    const unfolded = ics.replace(/\r\n /g, "");

    expect(unfolded).toContain("Booked for O'Neil\\, Jr.\\; Sam.");
  });

  it("passes the admin's address through as the event location", () => {
    const event = toCalendarEvent(BOOKING, {
      origin: ORIGIN,
      businessName: BRAND,
      address: "123 Main St\nSpringfield, CA 90210",
    });
    expect(event.location).toBe("123 Main St\nSpringfield, CA 90210");
  });

  it("leaves the location undefined when no address is set", () => {
    // An empty LOCATION renders as a dead "get directions" button, so the
    // field has to be absent rather than blank.
    expect(toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND }).location).toBeUndefined();
    expect(
      toCalendarEvent(BOOKING, { origin: ORIGIN, businessName: BRAND, address: "" })
        .location
    ).toBeUndefined();
  });

  it("escapes an address containing iCalendar separators", () => {
    const ics = buildIcs(
      toCalendarEvent(BOOKING, {
        origin: ORIGIN,
        businessName: BRAND,
        // Commas are unavoidable in an address; the suite separator adds a semicolon.
        address: "123 Main St, Suite 4; rear entrance\nSpringfield, CA",
      })
    );

    expect(ics.replace(/\r\n /g, "")).toContain(
      "LOCATION:123 Main St\\, Suite 4\\; rear entrance\\nSpringfield\\, CA"
    );
  });
});
