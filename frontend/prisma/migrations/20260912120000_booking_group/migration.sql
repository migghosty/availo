-- Ties the rows of one back-to-back group booking together.
--
-- Purely additive: a nullable column plus an index. Existing single bookings
-- need no backfill, and code that never selects it keeps working during the
-- window where migrate deploy has run but the new build is not yet serving.
--
-- One row per person, not one row per block. That is what keeps every stored
-- durationMinutes under MAX_DURATION_MINUTES (480), which is the assumption
-- getRelevantBookings' 24-hour lookback in scheduleData.ts rests on -- a single
-- fat row for four eight-hour services would be 32 hours long and break it.
--
-- No groupSize or groupIndex column: size is count(*) over the group and order
-- is startTime ascending, both of which cancellation's all-or-nothing delete
-- keeps exact. A stored copy could only ever disagree.
ALTER TABLE "Booking" ADD COLUMN "groupId" TEXT;

-- Every group read is "give me the siblings of this row": the confirmation
-- page, /my-booking, the .ics route and cancelBooking's deleteMany.
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");
