# Availo — Slot Booking MVP

A lightweight booking site for a single service provider. The admin publishes a recurring
weekly schedule and a list of services, each with its own length and price; clients pick a
service, then a time derived from that schedule, using just their name and phone number —
no account required. Booking or cancelling sends a confirmation text to the client and a
heads-up to the admin. Nothing about availability is stored: bookable times are computed per
request from the schedule, the existing bookings, and the chosen service's length.

Texting needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`; without
them the app runs normally and simply sends nothing. US carriers also require A2P 10DLC
registration before messages deliver — see [SMS_SETUP.md](./SMS_SETUP.md) for the full
walkthrough, including a script that generates the sample messages you submit.

See `PLAN.md` at the repo root for the full design.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 (Postgres via Neon) ·
next-auth v5 (credentials, JWT sessions)

## Local development

```bash
npm install
npm run dev
```

Requires `DATABASE_URL` (Neon Postgres connection string) and `AUTH_SECRET` set via
`.env` / `.env.local`.

## Deployment

Deployed on Vercel, auto-deploying from `main`. Project Root Directory is set to
`frontend` since the app lives in a subdirectory of the repo.
