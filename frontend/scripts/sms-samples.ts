/**
 * Prints the exact text messages this app sends, for pasting into the A2P
 * 10DLC campaign registration form.
 *
 * Generated *through the real composers*, so the samples submitted to the
 * carriers can never drift from what actually goes out — a mismatch there is
 * the single most common reason a campaign is rejected.
 *
 *   npx tsx scripts/sms-samples.ts
 *
 * Reads nothing from the database: pass your business name as an argument so
 * this works before anything is configured.
 *
 *   npx tsx scripts/sms-samples.ts "Ada's Barbershop"
 */

import {
  adminClientCancelled,
  adminNewBooking,
  clientAdminCancelled,
  clientBookingConfirmed,
  type NotifiableBooking,
} from "../lib/bookingSms";

const businessName = process.argv[2] || "Availo";
const origin = process.argv[3] || "https://example.com";

const booking: NotifiableBooking = {
  startTime: new Date("2026-08-15T00:00:00.000Z"),
  serviceName: "Haircut",
  clientName: "Ada Lovelace",
  clientPhone: "+16195550123",
  cancelToken: "268bfd2b-0deb-436d-b212-1ffcb3e81766",
};

const address = "123 Main St, Springfield, CA 90210";

/** GSM-7 is 160 characters alone, 153 each once a message splits. */
function segments(message: string): number {
  return message.length <= 160 ? 1 : Math.ceil(message.length / 153);
}

function show(label: string, message: string) {
  const count = segments(message);
  console.log(`\n${"─".repeat(70)}`);
  console.log(`${label}  —  ${message.length} chars, ${count} segment${count === 1 ? "" : "s"}`);
  console.log("─".repeat(70));
  console.log(message);
}

console.log(`Sample messages for "${businessName}"`);
console.log("Paste these into the campaign's Sample Messages fields.");

show("1. To the client, on booking", clientBookingConfirmed(booking, { businessName, origin, address }));
show("2. To the business owner, on booking", adminNewBooking(booking, { businessName }));
show("3. To the business owner, when a client cancels", adminClientCancelled(booking, { businessName }));
show("4. To the client, when the business cancels", clientAdminCancelled(booking, { businessName, origin }));

console.log(`\n${"═".repeat(70)}`);
console.log("OPT-IN — describe the flow, and point the opt-in URL at /sms-terms");
console.log("═".repeat(70));
console.log(`
Consent is collected on the booking form at ${origin}/book, where the
client enters their name and mobile number to book an appointment. Directly
beneath the phone field is an unchecked checkbox which the client must tick
before the form will submit. It reads:

  "Text me about this appointment. You'll get a confirmation and a message
   if anything changes - no marketing. Message and data rates may apply.
   Reply STOP to opt out. SMS Terms - Privacy"

"SMS Terms" and "Privacy" link to ${origin}/sms-terms and
${origin}/privacy. The consent timestamp is stored against the booking.

Messages are transactional only and relate to an appointment the client has
just booked. No marketing or promotional messages are sent.
`);

console.log("═".repeat(70));
console.log("HELP / STOP replies (Twilio answers these automatically)");
console.log("═".repeat(70));
console.log(`
HELP: ${businessName}: Reply STOP to stop receiving appointment texts.
      For help, see ${origin}/sms-terms

STOP: You have been unsubscribed and will receive no further messages.
`);
