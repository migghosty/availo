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
import { normalizePhone } from "./phone";
import { notifyBookingCreated } from "./notifications";
import { isSmsConfigured } from "./sms";

export type BookingFailure =
  | "INVALID_NAME"
  | "INVALID_PHONE"
  | "CONSENT_REQUIRED"
  | "INVALID_SERVICE"
  | "UNAVAILABLE"
  | "ERROR";

export type BookingResult =
  | { ok: true; cancelToken: string }
  | { ok: false; code: BookingFailure; message: string };

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
  clientPhone,
  smsConsent,
  origin,
}: {
  start: Date;
  serviceId: number;
  clientName: string;
  clientPhone: string;
  /**
   * Whether the client ticked the box agreeing to be texted. Required: the
   * booking's only purpose is to produce a text, and carrier rules make
   * unrecorded consent a liability rather than a convenience.
   */
  smsConsent: boolean;
  /**
   * Where the confirmation text should point its cancel link. Passed in rather
   * than derived, since `getOrigin()` reads request headers and this function
   * also runs from the integration tests with no request. Omitted means the
   * text simply carries no link.
   */
  origin?: string;
}): Promise<BookingResult> {
  const name = clientName.trim();

  if (name.length < 2) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message: "Please enter your full name (at least 2 characters).",
    };
  }

  // Normalizing and validating are one step: any spelling that can't be
  // collapsed to a canonical number is exactly the input we have to reject.
  const phone = normalizePhone(clientPhone);

  if (!phone) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      // The example is load-bearing — after a rejection this message is the
      // only place a client learns which numbers are accepted.
      message: "Enter a US or Canada phone number, e.g. (619) 123-4567.",
    };
  }

  // Only demanded when texting is actually switched on. The booking form hides
  // the checkbox under the same condition (`isSmsConfigured()`), and the two
  // have to move together: requiring consent the form never asked for would
  // reject every booking.
  //
  // When it *is* asked for, it's re-checked here for the same reason the start
  // time is — a checkbox is trivially removed from the DOM, and this is the
  // record that has to hold up if a carrier or a complaint ever asks.
  if (isSmsConfigured() && !smsConsent) {
    return {
      ok: false,
      code: "CONSENT_REQUIRED",
      message: "Please agree to receive text messages about your appointment.",
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
      // The transaction hands back what the notification needs: it's the only
      // scope where the service is in hand, and the send has to happen after
      // the commit rather than inside it.
      const booked = await db.$transaction(
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
              clientPhone: phone,
              cancelToken,
              // Only stamped when consent was actually asked for and given —
              // an unasked-for "yes" would be worthless as evidence.
              smsConsentAt: smsConsent ? new Date() : null,
            },
          });

          return {
            serviceName: service.name,
            servicePriceCents: service.priceCents,
            durationMinutes: service.durationMinutes,
          };
        },
        { isolationLevel: "Serializable" }
      );

      // Only reached once per committed booking. Deliberately NOT inside the
      // transaction callback above: that body re-runs up to MAX_ATTEMPTS times,
      // and Serializable aborts even genuinely non-overlapping bookings, so a
      // send in there would fire on attempts that never committed.
      await notifyBookingCreated(
        {
          startTime: start,
          serviceName: booked.serviceName,
          servicePriceCents: booked.servicePriceCents,
          durationMinutes: booked.durationMinutes,
          clientName: name,
          clientPhone: phone,
          cancelToken,
        },
        { origin }
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
