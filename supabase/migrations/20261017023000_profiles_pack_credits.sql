-- One-time pack credits held by a subscriber, kept apart from the monthly
-- allowance so invoice.paid (which SETs generations_limit/used each period)
-- never wipes them. Generation spends the monthly allowance first, then this.
-- Apply BEFORE deploying the stripe-webhook worker and the app worker that
-- read it (PR #1898).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pack_credits integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_pack_credits_nonnegative;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_pack_credits_nonnegative CHECK (pack_credits >= 0);
