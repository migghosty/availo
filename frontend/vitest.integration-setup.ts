import { execFileSync } from "node:child_process";

import { TEST_DATABASE_URL, assertLocalDatabase } from "./test/database.mjs";

/**
 * Applies migrations to the throwaway Postgres once, before the integration
 * tier runs.
 *
 * DATABASE_URL is passed explicitly in the child environment: `prisma.config.ts`
 * calls `dotenv/config`, which loads the `.env` holding the real database URL,
 * and dotenv does not overwrite variables that are already set — so an explicit
 * value wins. `assertLocalDatabase` is the belt to that suspenders.
 */
export async function setup() {
  assertLocalDatabase(TEST_DATABASE_URL);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
