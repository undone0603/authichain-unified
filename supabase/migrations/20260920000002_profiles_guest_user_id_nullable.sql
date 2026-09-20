-- Guest DPP / smoke checkout creates a profiles row from email only.
-- Live public.profiles.user_id was NOT NULL + FK to auth.users(id).
-- auth.users is empty, so provisionPurchase's insert
--   { email, brand, created_at }
-- failed with 23502. fulfillDppPaidSession then skipped dpp_loop:provisioned
-- and still returned HTTP 200 (error was mapped to no_identity).
--
-- Guest rows omit user_id. The buyer can claim the profile later via the
-- same email. Real signups still set user_id via handle_new_user().
-- UNIQUE (user_id) allows multiple NULLs in Postgres.

ALTER TABLE public.profiles
  ALTER COLUMN user_id DROP NOT NULL;
