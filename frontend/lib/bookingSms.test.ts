/**
 * Notification copy.
 *
 * Two of the assertions here guard failures that are completely silent in
 * production — the text still sends, it just costs double or arrives truncated:
 * a message drifting past two SMS segments, and a non-GSM-7 character flipping
 * the whole body to UCS-2 and halving the budget to 70. Neither shows up in a
 * log; both show up on the bill.
 */

import { describe, expect, it } from "vitest";

import {
  adminClientCancelled,
  adminGroupCancelled,
  adminNewBooking,
  adminNewGroupBooking,
  clientAdminCancelled,
  clientAdminGroupCancelled,
  clientBookingConfirmed,
  clientGroupBookingConfirmed,
  formatSmsTime,
  formatSmsTimeRange,
  summarizeServiceNames,
  type NotifiableBooking,
  type NotifiableGroup,
} from "./bookingSms";

const BOOKING: NotifiableBooking = {
  // 5:00 PM PDT on Wed 12 Aug 2026.
  startTime: new Date("2026-08-13T00:00:00.000Z"),
  serviceName: "Haircut",
  clientName: "Ada Lovelace",
  clientPhone: "+16191234567",
  cancelToken: "11111111-2222-3333-4444-555555555555",
};

const ORIGIN = "https://availo.example.com";
const ADDRESS = "7787 Bloomfield Road, CA 92114";
/** Injected into every message; the admin sets it, so it is never a constant. */
const CTX = { businessName: "Ada's Barbershop" };

/**
 * Two segments of a concatenated GSM-7 message. Single texts are 160, but
 * anything that splits drops to 153 per part.
 */
const TWO_SEGMENTS = 153 * 2;

/** GSM-7 basic set, near enough: printable ASCII plus newline. */
const GSM7_SAFE = /^[\x20-\x7E\n]*$/;

/**
 * The worst group a client can produce: the largest party, four distinct
 * admin-written service names at the length the admin UI allows, and the whole
 * block spanning into the evening. Every budget assertion runs against this,
 * not against a comfortable three-haircut case.
 */
const BIG_GROUP: NotifiableGroup = {
  startTime: new Date("2026-08-13T00:00:00.000Z"),
  // 5:00 PM + 3h45m.
  endTime: new Date("2026-08-13T03:45:00.000Z"),
  size: 4,
  serviceNames: [
    "Executive Cut and Hot Towel Shave",
    "Beard Sculpt and Line Up",
    "Full Colour and Style",
    "Scalp Treatment Deluxe",
  ],
  clientName: "Ada Lovelace",
  clientPhone: "+16191234567",
  cancelToken: "11111111-2222-3333-4444-555555555555",
};

const ALL_MESSAGES = () => [
  clientBookingConfirmed(BOOKING, { ...CTX, origin: ORIGIN, address: ADDRESS }),
  adminNewBooking(BOOKING, CTX),
  adminClientCancelled(BOOKING, CTX),
  clientAdminCancelled(BOOKING, { ...CTX, origin: ORIGIN }),
  // The group composers ride the same budget and character-set assertions
  // below, so adding one here is all it takes to cover it.
  clientGroupBookingConfirmed(BIG_GROUP, {
    ...CTX,
    origin: ORIGIN,
    address: ADDRESS,
  }),
  adminNewGroupBooking(BIG_GROUP, CTX),
  adminGroupCancelled(BIG_GROUP, CTX),
  clientAdminGroupCancelled(BIG_GROUP, { ...CTX, origin: ORIGIN }),
];

describe("formatSmsTime", () => {
  it("renders the business-local time compactly", () => {
    // Shorter than the calendar's format on purpose — every character competes
    // with the cancel URL for the same 160.
    expect(formatSmsTime(BOOKING.startTime)).toBe("Wed, Aug 12 at 5:00 PM");
  });

  it("uses the shop's timezone, not the server's", () => {
    // 00:00Z is the previous evening in America/Los_Angeles.
    expect(formatSmsTime(new Date("2026-08-13T00:00:00.000Z"))).toContain("Aug 12");
  });
});

