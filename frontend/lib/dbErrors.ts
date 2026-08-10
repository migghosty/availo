/**
 * Classifying database failures that callers need to act on.
 *
 * Pure — no Prisma client, no connection — so it is unit-testable without a
 * database, following the same split as `schedule.ts` / `scheduleData.ts`.
 *
 * The reason this exists as its own module is that **the same failure reaches
 * us in two different shapes**, and missing the second one caused a real bug:
 *
 * - Detected while running a statement → Prisma maps it to a
 *   `PrismaClientKnownRequestError` with `code: "P2034"`.
 * - Detected at COMMIT → there is no statement to attach it to, so the driver
 *   adapter (`@prisma/adapter-pg`) throws a bare `DriverAdapterError` with **no
 *   `code` property at all** and the SQLSTATE buried in `cause.originalCode`.
 *
 * `createBooking` originally tested `error.code === "P2034"`, so every
 * commit-time conflict fell through to a generic "something went wrong" and was
 * never retried — roughly a quarter of concurrent bookings. Matching on the
 * SQLSTATE catches both shapes and is the more durable check anyway: `40001` is
 * defined by Postgres, while the wrapper shapes belong to Prisma.
 */

/** Prisma's code for a write conflict / deadlock. */
const PRISMA_SERIALIZATION_FAILURE = "P2034";

/** Prisma's code for a unique-constraint violation. */
const PRISMA_UNIQUE_VIOLATION = "P2002";

const RETRYABLE_SQLSTATES = new Set([
  "40001", // serialization_failure — Serializable saw a read/write dependency
  "40P01", // deadlock_detected
]);

const UNIQUE_VIOLATION_SQLSTATE = "23505";

/** SQLSTATEs are exactly five characters, digits and uppercase letters. */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

/**
 * Prisma's own codes ("P2002", "P2034") also satisfy the SQLSTATE pattern, so
 * they have to be excluded explicitly or `sqlStateOf` would report them as
 * SQLSTATEs. Nothing currently collides — no SQLSTATE we look for starts with
 * "P" — but returning a Prisma code from a function named for SQLSTATEs is the
 * kind of near-miss that becomes a real misclassification later.
 */
const PRISMA_CODE_PATTERN = /^P\d{4}$/;

export function prismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

/**
 * Digs the Postgres SQLSTATE out of whatever wrapper it arrived in, walking
 * `cause` and `meta.driverAdapterError` so it keeps working if Prisma nests the
 * driver error a level deeper.
 */
export function sqlStateOf(error: unknown): string | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const node = queue.shift();
    if (typeof node !== "object" || node === null || seen.has(node)) continue;
    seen.add(node);

    const record = node as Record<string, unknown>;

    // `originalCode` is the adapter's field; `code` covers a raw pg error.
    for (const key of ["originalCode", "code"]) {
      const value = record[key];
      if (
        typeof value === "string" &&
        SQLSTATE_PATTERN.test(value) &&
        !PRISMA_CODE_PATTERN.test(value)
      ) {
        return value;
      }
    }

    queue.push(record.cause, record.meta);
    const meta = record.meta as Record<string, unknown> | undefined;
    if (typeof meta === "object" && meta !== null) {
      queue.push(meta.driverAdapterError);
    }
  }

  return null;
}

/** "You lost a race, run the whole transaction again" — never "the data is bad". */
export function isSerializationFailure(error: unknown): boolean {
  if (prismaErrorCode(error) === PRISMA_SERIALIZATION_FAILURE) return true;

  const sqlState = sqlStateOf(error);
  return sqlState !== null && RETRYABLE_SQLSTATES.has(sqlState);
}

/** A genuine conflict: someone already committed this exact value. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    prismaErrorCode(error) === PRISMA_UNIQUE_VIOLATION ||
    sqlStateOf(error) === UNIQUE_VIOLATION_SQLSTATE
  );
}
