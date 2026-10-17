-- PR #1898. Columns the stripe-webhook worker (workers/stripe-webhook) and the
-- credit check (src/lib/business-tier.ts) read or write that live QRON-v2
-- public.profiles (nhdnkzhtadfkkluiulhs) lacks as of 2026-10-16:
--   plan                        (webhook upsert + grant select/patch)
--   stripe_subscription_status  (webhook grant select, subscription.updated/
--                                deleted and invoice.payment_failed patches)
--   pack_credits                (new separate pack balance)
-- All additive, nullable-or-defaulted, IF NOT EXISTS. Not applied by the PR;
-- CF Deploy applies it BEFORE deploying either worker.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_status text;

-- Seed from the columns the live app path (src/lib/provisioning.ts) already
-- maintains, so a pack bought by an existing subscriber keeps their plan.
UPDATE public.profiles
SET plan = subscription_plan
WHERE plan IS NULL AND subscription_plan IS NOT NULL;

UPDATE public.profiles
SET stripe_subscription_status = subscription_status
WHERE stripe_subscription_status IS NULL
  AND subscription_status IS NOT NULL
  AND stripe_subscription_id IS NOT NULL;

-- One-time pack credits held by a subscriber, kept apart from the monthly
-- allowance so invoice.paid (which SETs generations_limit/used each period)
-- never wipes them. Generation spends the monthly allowance first, then this.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pack_credits integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_pack_credits_nonnegative;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_pack_credits_nonnegative CHECK (pack_credits >= 0);