describe("clientBookingConfirmed", () => {
  it("names the service and the time", () => {
    const message = clientBookingConfirmed(BOOKING, { ...CTX, origin: ORIGIN });
    expect(message).toContain("Haircut");
    expect(message).toContain("Wed, Aug 12 at 5:00 PM");
  });

  it("carries an absolute cancel link", () => {
    expect(clientBookingConfirmed(BOOKING, { ...CTX, origin: ORIGIN })).toContain(
      `${ORIGIN}/cancel/${BOOKING.cancelToken}`
    );
  });

  it("omits the cancel line entirely when no origin is given", () => {
    // Never a dangling "Need to cancel?" with no URL behind it.
    const message = clientBookingConfirmed(BOOKING, CTX);
    expect(message).not.toContain("cancel");
    expect(message).toContain("Haircut");
  });

  it("falls back to a generic word for a booking with no service snapshot", () => {
    const message = clientBookingConfirmed({ ...BOOKING, serviceName: "" }, CTX);
    expect(message).toContain("appointment");
  });

  it("tells the client where to go when an address is set", () => {
    // "Where?" is the next question after "when?", and a text is the thing
    // they'll actually have open on the way over.
    expect(clientBookingConfirmed(BOOKING, { ...CTX, address: ADDRESS })).toContain(ADDRESS);
  });

  it("omits the address line entirely when none is set", () => {
    const message = clientBookingConfirmed(BOOKING, { ...CTX, origin: ORIGIN });
    // booking line + cancel line + opt-out notice
    expect(message.split("\n")).toHaveLength(3);
  });

  it("collapses a multi-line address onto one line", () => {
    // Stored addresses keep their line breaks because that reads better on a
    // page; in a text it would collide with the cancel line below it.
    const message = clientBookingConfirmed(BOOKING, {
      ...CTX,
      address: "1600 Amphitheatre Parkway\nMountain View, CA 94043",
    });

    expect(message).toContain("1600 Amphitheatre Parkway, Mountain View, CA 94043");
    // booking line + address line + opt-out notice, no origin given
    expect(message.split("\n")).toHaveLength(3);
  });

  it("puts the address between the time and the cancel link", () => {
    const lines = clientBookingConfirmed(BOOKING, {
      ...CTX,
      origin: ORIGIN,
      address: ADDRESS,
    }).split("\n");

    expect(lines[0]).toContain("5:00 PM");
    expect(lines[1]).toBe(ADDRESS);
    expect(lines[2]).toContain("/cancel/");
  });
});

describe("adminNewBooking", () => {
  it("names the client, service and time", () => {
    const message = adminNewBooking(BOOKING, CTX);
    expect(message).toContain("Ada Lovelace");
    expect(message).toContain("Haircut");
    expect(message).toContain("Wed, Aug 12 at 5:00 PM");
  });

  it("includes the client's number in readable form", () => {
    // Calling them is the action this message usually leads to.
    expect(adminNewBooking(BOOKING, CTX)).toContain("(619) 123-4567");
  });
});

describe("cancellation messages", () => {
  it("tells the admin who cancelled and that the time reopened", () => {
    const message = adminClientCancelled(BOOKING, CTX);
    expect(message).toContain("Ada Lovelace");
    expect(message).toContain("Wed, Aug 12 at 5:00 PM");
    expect(message).toMatch(/open again/i);
  });

  it("tells the client their appointment is gone, with a way to rebook", () => {
    const message = clientAdminCancelled(BOOKING, { ...CTX, origin: ORIGIN });
    expect(message).toMatch(/cancelled/i);
    expect(message).toContain("Wed, Aug 12 at 5:00 PM");
    expect(message).toContain(ORIGIN);
  });

  it("omits the rebooking link when no origin is given", () => {
    expect(clientAdminCancelled(BOOKING, CTX)).not.toContain("http");
  });
});

describe("carrier requirements", () => {
  it("names the configured business, never a hardcoded brand", () => {
    // Carriers match sample messages against what actually gets sent, so this
    // has to be the admin's registered trading name.
    for (const message of ALL_MESSAGES()) {
      expect(message.startsWith("Ada's Barbershop:")).toBe(true);
      expect(message).not.toContain("Availo");
    }
  });

  it("puts opt-out instructions in the client's confirmation", () => {
    // Required on the first message a number receives, which for this app is
    // always the booking confirmation.
    expect(clientBookingConfirmed(BOOKING, { ...CTX, origin: ORIGIN })).toContain(
      "Reply STOP to opt out."
    );
  });

  it("keeps opt-out instructions off the follow-up messages", () => {
    // That number has already been told, and the budget is tighter here.
    expect(adminNewBooking(BOOKING, CTX)).not.toContain("STOP");
    expect(adminClientCancelled(BOOKING, CTX)).not.toContain("STOP");
    expect(clientAdminCancelled(BOOKING, { ...CTX, origin: ORIGIN })).not.toContain(
      "STOP"
    );
  });

  it("ends the confirmation with the opt-out line", () => {
    // Last, so truncation on an old handset eats the address before the
    // instruction a carrier requires.
    const lines = clientBookingConfirmed(BOOKING, {
      ...CTX,
      origin: ORIGIN,
      address: ADDRESS,
    }).split("\n");

    expect(lines[lines.length - 1]).toBe("Reply STOP to opt out.");
  });
});

