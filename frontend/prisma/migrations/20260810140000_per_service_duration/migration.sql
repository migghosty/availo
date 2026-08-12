-- Appointment length moves from the single global Settings row onto each
-- Service, and bookings start recording which service they are for.
--
-- Hand-written rather than generated: the DROP COLUMN at the end makes this
-- destructive, and `prisma migrate dev` needs an interactive TTY to confirm
-- data loss. Apply with `prisma migrate deploy`.

-- Service gains the length and the archive flag.
ALTER TABLE "Service" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Service" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Existing services inherit the global length they were actually being booked
-- at. This has to run BEFORE the column is dropped below.
UPDATE "Service"
SET "durationMinutes" = COALESCE(
  (SELECT "slotDurationMin" FROM "Settings" WHERE "id" = 1),
  30
);

-- Booking gains the reference plus a name/price snapshot, so renaming or
-- repricing a service never rewrites a confirmation that already went out.
ALTER TABLE "Booking" ADD COLUMN "serviceId" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "serviceName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Booking" ADD COLUMN "servicePriceCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Length is per-service now; the global knob has no meaning.
ALTER TABLE "Settings" DROP COLUMN "slotDurationMin";
