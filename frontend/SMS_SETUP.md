# Getting text messages working

The app sends texts on booking and cancellation. The code is done; what's left is
account setup and carrier registration, which only you can do.

**Nothing breaks while you work through this.** With no credentials configured the app
runs normally and simply sends nothing.

---

## The short version

1. Create a Twilio account and buy a number.
2. Register a **Brand** and a **Campaign** (A2P 10DLC). This is the slow part — days, not
   minutes.
3. Attach your number to the campaign.
4. Set three environment variables in Vercel.
5. Set your business name and your phone number at `/admin/settings`.

---

## 1. Why registration is required

US carriers block or filter application-sent SMS from unregistered numbers. This is a
carrier rule, not a Twilio one — it applies to any provider you might use instead. Texts
may appear to send successfully and silently never arrive.

## 2. Brand: Standard or Sole Proprietor

| | Standard Brand | Sole Proprietor |
|---|---|---|
| Needs | An EIN / registered business | No EIN; verified by texting your personal mobile |
| Throughput | Much higher | ~1 message/second, low daily cap |
| Cost | ~$4 one-time + ~$10/mo campaign | ~$4 one-time + ~$2/mo campaign |
| Approval | Usually faster | Extra verification step |

For a single barbershop either works. The Sole Proprietor cap is generous relative to a
few bookings a day.

## 3. Campaign details to submit

- **Use case:** Customer Care, or Mixed. These are appointment confirmations, not marketing.
- **Sample messages:** run the generator, don't retype them —

  ```bash
  cd frontend
  npx tsx scripts/sms-samples.ts "Your Business Name" "https://your-domain.com"
  ```

  It prints all four messages **through the same code that sends them**, so what you submit
  and what you send can't diverge. Submitting samples that don't match is the most common
  rejection reason.

- **Opt-in flow:** the same command prints a description of the consent checkbox, worded to
  match what the form actually shows.
- **Opt-in URL:** `https://your-domain.com/sms-terms`
- **Privacy policy URL:** `https://your-domain.com/privacy`

Reviewers open those two pages. They are built and linked from the footer of every public
page — but they are **boilerplate, not legal advice**. Read them and adjust before you
submit; have a lawyer look if you want certainty.

## 4. Attach the number to the campaign

Easy to miss. Buying a number and getting a campaign approved is not enough — the number
has to be added to the messaging service tied to that campaign, or sends still fail.

## 5. Environment variables

Set in Vercel (Production, and Preview if you want to test there), and in
`frontend/.env.local` for local work:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

`TWILIO_AUTH_TOKEN` does double duty: it signs outbound requests *and* verifies that
inbound webhook calls really came from Twilio. Without it the webhook rejects everything.

## 6. Point the inbound webhook at the app

In the Twilio console, set the number's **"A message comes in"** webhook to:

```
https://your-domain.com/api/sms/inbound   (HTTP POST)
```

Twilio already handles STOP and HELP replies on its own; this webhook only lets the app
*know*, so the dashboard can show "opted out of texts" beside a client instead of them
appearing to be ignored. Every request is signature-checked and unsigned ones are refused.

## 7. Settings in the app

At `/admin/settings`:

- **Business name** — must match the brand you registered. It appears in every text, the
  site header, calendar events and the policy pages.
- **Your phone number** — where booking and cancellation alerts go. Leave it blank to turn
  your own notifications off; clients still get theirs.
- **Address** — optional; included in the client's confirmation text when set.

---

## Testing before approval

A Twilio **trial account can only text numbers you have verified** in the console. That's
enough to test the whole flow end to end — verify your own mobile, book an appointment,
and watch the text arrive. Real clients can't be texted until the brand and campaign are
approved and the trial is upgraded.

To check the app's behaviour without any of that:

```bash
npm test                  # message composition, segment budget, signature validation
npm run test:integration   # consent, opt-out suppression, what reaches the wire
```

## When something doesn't arrive

Look in the server logs — every failure is logged with Twilio's own error code, and a
failed text never fails a booking.

| Symptom | Likely cause |
|---|---|
| `[sms] not configured, skipping` | The three env vars aren't set in that environment |
| `21608` | Trial account, and the recipient isn't a verified number |
| `21610` | That number replied STOP; it's opted out |
| `30034` | The number isn't registered to an approved 10DLC campaign |
| `20003` | Wrong account SID or auth token |
| Webhook returns 403 | `TWILIO_AUTH_TOKEN` missing, or the webhook URL in Twilio doesn't match the deployed URL exactly |
