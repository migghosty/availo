import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./test/database.mjs";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const alias = { "@": rootDir };

export default defineConfig({
  test: {
    projects: [
      {
        // Pure functions over plain data — no database, no mocking. Runs
        // everywhere, including CI on every push.
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts"],
          exclude: ["lib/**/*.integration.test.ts"],
        },
      },
      {
        // Exercises createBooking against a real Postgres, because the part
        // most worth testing — Serializable conflict handling — does not exist
        // outside the database.
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["lib/**/*.integration.test.ts"],
          globalSetup: ["./vitest.integration-setup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          // These tests share one database and clear it between cases, so they
          // must not run concurrently with each other.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
