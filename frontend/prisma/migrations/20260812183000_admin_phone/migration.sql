-- Where booking notifications get texted. Nothing else in the app stores a
-- contact detail for the admin — AdminUser is username + password hash only.
--
-- Additive and defaulted, so old code that doesn't select it keeps working
-- during the window where migrate deploy has run but the new build isn't
-- serving yet. Empty means "not set", and admin texts are then skipped.
ALTER TABLE "Settings" ADD COLUMN "adminPhone" TEXT NOT NULL DEFAULT '';
