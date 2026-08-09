/**
 * Refuses to let a destructive Prisma command run against a database that
 * hasn't been explicitly declared safe.
 *
 * This exists because of a real outage: dev and production once shared a single
 * Neon branch, so `prisma migrate deploy` run from a laptop applied a migration
 * containing `DELETE FROM "Booking"` and `DROP TABLE "Slot"` to the live
 * database, taking production down while the deployed code still queried
 * `db.slot`.
 *
 * Deliberately an ALLOWLIST, not a blocklist. Blocking the one known production
 * host would silently pass any *new* production database — a second Neon branch,
 * a restored snapshot, a migrated provider. Failing closed means the worst case
 * is an annoying error, not a dropped table.
 *
 * Configure by adding to `frontend/.env` (gitignored):
 *
 *     ALLOWED_DB_HOSTS=ep-your-dev-branch-pooler.c-2.us-west-2.aws.neon.tech
 *
 * localhost and 127.0.0.1 are always allowed, so the Docker Postgres used by the
 * integration tests needs no configuration.
 *
 * Usage (see the `db:*` scripts in package.json):
 *
 *     tsx scripts/guard-dev-db.ts && prisma migrate dev
 */

// Matches how prisma.config.ts loads env. NOTE: `dotenv/config` reads `.env`
// only — never `.env.local` — while Next.js reads both and prefers `.env.local`.
// Keep DATABASE_URL in `.env` so the CLI and the running app cannot disagree
// about which database they are talking to.
import "dotenv/config";

/** Hosts that are safe regardless of configuration. */
const ALWAYS_ALLOWED = ["localhost", "127.0.0.1", "::1"];

function fail(lines: string[]): never {
  console.error("\n  ✖ Refusing to run a destructive database command.\n");
  for (const line of lines) console.error(`    ${line}`);
  console.error("");
  process.exit(1);
}

function hostOf(rawUrl: string): string {
  try {
    // Postgres URLs parse fine as WHATWG URLs; this never exposes the password.
    return new URL(rawUrl).hostname;
  } catch {
    fail([
      "DATABASE_URL is set but could not be parsed as a URL.",
      "Expected something like postgresql://user:password@host/dbname",
    ]);
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail([
    "DATABASE_URL is not set.",
    "",
    "Set it in frontend/.env (not .env.local — the Prisma CLI does not read that file).",
  ]);
}

const host = hostOf(databaseUrl);

const configured = (process.env.ALLOWED_DB_HOSTS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const allowed = [...ALWAYS_ALLOWED, ...configured];

if (!allowed.includes(host)) {
  fail([
    `DATABASE_URL points at:  ${host}`,
    `Allowed hosts:           ${allowed.join(", ")}`,
    "",
    "If that host really is your development database, add it to ALLOWED_DB_HOSTS",
    "in frontend/.env:",
    "",
    `    ALLOWED_DB_HOSTS=${host}`,
    "",
    "If it is production, do not add it. Migrations reach production through the",
    "Vercel build (`prisma migrate deploy`), never from a local shell.",
  ]);
}

console.log(`  ✔ Database host allowed: ${host}`);
