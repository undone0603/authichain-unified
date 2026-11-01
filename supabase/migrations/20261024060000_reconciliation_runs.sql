-- P0-4: Stripe <-> Supabase daily reconciliation summary table + dedicated role.
-- Spec: phase3-P0-4-reconciliation-spec-2026-10-24.md
-- NOT APPLIED. Applying this migration requires Zac's explicit approval.
--
-- Privilege model (Advisor condition 4):
--   * The ONLY write privilege the role has is INSERT on public.reconciliation_runs.
--   * No UPDATE/DELETE anywhere, no service-role key.
--   * Read access is column-level SELECT on the ledger tables, excluding PII
--     columns (e.g. payments.customer_email is NOT granted).

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id                       BIGSERIAL   PRIMARY KEY,
  run_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_start             TIMESTAMPTZ NOT NULL,
  window_end               TIMESTAMPTZ NOT NULL,
  stripe_charge_count      INTEGER     NOT NULL DEFAULT 0,
  stripe_charge_sum_cents  BIGINT      NOT NULL DEFAULT 0,
  stripe_refund_sum_cents  BIGINT      NOT NULL DEFAULT 0,
  stripe_payout_sum_cents  BIGINT      NOT NULL DEFAULT 0,
  ledger_count             INTEGER     NOT NULL DEFAULT 0,
  ledger_sum_cents         BIGINT      NOT NULL DEFAULT 0,
  mismatch_count           INTEGER     NOT NULL DEFAULT 0,
  -- ids and class only, never PII: [{"class":"MISSING_IN_LEDGER","id":"ch_..."}]
  mismatches               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  excluded_test_count      INTEGER     NOT NULL DEFAULT 0,
  status                   TEXT        NOT NULL CHECK (status IN ('ok', 'mismatch', 'error')),
  CHECK (window_end >= window_start),
  CHECK (jsonb_typeof(mismatches) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_run_at
  ON public.reconciliation_runs (run_at DESC);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

-- Dedicated role. NOLOGIN: reached via PostgREST role switch (JWT role claim)
-- minted by Zac; no password is set or stored here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stripe_reconciler') THEN
    CREATE ROLE stripe_reconciler NOLOGIN NOINHERIT;
  END IF;
END
$$;

GRANT stripe_reconciler TO authenticator;
GRANT USAGE ON SCHEMA public TO stripe_reconciler;

-- Only write: INSERT on reconciliation_runs.
REVOKE ALL ON public.reconciliation_runs FROM stripe_reconciler;
GRANT INSERT ON public.reconciliation_runs TO stripe_reconciler;
GRANT USAGE ON SEQUENCE public.reconciliation_runs_id_seq TO stripe_reconciler;

CREATE POLICY "stripe_reconciler inserts runs" ON public.reconciliation_runs
  FOR INSERT TO stripe_reconciler WITH CHECK (true);

-- Read-only, non-PII columns on ledger tables.
GRANT SELECT (session_id, amount_cents, currency, status, created_at)
  ON public.payments TO stripe_reconciler;
CREATE POLICY "stripe_reconciler reads payments" ON public.payments
  FOR SELECT TO stripe_reconciler USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'stripe_events' AND column_name = 'status') THEN
    EXECUTE 'GRANT SELECT (event_id, event_type, status, processed_at) ON public.stripe_events TO stripe_reconciler';
  ELSE
    EXECUTE 'GRANT SELECT (event_id, event_type, processed_at) ON public.stripe_events TO stripe_reconciler';
  END IF;
END
$$;
CREATE POLICY "stripe_reconciler reads stripe_events" ON public.stripe_events
  FOR SELECT TO stripe_reconciler USING (true);

COMMENT ON TABLE public.reconciliation_runs IS
  'P0-4 daily Stripe<->ledger reconciliation summary. One row per run; ids and class only, no PII.';
