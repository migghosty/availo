# Getting notifications working

Two independent channels, and you almost certainly want the first one only:

| | Who it reaches | Registration | Cost | Works |
|---|---|---|---|---|
| **Telegram** | You (the admin) | None | Free | Today, in ~2 minutes |
| **SMS** | Clients | A2P 10DLC, weeks | ~$19 + $2/mo | After approval |

**Nothing breaks while either is unconfigured.** The app runs normally and simply sends
nothing. Set Telegram up now; treat SMS as optional and later.

---

# 1. Telegram — your booking alerts

You get a push notification the moment someone books or cancels. No business entity, no
identity check, no carrier involved.

## Setup

1. **Create the bot.** In Telegram, message [@BotFather](https://t.me/BotFather) and send
   `/newbot`. Give it a name (anything) and a username ending in `bot`. It replies with a
   token like `8123456789:AAHx...`.
2. **Say hello to your bot.** Open `https://t.me/<your_bot_username>` and send it anything.
   **A bot cannot message you until you have messaged it first** — this step is not
   optional, and skipping it is the usual reason the next one comes back empty.
3. **Run the setup checker**, which finds your chat ID and tells you what's wrong if it
   can't:

   ```bash
   cd frontend
   npx tsx scripts/telegram-setup.ts <YOUR_TOKEN>
   ```

   It verifies the token, names which bot it belongs to, checks nothing else is consuming
   updates, and prints the `TELEGRAM_CHAT_ID` line to copy.
4. **Set two environment variables** in Vercel, and in `frontend/.env.local` for local work:

   ```
   TELEGRAM_BOT_TOKEN=8123456789:AAHx...
   TELEGRAM_CHAT_ID=123456789
   ```

   Re-run the checker with both set and it sends a test message, proving the whole path
   before you make a real booking.

Then restart the app, make a test booking, and the alert should arrive within a second.

> Doing it by hand instead? `https://api.telegram.org/bot<TOKEN>/getUpdates` returns
> `{"ok":true,"result":[]}` when the bot has received no messages. That empty result means
> step 2 hasn't happened — or that you messaged a *different* bot than the token belongs to,
> which the checker will spot and a browser won't.

## What you'll get

```
🆕 New booking — Ada's Barbershop

Ada Lovelace
(619) 123-4567

Haircut · 45 min · $25
Fri, Aug 14 at 5:00 PM
```

The phone number is tappable — Telegram auto-links it. You get the same for a client
cancellation, headed `❌ Cancelled by client`.

## Notes

- **Only you.** Clients aren't on Telegram and shouldn't have to be. They get the
  confirmation page and the "Add to calendar" button, which sets a reminder an hour before
  on their own phone.
- **If both channels are configured**, Telegram wins and no admin SMS is sent — one alert
  per event, never two.
- **Keep the token secret.** Anyone with it can send as your bot. If it leaks, `/revoke` in
  @BotFather.
- **Empty `getUpdates`?** Run `npx tsx scripts/telegram-setup.ts <TOKEN>` — it distinguishes
  the three causes (never messaged the bot, messaged the wrong bot, or a webhook consuming
  updates) that all look identical in a browser. Note updates also expire after 24 hours.

---

# 2. SMS to clients — optional, later

Only needed if you want *clients* texted. Your own alerts don't require any of this.

## The EIN thing

You don't need one. Twilio's **Sole Proprietor** brand exists exactly for individuals
without a tax ID — brands that *have* an EIN are explicitly ineligible for it. It asks for:

- your name, email, address (personal is fine)
- a "brand name", which can be your own name
- a mobile number for a one-time-password check (not the Twilio number)

Nor is toll-free an easier way round any more: as of **17 February 2026** Twilio requires a
business registration number for toll-free verification for every business type *except*
sole proprietorships. And switching providers doesn't help — 10DLC is a carrier rule
(T-Mobile, AT&T, Verizon), not a Twilio one.

## What it actually costs you

| | |
|---|---|
| Money | $4 brand + $15 campaign vetting, then $2/month |
| Time | Brand approves in minutes; **campaign vetting takes several weeks** (manual review) |
| Limits | 1 message/second, 3,000 segments/day, 1,000/day to T-Mobile, one phone number per campaign |

Those limits are roughly a thousand times more than a barbershop needs.

## Steps

1. Buy a number in Twilio.
2. Register a Sole Proprietor Brand, then a Campaign.
3. **Use case:** Customer Care, or Mixed. These are appointment confirmations, not marketing.
4. **Sample messages** — generate them, don't retype:

   ```bash
   cd frontend
   npx tsx scripts/sms-samples.ts "Your Business Name" "https://your-domain.com"
   ```

   This prints all four messages *through the same code that sends them*, plus an opt-in
   description matching the consent checkbox word for word. Submitting samples that don't
   match what you send is the most common rejection reason.
5. **Opt-in URL:** `https://your-domain.com/sms-terms` · **Privacy:**
   `https://your-domain.com/privacy`. Reviewers open both. They're boilerplate — read and
   adjust them before submitting.
6. **Attach the number to the campaign.** Easy to miss; sends fail without it.
7. Set three environment variables:

   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1...
   ```
8. Point the number's **"A message comes in"** webhook at
   `https://your-domain.com/api/sms/inbound` (HTTP POST) so the app learns who opts out.

The moment those three variables are set, the consent checkbox reappears on the booking
form and client texts start sending. No code change, no redeploy logic.

## Settings in the app

At `/admin/settings`:

- **Business name** — used in texts, alerts, the site header, calendar events and the policy
  pages. Match your registered brand.
- **Your phone number** — only used as the SMS fallback for admin alerts when Telegram
  isn't configured.
- **Address** — optional; included in the client's confirmation text.

## Testing before approval

A Twilio **trial account can only text numbers you've verified** in the console — enough to
test the whole flow with your own mobile.

---

# When something doesn't arrive

Every failure is logged with the provider's own error code, and a failed notification never
fails a booking.

| Log / symptom | Cause |
|---|---|
| `[telegram] not configured, skipping` | The two Telegram vars aren't set in that environment |
| `[telegram] send failed: 401` | Wrong bot token |
| `[telegram] send failed: 400 ... chat not found` | Wrong chat ID, or you never messaged the bot |
| `[sms] not configured, skipping` | The three Twilio vars aren't set |
| `21608` | Trial account, recipient not verified |
| `21610` | That number replied STOP |
| `30034` | Number not registered to an approved 10DLC campaign |
| `20003` | Wrong Twilio SID or auth token |
| Webhook returns 403 | `TWILIO_AUTH_TOKEN` missing, or the webhook URL doesn't exactly match the deployed one |
