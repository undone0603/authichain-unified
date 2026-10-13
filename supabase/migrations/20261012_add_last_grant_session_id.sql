-- Session-level idempotency for QRON generation grants.
-- Prevents Stripe webhook retries from resetting generations_used after consumption.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_grant_session_id text;

CREATE INDEX IF NOT EXISTS idx_profiles_last_grant_session_id
ON public.profiles (last_grant_session_id)
WHERE last_grant_session_id IS NOT NULL;
