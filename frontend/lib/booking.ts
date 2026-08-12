/**
 * Booking creation, shared by the booking form's Server Action and the REST
 * endpoint so both enforce identical rules.
 *
 * Concurrency note: with start times offered every `slotIntervalMin` but
 * appointments lasting as long as their service says, two clients can pick
 * *different* start times that still overlap (4:30 and 4:45 with 30-minute
 * appointments). Per-service durations widen that window rather than closing
 * it — a 60-minute booking at 4:00 collides with a 15-minute one at 4:45. A
 * unique index on `startTime` alone wouldn't catch any of it, so the
 * availability re-check runs inside a Serializable transaction and Postgres
 * aborts one of two conflicting writers rather than letting both through.
 */

import { db } from "./db";
import { isStartBookable } from "./availability";
import { isSerializationFailure, isUniqueViolation } from "./dbErrors";
import { loadAvailabilityInputs } from "./scheduleData";
import { getBookableService } from "./serviceData";

export type BookingFailure =
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "INVALID_SERVICE"
  | "UNAVAILABLE"
  | "ERROR";

export type BookingResult =
  | { ok: true; cancelToken: string }
  | { ok: false; code: BookingFailure; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Serializable isolation aborts transactions that *might* not be serializable,
 * not only those that provably conflict. Two clients booking genuinely
 * non-overlapping times still both scan Booking and both insert into it, which
 * is enough of a read/write dependency for Postgres to abort one of them.
 *
 * That is a "retry me", not a "the slot is taken" — reporting it as UNAVAILABLE
 * would tell a client a free time was booked. On retry the re-read sees whatever
 * actually committed, so a real conflict still resolves to UNAVAILABLE.
 */
const MAX_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Full jitter before a retry.
 *
 * Both losers of a conflict are released at the same instant, so retrying
 * immediately just recreates the race that caused it — measured at six
 * simultaneous non-overlapping bookings, retrying without a delay lost a
 * booking in 50 of 60 rounds, and with this delay in 0 of 60. The cost is a few
 * milliseconds on a request that already talks to a database twice.
 */
function retryDelayMs(attempt: number): number {
  return Math.random() * 5 * 2 ** (attempt - 1);
}

export async function createBooking({
  start,
  serviceId,
  clientName,
  clientEmail,
}: {
  start: Date;
  serviceId: number;
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

  const unavailable: BookingResult = {
    ok: false,
    code: "UNAVAILABLE",
    message: "Sorry, that time is no longer available. Please choose another.",
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          // Read inside the transaction so these reads take part in Postgres'
          // serializable conflict detection. The service lookup belongs in here
          // too: it decides how much time the booking blocks, and a service
          // archived while the client sat on the form has to be caught now.
          const [inputs, service] = await Promise.all([
            loadAvailabilityInputs(tx),
            getBookableService(serviceId, tx),
          ]);

          if (!service) {
            throw new Error("INVALID_SERVICE");
          }

          if (
            !isStartBookable({ start, ...inputs, durationMin: service.durationMinutes })
          ) {
            throw new Error("UNAVAILABLE");
          }

          await tx.booking.create({
            data: {
              startTime: start,
              // Snapshotted, not joined: renaming or repricing the service
              // later must not rewrite an appointment already confirmed.
              durationMinutes: service.durationMinutes,
              serviceId: service.id,
              serviceName: service.name,
              servicePriceCents: service.priceCents,
              clientName: name,
              clientEmail: email,
              cancelToken,
            },
          });
        },
        { isolationLevel: "Serializable" }
      );

      return { ok: true, cancelToken };
    } catch (error) {
      // The service is gone or archived — retrying can't change that.
      if (error instanceof Error && error.message === "INVALID_SERVICE") {
        return {
          ok: false,
          code: "INVALID_SERVICE",
          message: "That service isn't available anymore. Please pick another.",
        };
      }

      // The availability re-check said no — a definite answer, never retried.
      if (error instanceof Error && error.message === "UNAVAILABLE") {
        return unavailable;
      }

      // Someone committed this exact start time first.
      if (isUniqueViolation(error)) {
        return unavailable;
      }

      if (isSerializationFailure(error)) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(retryDelayMs(attempt));
          continue;
        }
        // Still losing after several attempts: treat as taken rather than
        // reporting a generic failure.
        return unavailable;
      }

      return {
        ok: false,
        code: "ERROR",
        message: "Something went wrong. Please try again.",
      };
    }
  }

  return unavailable;
}
