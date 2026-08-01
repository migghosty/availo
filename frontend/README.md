# Availo — Slot Booking MVP

A lightweight slot booking site for a single service provider. Admins create available
time slots; clients browse and book one with just their name and email — no account
required.

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
