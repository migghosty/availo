# Getting notifications working

Three independent channels. Set up the first, add the second if you want alerts on your
phone's lock screen, and treat the third as optional and later:

| | Who it reaches | Registration | Cost | Works |
|---|---|---|---|---|
| **Telegram** | You (the admin) | None | Free | Today, in ~2 minutes |
| **iPhone notifications** | You (the admin) | None | Free | Today, ~5 minutes |
| **SMS** | Clients | A2P 10DLC, weeks | ~$19 + $2/mo | After approval |

**Nothing breaks while any of them is unconfigured.** The app runs normally and simply
sends nothing.

Telegram and iPhone notifications both reach you, and that is on purpose — you get both
for the same booking. Apple's notifications can stop arriving silently (see the caveat in
section 2), so Telegram stays the channel that always fires and the phone notification is
the faster, nicer-looking copy.

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

# 2. iPhone notifications — your booking alerts on the lock screen

Real notifications on your phone: banner on the lock screen, badge on the icon, tap to
open straight to the dashboard. **No App Store, no app to publish, no Apple developer
account** — it is the same website, installed to your home screen.

## The one thing to understand first

Apple only allows notifications for a site that has been **added to the home screen**, and
only when you open it *from that icon*. Opening the same URL in Safari gives you no way to
turn them on — the page will tell you so rather than showing a dead button. This is Apple's
rule, not a limitation of the app.

You also need **iOS 16.4 or later**, and the site must be on **https** — a real deployment,
not `npm run dev` over your Wi-Fi.

## Setup

### On the server, once

Generate a key pair (VAPID keys — they identify this app to Apple's push service):

```bash
cd frontend
npx web-push generate-vapid-keys
```

Set three variables wherever the app runs:

```
VAPID_PUBLIC_KEY=<the public key it printed>
VAPID_PRIVATE_KEY=<the private key it printed>
VAPID_SUBJECT=mailto:you@example.com
```

Locally that's `frontend/.env.local`. On Vercel:

```bash
vercel env add VAPID_PUBLIC_KEY production
vercel env add VAPID_PRIVATE_KEY production
vercel env add VAPID_SUBJECT production
```

**Use the same key pair in every environment, and don't rotate it casually.** Each
subscription is tied to the key it was created with, so new keys silently invalidate every
phone that had already turned notifications on — they'd each have to turn them off and on
again.

### On your phone, once

1. Open the site in **Safari** (not Chrome — only Safari can install to the home screen)
2. Tap **Share** → **Add to Home Screen**
3. **Open Availo from the new icon.** This step is the one people skip, and nothing works
   without it
4. Sign in, go to **Settings**
5. Under **Notifications on this device**, tap **Turn on notifications** and accept the iOS
   prompt
6. Tap **Send test notification** — it should arrive within a second or two

Repeat on any other device you want alerts on; it's per device, not per account. Your
laptop's Chrome works too, and doesn't need the install step.

## The caveat worth knowing

Apple gives no way to find out that notifications have stopped. If you delete the
home-screen icon, restore the phone, or the subscription just expires, pushes stop and
**nothing tells you** — you'd only notice bookings arriving with no notification. That is
exactly why Telegram is still configured: it keeps working regardless.

If you ever suspect it's stopped, open Settings and tap **Send test notification**. If it
says the subscription expired, turn it off and on again.

## Notes

- **The prompt only appears once.** If you tap "Don't Allow", iOS will not ask again —
  you'd have to change it in iOS Settings → Notifications → Availo Admin, or delete the
  home-screen icon and add it back.
- **Preview deployments and production are separate.** A subscription belongs to the exact
  domain it was created on, so turning notifications on from a preview URL does nothing for
  the production site. Do it once on the real domain.
- **Clients never see any of this.** The manifest is only linked from the admin pages, so
  nothing invites a client to install anything.

---

# 3. SMS to clients — optional, later

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
| `[push] not configured, skipping notification` | The three `VAPID_*` vars aren't set in that environment |
| `[telegram] send failed: 401` | Wrong bot token |
| `[telegram] send failed: 400 ... chat not found` | Wrong chat ID, or you never messaged the bot |
| `[sms] not configured, skipping` | The three Twilio vars aren't set |
| `21608` | Trial account, recipient not verified |
| `21610` | That number replied STOP |
| `30034` | Number not registered to an approved 10DLC campaign |
| `20003` | Wrong Twilio SID or auth token |
| Webhook returns 403 | `TWILIO_AUTH_TOKEN` missing, or the webhook URL doesn't exactly match the deployed one |
| `[push] endpoint gone, removing subscription` | That phone's subscription expired or the icon was deleted — turn notifications off and on again on that device |
| Settings says "add to your home screen first" | You're in Safari rather than the installed app; open it from the home-screen icon |
| No prompt when tapping "Turn on notifications" | Permission was refused earlier — iOS never asks twice. Change it in iOS Settings → Notifications, or re-add the icon |
| Test notification says "No subscribed devices" | The browser thinks it's subscribed but the server has no record; turn it off and on again |
