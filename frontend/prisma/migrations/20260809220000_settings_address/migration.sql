-- Business address on Settings.
--
-- Free text rather than structured street/city/postcode fields: the only
-- consumer is the LOCATION property of a calendar event (and the equivalent
-- Google Calendar parameter), which is itself a single free-text value that
-- calendar apps hand to a maps search. Splitting it up here would only mean
-- reassembling it there.
--
-- Additive and defaulted, so existing rows keep working — an empty address
-- means "not set" and calendar events simply carry no location.

ALTER TABLE "Settings" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
