-- ADM-174 (PR #1718): grant one-time pack credits at most once per Stripe
-- Checkout Session. src/lib/provisioning.ts claimCreditGrant inserts here
-- with ON CONFLICT (stripe_session_id) DO NOTHING before adding credits.
-- NOT APPLIED by this PR. Apply before deploying #1718: without the table
-- the webhook fails closed (throws, Stripe retries) for credit packs.
-- Rollback: DROP TABLE public.credit_grants;

CREATE TABLE IF NOT EXISTS public.credit_grants (
  stripe_session_id text        PRIMARY KEY,
  profile_id        text        NOT NULL,
  plan              text,
  credits           integer     NOT NULL,
  granted_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_grants_profile
  ON public.credit_grants (profile_id);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
-- No client policies: service_role bypasses RLS; anon/authenticated get nothing.
REVOKE ALL ON TABLE public.credit_grants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.credit_grants TO service_role;
