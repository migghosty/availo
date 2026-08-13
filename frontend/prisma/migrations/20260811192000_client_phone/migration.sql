-- Clients identify themselves by phone number instead of email.
--
-- Hand-written rather than generated: this drops a column and deletes rows, and
-- `prisma migrate dev` needs an interactive TTY to confirm data loss. Apply with
-- `prisma migrate deploy`.

-- Existing bookings carry an email and no phone, and the new column is NOT NULL
-- with no sensible default to invent. Discarding them is deliberate, matching
-- what 20260809120000_schedule_based_availability did to the Slot-era bookings.
-- Past rows go too: they would violate the NOT NULL just the same.
DELETE FROM "Booking";

ALTER TABLE "Booking" DROP COLUMN "clientEmail";
ALTER TABLE "Booking" ADD COLUMN "clientPhone" TEXT NOT NULL;

-- /my-booking looks up by this column on every search. The clientEmail it
-- replaces never had an index, so that lookup was a sequential scan.
CREATE INDEX "Booking_clientPhone_idx" ON "Booking"("clientPhone");
