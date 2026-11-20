-- A permanent record of every booking, including cancelled ones.
--
-- Cancelling deletes the Booking row (that is what frees the time), so until
-- now a cancellation left no trace at all. This table is written alongside
-- every booking and marked, not deleted, on cancel.
--
-- No foreign keys on purpose: one to Booking could not outlive the delete it
-- exists to survive, and one to Service would block deleting a service whose
-- bookings were all cancelled. Every column is a snapshot.
CREATE TABLE "BookingHistory" (
    "id" SERIAL NOT NULL,
    "cancelToken" TEXT NOT NULL,
    "groupId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "servicePriceCents" INTEGER NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,

    CONSTRAINT "BookingHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingHistory_cancelToken_key" ON "BookingHistory"("cancelToken");
CREATE INDEX "BookingHistory_bookedAt_idx" ON "BookingHistory"("bookedAt");
CREATE INDEX "BookingHistory_cancelledAt_idx" ON "BookingHistory"("cancelledAt");
CREATE INDEX "BookingHistory_groupId_idx" ON "BookingHistory"("groupId");

-- Backfill every booking that still exists, so the history starts complete for
-- everything recoverable. Bookings cancelled before this migration were
-- hard-deleted and cannot be recovered.
INSERT INTO "BookingHistory" (
    "cancelToken", "groupId", "startTime", "durationMinutes", "clientName",
    "clientPhone", "serviceName", "servicePriceCents", "bookedAt"
)
SELECT
    "cancelToken", "groupId", "startTime", "durationMinutes", "clientName",
    "clientPhone", "serviceName", "servicePriceCents", "createdAt"
FROM "Booking";
