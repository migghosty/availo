/**
 * Shared configuration for the integration tier, imported by both the Vitest
 * config and its global setup.
 */

/**
 * Throwaway Postgres for integration tests. Port 55432 rather than 5432 so it
 * cannot collide with a Postgres already running on the developer's machine.
 * CI overrides this with its own service container.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://availo:availo@localhost:55432/availo_test";

/** Hosts an integration test is permitted to truncate. */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

/**
 * Throws unless the URL points at a local database.
 *
 * These tests delete rows between cases, so pointing them at anything shared
 * would be destructive. `prisma.config.ts` loads `.env` — the file holding the
 * real database URL — via `dotenv/config`, and while dotenv does not overwrite
 * variables that are already set, relying on that subtlety alone is not a good
 * enough safeguard for an operation that is irreversible when it is wrong.
 */
export function assertLocalDatabase(url: string): void {
  const host = new URL(url).hostname;

  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `Integration tests refuse to run against a non-local database (got ${host}). ` +
        `They delete rows between cases.`
    );
  }
}
