-- Everything A2P 10DLC registration requires the app to have: recorded consent,
-- a brand name that can match what's registered with the carriers, and a record
-- of who has opted out.
--
-- All additive: the new columns are nullable or defaulted, so existing rows need
-- no backfill and code that doesn't select them keeps working during the window
-- where migrate deploy has run but the new build isn't serving yet.

-- Evidence that a client agreed to be texted, per booking.
ALTER TABLE "Booking" ADD COLUMN "smsConsentAt" TIMESTAMP(3);

-- The trading name used in texts, calendar titles and the policy pages. Defaults
-- to the app's own name so nothing changes until the admin sets theirs.
ALTER TABLE "Settings" ADD COLUMN "businessName" TEXT NOT NULL DEFAULT 'Availo';

-- Numbers that texted STOP. Twilio enforces the block; this is so the app knows.
CREATE TABLE "SmsOptOut" (
  "phone" TEXT NOT NULL,
  "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("phone")
);
