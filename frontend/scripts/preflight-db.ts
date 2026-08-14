/**
 * Build preflight: verify DATABASE_URL is readable before `prisma migrate deploy`
 * runs, and record which database the build is about to migrate.
 *
 * Prisma's own failure here is "The datasource.url property is required in your
 * Prisma config file when using prisma migrate deploy" — accurate but misleading,
 * because `prisma.config.ts` is fine. The property is empty only because
 * `process.env.DATABASE_URL` was undefined. This turns that into a message that
 * names the Vercel setting that actually causes it: environment scope.
 *
 * Note the "Sensitive" flag is NOT a cause, despite the intuition that it might be.
 * Sensitive variables cannot be read back in the dashboard or CLI, but they are
 * still injected into the build — production deploys here run this same preflight
 * against a Sensitive DATABASE_URL and pass. Do not un-mark a secret to fix this.
 *
 * The success line matters as much as the failure one: it puts the target host in
 * the build log, so a Preview deployment wired to the production database is
 * visible at a glance instead of being discovered afterwards.
 *
 * Never prints the password — only the hostname.
 */

// Matches prisma.config.ts. `dotenv/config` reads `.env` only, never `.env.local`.
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

// VERCEL_ENV is "production" | "preview" | "development" on Vercel, unset locally.
const environment = process.env.VERCEL_ENV ?? "local";

if (!databaseUrl) {
  console.error("\n  ✖ DATABASE_URL is not set — cannot run database migrations.\n");
  console.error(`    Build environment: ${environment}`);
  console.error("");
  console.error("    The build runs `prisma migrate deploy`, so DATABASE_URL is needed at");
  console.error("    BUILD time, not just at runtime. The cause is environment scope: the");
  console.error("    variable must be enabled for the environment being built, and a");
  console.error("    Production-only value fails every Preview build.");
  console.error("");
  console.error("    Each environment gets its OWN database — check the value you add here");
  console.error("    is the branch for this environment, not the production one. A Preview");
  console.error("    build runs migrations, so a shared URL would apply an unmerged");
  console.error("    migration to production.");
  console.error("");
  console.error("      vercel env add DATABASE_URL preview");
  console.error("");
  console.error("    The \"Sensitive\" flag is not the problem — sensitive variables are");
  console.error("    still injected into the build. Do not un-mark it.");
  console.error("");
  console.error("    Vercel → Settings → Environment Variables → DATABASE_URL");
  console.error("    Locally, set it in frontend/.env (the Prisma CLI does not read .env.local).");
  console.error("");
  process.exit(1);
}

let host: string;
try {
  host = new URL(databaseUrl).hostname;
} catch {
  console.error("\n  ✖ DATABASE_URL is set but is not a parseable URL.\n");
  console.error("    Expected: postgresql://user:password@host/dbname");
  console.error("");
  process.exit(1);
}

console.log(`  ✔ Migrating ${environment} database at ${host}`);
