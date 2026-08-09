/**
 * Booking creation, shared by the booking form's Server Action and the REST
 * endpoint so both enforce identical rules.
 *
 * Concurrency note: with start times offered every `slotIntervalMin` but
 * appointments lasting `slotDurationMin`, two clients can pick *different*
 * start times that still overlap (4:30 and 4:45 with 30-minute appointments).
 * A unique index on `startTime` alone wouldn't catch that, so the availability
 * re-check runs inside a Serializable transaction — Postgres then aborts one of
 * two conflicting writers rather than letting both through.
 */

import { db } from "./db";
import { isStartBookable } from "./availability";
import { loadAvailabilityInputs } from "./scheduleData";

export type BookingFailure =
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "UNAVAILABLE"
  | "ERROR";

export type BookingResult =
  | { ok: true; cancelToken: string }
  | { ok: false; code: BookingFailure; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prisma: unique violation, and write-conflict/deadlock (serialization failure). */
const CONFLICT_CODES = new Set(["P2002", "P2034"]);

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    CONFLICT_CODES.has((error as { code: string }).code)
  );
}

export async function createBooking({
  start,
  clientName,
  clientEmail,
}: {
  start: Date;
  clientName: string;
  clientEmail: string;
}): Promise<BookingResult> {
  const name = clientName.trim();
  const email = clientEmail.trim().toLowerCase();

  if (name.length < 2) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message: "Please enter your full name (at least 2 characters).",
    };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      message: "A valid email address is required.",
    };
  }

  const cancelToken = crypto.randomUUID();

  try {
    await db.$transaction(
      async (tx) => {
        // Read inside the transaction so these reads take part in Postgres'
        // serializable conflict detection.
        const inputs = await loadAvailabilityInputs(tx);

        if (!isStartBookable({ start, ...inputs })) {
          throw new Error("UNAVAILABLE");
        }

        await tx.booking.create({
          data: {
            startTime: start,
            durationMinutes: inputs.config.slotDurationMin,
            clientName: name,
            clientEmail: email,
            cancelToken,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAVAILABLE") {
      return {
        ok: false,
        code: "UNAVAILABLE",
        message: "Sorry, that time is no longer available. Please choose another.",
      };
    }

    if (isConflict(error)) {
      return {
        ok: false,
        code: "UNAVAILABLE",
        message: "Sorry, that time is no longer available. Please choose another.",
      };
    }

    return {
      ok: false,
      code: "ERROR",
      message: "Something went wrong. Please try again.",
    };
  }

  return { ok: true, cancelToken };
}
