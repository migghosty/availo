/**
 * Admin alert copy.
 *
 * These go to a channel with 4,096 characters and full Unicode, so unlike the
 * SMS copy there is no segment budget or GSM-7 constraint to defend. What does
 * need defending is the opposite: alerts must stay *plain text*. They're sent
 * without a `parse_mode` precisely so user-controlled names and service titles
 * can't corrupt a message, and a stray markup character here would quietly undo
 * that.
 */

import { describe, expect, it } from "vitest";

import {
  clientCancelledAlert,
  clientCancelledPush,
  newBookingAlert,
  newBookingPush,
  type AlertableBooking,
} from "./adminAlerts";

const BOOKING: AlertableBooking = {
  // 5:00 PM PDT on Wed 12 Aug 2026.
  startTime: new Date("2026-08-13T00:00:00.000Z"),
  serviceName: "Haircut",
  servicePriceCents: 2500,
  durationMinutes: 45,
  clientName: "Ada Lovelace",
  clientPhone: "+16191234567",
};

const CTX = { businessName: "Ada's Barbershop" };

describe("newBookingAlert", () => {
  it("carries everything needed to act on the booking", () => {
    const alert = newBookingAlert(BOOKING, CTX);

    expect(alert).toContain("Ada Lovelace");
    expect(alert).toContain("Haircut");
    expect(alert).toContain("Wed, Aug 12 at 5:00 PM");
  });

  it("shows the phone number in a form Telegram will auto-link", () => {
    // A bare, readable number on its own line is what makes it tappable —
    // which is the action this alert most often leads to.
    expect(newBookingAlert(BOOKING, CTX).split("\n")).toContain("(619) 123-4567");
  });

  it("states the length and the price", () => {
    const alert = newBookingAlert(BOOKING, CTX);
    expect(alert).toContain("45 min");
    expect(alert).toContain("$25");
  });

  it("names the business", () => {
    expect(newBookingAlert(BOOKING, CTX)).toContain("Ada's Barbershop");
  });
});

describe("clientCancelledAlert", () => {
  it("says who cancelled what, and that the time reopened", () => {
    const alert = clientCancelledAlert(BOOKING, CTX);

    expect(alert).toContain("Ada Lovelace");
    expect(alert).toContain("Haircut");
    expect(alert).toContain("Wed, Aug 12 at 5:00 PM");
    expect(alert).toMatch(/open again/i);
  });

  it("is visibly distinct from a new booking at a glance", () => {
    // These arrive as push notifications and get read in a hurry; the first
    // line has to say which kind of event this is.
    expect(newBookingAlert(BOOKING, CTX).split("\n")[0]).toMatch(/new booking/i);
    expect(clientCancelledAlert(BOOKING, CTX).split("\n")[0]).toMatch(/cancelled/i);
  });
});

describe("degraded bookings", () => {
  it("falls back to a generic word when the service snapshot is empty", () => {
    const alert = newBookingAlert({ ...BOOKING, serviceName: "" }, CTX);
    expect(alert).toContain("Appointment");
  });

  it("omits the price rather than claiming a booking was free", () => {
    // Bookings predating the price snapshot carry 0.
    const alert = newBookingAlert({ ...BOOKING, servicePriceCents: 0 }, CTX);

    expect(alert).not.toContain("$0");
    expect(alert).toContain("45 min");
  });
});

describe("plain text only", () => {
  it("passes awkward names through verbatim", () => {
    // The exact case a Markdown or HTML parse_mode would have broken: this
    // must arrive as typed, not escaped, mangled or rejected.
    const awkward: AlertableBooking = {
      ...BOOKING,
      clientName: "O'Neil & Sons <test>",
      serviceName: "Hair & Beard *deluxe* _v2_",
    };

    const alert = newBookingAlert(awkward, CTX);

    expect(alert).toContain("O'Neil & Sons <test>");
    expect(alert).toContain("Hair & Beard *deluxe* _v2_");
    // No escaping was applied on the way through.
    expect(alert).not.toContain("\\");
    expect(alert).not.toContain("&amp;");
  });

  it("adds no markup of its own", () => {
    // If someone later reaches for bold or a link here, they'd also have to
    // add a parse_mode — and inherit the escaping problem this avoids.
    for (const alert of [newBookingAlert(BOOKING, CTX), clientCancelledAlert(BOOKING, CTX)]) {
      expect(alert).not.toMatch(/[*_`[\]]/);
      expect(alert).not.toMatch(/<\/?[a-z]+>/i);
    }
  });
});

/**
 * Push copy has a different shape and a different constraint from the text
 * alerts above: structured fields rather than one string, and a title iOS
 * truncates on the lock screen — so what must survive is the part worth seeing
 * at a glance.
 */
describe("push alerts", () => {
  it("leads with the event and the client, since the title is what survives truncation", () => {
    expect(newBookingPush(BOOKING).title).toBe("New booking · Ada Lovelace");
    expect(clientCancelledPush(BOOKING).title).toBe("Cancelled · Ada Lovelace");
  });

  it("keeps the title short enough to read on a lock screen", () => {
    for (const alert of [newBookingPush(BOOKING), clientCancelledPush(BOOKING)]) {
      expect(alert.title.length).toBeLessThanOrEqual(40);
    }
  });

  it("puts the detail in the body", () => {
    const alert = newBookingPush(BOOKING);

    expect(alert.body).toContain("Haircut");
    expect(alert.body).toContain("45 min");
    expect(alert.body).toContain("$25");
    expect(alert.body).toContain("Wed, Aug 12 at 5:00 PM");
    expect(alert.body).toContain("(619) 123-4567");
  });

  it("says the time reopened when a client cancels", () => {
    expect(clientCancelledPush(BOOKING).body).toContain("That time is open again.");
  });

  it("taps through to the dashboard", () => {
    expect(newBookingPush(BOOKING).url).toBe("/admin/dashboard");
    expect(clientCancelledPush(BOOKING).url).toBe("/admin/dashboard");
  });

  it("tags per appointment, so a repeat send replaces rather than stacks", () => {
    const other = { ...BOOKING, startTime: new Date("2026-08-14T00:00:00.000Z") };

    expect(newBookingPush(BOOKING).tag).toBe(newBookingPush(BOOKING).tag);
    expect(newBookingPush(BOOKING).tag).not.toBe(newBookingPush(other).tag);
  });

  it("keeps booking and cancellation tags distinct", () => {
    // Being told a slot was booked *and* then cancelled is information; a
    // shared tag would let the second silently overwrite the first.
    expect(newBookingPush(BOOKING).tag).not.toBe(clientCancelledPush(BOOKING).tag);
  });

  it("does not repeat the business name", () => {
    // The notification already arrives labelled with the app that sent it, and
    // the title has no room to spare.
    for (const alert of [newBookingPush(BOOKING), clientCancelledPush(BOOKING)]) {
      expect(`${alert.title} ${alert.body}`).not.toContain("Ada's Barbershop");
    }
  });
});
