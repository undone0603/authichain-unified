-- 00002_revenue_path_columns_and_lead_sequences.sql
-- Canonical, version-controlled copy of the migration applied to the live
-- Supabase project (nhdnkzhtadfkkluiulhs) on 2026-06-22.
--
-- Closes schema gaps the merged autonomous-revenue code (PR #400) depends on:
--   • profiles.subscription_plan   — written by the Stripe webhook on
--     checkout.session.completed; without it the UPDATE fails and NO paid
--     checkout ever activates.
--   • profiles.stripe_account_id   — read by /api/affiliate/payout to target
--     Stripe Connect transfers.
--   • affiliate_payouts.stripe_transfer_id / error_message — written by the
--     payout processor on success / failure.
--   • lead_sequences               — backs the multi-stage drip sequencer in
--     AutonomousController.runDripSequencer().

ALTER TABLE public.profiles          ADD COLUMN IF NOT EXISTS subscription_plan   text;
ALTER TABLE public.profiles          ADD COLUMN IF NOT EXISTS stripe_account_id   text;
ALTER TABLE public.affiliate_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id  text;
ALTER TABLE public.affiliate_payouts ADD COLUMN IF NOT EXISTS error_message       text;

CREATE TABLE IF NOT EXISTS public.lead_sequences (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid        NOT NULL REFERENCES public.lead_captures(id) ON DELETE CASCADE,
  current_stage  integer     NOT NULL DEFAULT 1,
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','completed','paused')),
  next_action_at timestamptz,
  last_action_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_sequences_due
  ON public.lead_sequences (status, next_action_at);

-- Service-role only (autonomous controller uses the service role key, which
-- bypasses RLS). No anon/authenticated policies = no public access.
ALTER TABLE public.lead_sequences ENABLE ROW LEVEL SECURITY;
