-- Migration: 00006_remove_free_generation_grant
--
-- Removes the 10 complimentary generations every new account used to receive.
--
-- WHY THIS MIGRATION EXISTS (revenue + cost):
--   The profiles table shipped with `generations_limit INTEGER DEFAULT 10`
--   (see drizzle/0000_special_lady_ursula.sql and src/db/schema.ts), so every
--   sign-up was granted 10 free Hugging Face generations. Each generation is a
--   real paid inference call, so the free grant was a direct, uncapped cost with
--   no conversion gate. Going forward, generations are granted ONLY on purchase
--   (see PLAN_CREDITS in src/lib/plans.ts and the Stripe fulfillment path).
--
-- This migration:
--   1. Drops the DEFAULT 10 so new rows start at 0 credits.
--   2. Zeroes the limit for existing free-tier accounts that still hold the
--      complimentary grant, WITHOUT touching anyone who paid (tier <> 'free')
--      or who has already bought additional credits (generations_limit > 10).

ALTER TABLE public.profiles
  ALTER COLUMN generations_limit SET DEFAULT 0;

-- Revoke the unused complimentary grant from free accounts. Scoped to the
-- untouched default (<= 10) so a free user who topped up isn't penalised, and
-- guarded on tier='free' so no paying customer is affected.
UPDATE public.profiles
   SET generations_limit = 0,
       updated_at        = NOW()
 WHERE tier = 'free'
   AND generations_limit <= 10;
