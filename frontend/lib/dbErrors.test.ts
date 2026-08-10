/**
 * Database error classification.
 *
 * Every fixture below is a **real error object captured from Postgres 17 via
 * `@prisma/adapter-pg` 7.9**, not one invented to fit the code. That matters:
 * the bug these tests exist to prevent was a mis-guess about what a
 * serialization failure looks like, and inventing the fixtures would have
 * reproduced the same guess.
 *
 * Two clients booking non-overlapping times used to lose one booking about a
 * quarter of the time because the commit-time shape was unrecognised, reported
 * as a generic error, and never retried.
 */

import { describe, expect, it } from "vitest";

import { isSerializationFailure, isUniqueViolation, sqlStateOf } from "./dbErrors";

/**
 * Shape 1 — conflict detected while running a statement. Prisma has a query to
 * attach it to, so it maps it to a known-request error.
 */
const CONFLICT_DURING_QUERY = Object.assign(
  new Error(""),
  {
    name: "PrismaClientKnownRequestError",
    code: "P2034",
    meta: {
      modelName: "Booking",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "40001",
          originalMessage:
            "could not serialize access due to read/write dependencies among transactions",
          kind: "TransactionWriteConflict",
        },
      },
    },
  }
);

/**
 * Shape 2 — the one that used to slip through. Detected at COMMIT, so there is
 * no statement to attach it to: no `code` property anywhere near the top, and
 * the SQLSTATE only reachable through `cause`.
 */
const CONFLICT_AT_COMMIT = Object.assign(new Error("TransactionWriteConflict"), {
  name: "DriverAdapterError",
  cause: {
    originalCode: "40001",
    originalMessage:
      "could not serialize access due to read/write dependencies among transactions",
    kind: "TransactionWriteConflict",
  },
});

const UNIQUE_VIOLATION_MAPPED = Object.assign(new Error(""), {
  name: "PrismaClientKnownRequestError",
  code: "P2002",
  meta: { target: ["startTime"] },
});

const UNIQUE_VIOLATION_RAW = Object.assign(new Error("duplicate key value"), {
  name: "DriverAdapterError",
  cause: { originalCode: "23505", kind: "UniqueConstraintViolation" },
});

describe("sqlStateOf", () => {
  it("finds a SQLSTATE nested under cause", () => {
    expect(sqlStateOf(CONFLICT_AT_COMMIT)).toBe("40001");
  });

  it("finds one nested under meta.driverAdapterError.cause", () => {
    expect(sqlStateOf(CONFLICT_DURING_QUERY)).toBe("40001");
  });

  it("does not mistake a Prisma code for a SQLSTATE", () => {
    // "P2002" *does* satisfy [0-9A-Z]{5}, so it is excluded deliberately rather
    // than by luck. Nothing collides today, but a function named for SQLSTATEs
    // returning a Prisma code is how a later misclassification starts.
    expect(sqlStateOf(UNIQUE_VIOLATION_MAPPED)).toBeNull();
    expect(sqlStateOf({ code: "P2034" })).toBeNull();
  });

  it("returns null for ordinary errors and non-objects", () => {
    expect(sqlStateOf(new Error("boom"))).toBeNull();
    expect(sqlStateOf(null)).toBeNull();
    expect(sqlStateOf(undefined)).toBeNull();
    expect(sqlStateOf("40001")).toBeNull();
  });

  it("terminates on a self-referencing error", () => {
    const circular: Record<string, unknown> = { name: "Weird" };
    circular.cause = circular;
    expect(sqlStateOf(circular)).toBeNull();
  });
});

describe("isSerializationFailure", () => {
  it("recognises a conflict detected during a query", () => {
    expect(isSerializationFailure(CONFLICT_DURING_QUERY)).toBe(true);
  });

  it("recognises a conflict detected at commit — the shape that caused the bug", () => {
    expect(isSerializationFailure(CONFLICT_AT_COMMIT)).toBe(true);
  });

  it("recognises a deadlock", () => {
    const deadlock = Object.assign(new Error("deadlock detected"), {
      cause: { originalCode: "40P01" },
    });
    expect(isSerializationFailure(deadlock)).toBe(true);
  });

  it("does not treat a unique violation as retryable", () => {
    // Retrying this forever would be a livelock — the value really is taken.
    expect(isSerializationFailure(UNIQUE_VIOLATION_MAPPED)).toBe(false);
    expect(isSerializationFailure(UNIQUE_VIOLATION_RAW)).toBe(false);
  });

  it("does not treat an unrelated failure as retryable", () => {
    expect(isSerializationFailure(new Error("UNAVAILABLE"))).toBe(false);
    expect(isSerializationFailure({ code: "P2025" })).toBe(false);
    expect(isSerializationFailure({ cause: { originalCode: "23502" } })).toBe(false);
    expect(isSerializationFailure(null)).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("recognises both the mapped and the raw shape", () => {
    expect(isUniqueViolation(UNIQUE_VIOLATION_MAPPED)).toBe(true);
    expect(isUniqueViolation(UNIQUE_VIOLATION_RAW)).toBe(true);
  });

  it("does not fire on a serialization failure", () => {
    expect(isUniqueViolation(CONFLICT_DURING_QUERY)).toBe(false);
    expect(isUniqueViolation(CONFLICT_AT_COMMIT)).toBe(false);
  });

  it("does not fire on unrelated errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("the two classifiers are mutually exclusive", () => {
  // A failure routed to both branches would be a coin flip between "retry" and
  // "that time is taken".
  const fixtures = [
    CONFLICT_DURING_QUERY,
    CONFLICT_AT_COMMIT,
    UNIQUE_VIOLATION_MAPPED,
    UNIQUE_VIOLATION_RAW,
    new Error("UNAVAILABLE"),
  ];

  it.each(fixtures.map((f, i) => [i, f]))("fixture %i", (_i, fixture) => {
    expect(isSerializationFailure(fixture) && isUniqueViolation(fixture)).toBe(false);
  });
});