describe("SMS budget", () => {
  it("keeps every message inside two segments", () => {
    for (const message of ALL_MESSAGES()) {
      expect(message.length).toBeLessThanOrEqual(TWO_SEGMENTS);
    }
  });

  it("stays inside two segments with a long name and service", () => {
    const wordy: NotifiableBooking = {
      ...BOOKING,
      clientName: "Bartholomew Featherstonehaugh",
      serviceName: "Hair & Beard with Hot Towel Finish",
    };

    const messages = [
      clientBookingConfirmed(wordy, { ...CTX, origin: ORIGIN, address: ADDRESS }),
      adminNewBooking(wordy, CTX),
      adminClientCancelled(wordy, CTX),
      clientAdminCancelled(wordy, { ...CTX, origin: ORIGIN }),
    ];

    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(TWO_SEGMENTS);
    }
  });

  it("still fits two segments with a long multi-line address", () => {
    // The address is the one part of this message whose length the admin
    // controls, so it's the one most likely to push a text into a third
    // segment. A realistically long one must not.
    const message = clientBookingConfirmed(BOOKING, {
      ...CTX,
      origin: ORIGIN,
      address: "1600 Amphitheatre Parkway, Building 42, Suite 100\nMountain View, CA 94043",
    });

    expect(message.length).toBeLessThanOrEqual(TWO_SEGMENTS);
  });

  it("uses only GSM-7 characters", () => {
    // An emoji or a curly apostrophe anywhere flips the entire message to
    // UCS-2 and cuts the budget to 70 characters. Note the service emoji is
    // deliberately not in any message — it isn't snapshotted onto Booking, and
    // adding it would break this.
    for (const message of ALL_MESSAGES()) {
      expect(message).toMatch(GSM7_SAFE);
    }
  });
});

describe("group messages", () => {
  it("renders a range with a plain hyphen", () => {
    // An en dash would read better and would flip the entire message to UCS-2,
    // halving its budget. The character matters more than the typography.
    const range = formatSmsTimeRange(BIG_GROUP.startTime, BIG_GROUP.endTime);

    expect(range).toBe("Wed, Aug 12 at 5:00 PM-8:45 PM");
    expect(range).not.toContain("–");
    expect(range).not.toContain("—");
  });

  it("collapses repeated services for the admin", () => {
    expect(summarizeServiceNames(["Haircut", "Haircut", "Eyebrows"])).toBe(
      "2x Haircut, Eyebrows"
    );
    expect(summarizeServiceNames(["Haircut"])).toBe("Haircut");
  });

  it("names how many people and the block's span, to the client", () => {
    const message = clientGroupBookingConfirmed(BIG_GROUP, {
      ...CTX,
      origin: ORIGIN,
    });

    expect(message).toContain("4 people");
    expect(message).toContain("Wed, Aug 12 at 5:00 PM-8:45 PM");
  });

  it("says the one cancel link takes the whole block", () => {
    const message = clientGroupBookingConfirmed(BIG_GROUP, {
      ...CTX,
      origin: ORIGIN,
    });

    // One link, not four. A client who thought it dropped only their own
    // appointment and lost the group's would be badly served.
    expect(message).toContain(`${ORIGIN}/cancel/${BIG_GROUP.cancelToken}`);
    expect(message.match(/\/cancel\//g)).toHaveLength(1);
    expect(message).toContain("cancels all 4");
  });

  it("leaves the service names out of the client's text", () => {
    // Four admin-written names are the one unbounded input here; the client
    // picked them a minute ago and the cancel page lists them in full.
    const message = clientGroupBookingConfirmed(BIG_GROUP, {
      ...CTX,
      origin: ORIGIN,
      address: ADDRESS,
    });

    for (const name of BIG_GROUP.serviceNames) {
      expect(message).not.toContain(name);
    }
  });

  it("does give the admin the service summary", () => {
    // With Telegram unconfigured this text is the only thing telling them what
    // work is coming.
    const message = adminNewGroupBooking(BIG_GROUP, CTX);

    expect(message).toContain("New group booking (4)");
    expect(message).toContain("Ada Lovelace");
    expect(message).toContain("(619) 123-4567");
  });

  it("carries the opt-out notice on the confirmation and nowhere else", () => {
    expect(
      clientGroupBookingConfirmed(BIG_GROUP, { ...CTX, origin: ORIGIN })
    ).toContain("Reply STOP to opt out.");
    expect(adminNewGroupBooking(BIG_GROUP, CTX)).not.toContain("STOP");
    expect(adminGroupCancelled(BIG_GROUP, CTX)).not.toContain("STOP");
  });

  it("leads with the injected business name, never a hardcoded one", () => {
    for (const message of [
      clientGroupBookingConfirmed(BIG_GROUP, { ...CTX, origin: ORIGIN }),
      adminNewGroupBooking(BIG_GROUP, CTX),
      adminGroupCancelled(BIG_GROUP, CTX),
      clientAdminGroupCancelled(BIG_GROUP, { ...CTX, origin: ORIGIN }),
    ]) {
      expect(message.startsWith(`${CTX.businessName}:`)).toBe(true);
      expect(message).not.toContain("Availo");
    }
  });

  it("fits two segments even for the worst group and a long address", () => {
    // The assertion that costs money when it fails. A 500-character address is
    // the admin's own doing, so this uses a long-but-realistic one.
    const message = clientGroupBookingConfirmed(BIG_GROUP, {
      ...CTX,
      origin: ORIGIN,
      address: "Suite 400, 7787 Bloomfield Road, San Diego, CA 92114",
    });

    expect(message.length).toBeLessThanOrEqual(TWO_SEGMENTS);
  });
});
