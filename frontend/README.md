# Availo — Slot Booking MVP

A lightweight booking site for a single service provider. The admin publishes a recurring
weekly schedule and a list of services, each with its own length and price; clients pick a
service, then a time derived from that schedule, using just their name and phone number —
no account required. Nothing about availability is stored: bookable times are computed per
request from the schedule, the existing bookings, and the chosen service's length.

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
