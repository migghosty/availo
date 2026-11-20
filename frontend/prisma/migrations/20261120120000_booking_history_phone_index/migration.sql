-- /admin/history searches by phone: an exact match on the E.164 column, the
-- same lookup /my-booking does against Booking.clientPhone. Without this the
-- search is a sequential scan of a table that only ever grows.
CREATE INDEX "BookingHistory_clientPhone_idx" ON "BookingHistory"("clientPhone");
