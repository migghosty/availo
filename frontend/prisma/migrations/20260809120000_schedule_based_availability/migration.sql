-- Schedule-based availability.
--
-- Availability is no longer stored as pre-made `Slot` rows created by hand.
-- The admin defines a recurring weekly schedule (`ScheduleRule`) plus per-date
-- exceptions (`ScheduleOverride`), and bookable start times are computed from
-- those minus existing bookings. `Booking` therefore carries its own start
-- time and duration, and `Slot` goes away.
--
-- Existing bookings are intentionally discarded (chosen explicitly: start fresh).

-- Old bookings derive their time from Slot, which is being dropped.
DELETE FROM "Booking";

-- AlterTable: Booking owns its own time
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_slotId_fkey";

DROP INDEX "Booking_slotId_key";

ALTER TABLE "Booking" DROP COLUMN "slotId",
    ADD COLUMN "startTime" TIMESTAMP(3) NOT NULL,
    ADD COLUMN "durationMinutes" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_startTime_key" ON "Booking"("startTime");

-- CreateIndex
CREATE INDEX "Booking_startTime_idx" ON "Booking"("startTime");

-- DropTable
DROP TABLE "Slot";

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "slotIntervalMin" INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN "bookingHorizonDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "ScheduleRule" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "ScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleRule_dayOfWeek_idx" ON "ScheduleRule"("dayOfWeek");

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleOverride_date_key" ON "ScheduleOverride"("date");

-- CreateTable
CREATE TABLE "ScheduleOverrideWindow" (
    "id" SERIAL NOT NULL,
    "overrideId" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "ScheduleOverrideWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleOverrideWindow_overrideId_idx" ON "ScheduleOverrideWindow"("overrideId");

-- AddForeignKey
ALTER TABLE "ScheduleOverrideWindow" ADD CONSTRAINT "ScheduleOverrideWindow_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "ScheduleOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
