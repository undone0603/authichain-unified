-- 00003_stripe_payment_tracking.sql
-- Stripe webhook handlers for payments and subscription reconciliation
-- Created: 2026-06-25
--
-- This migration provides tables for:
--   • Tracking individual payments from checkout.session.completed
--   • Maintaining subscription lifecycle (active → payment_failed → canceled)
--   • Alerting sales team on payment failures
--   • Auditing all Stripe webhook events for compliance

-- ─── 1. Payments Table ──────────────────────────────────────────────────────
-- Record of individual payments from Stripe checkout sessions
CREATE TABLE IF NOT EXISTS public.payments (
  session_id         TEXT        PRIMARY KEY,
  customer_email     TEXT        NOT NULL,
  amount_cents       INTEGER     NOT NULL,
  currency           TEXT        NOT NULL DEFAULT 'usd',
  status             TEXT        NOT NULL DEFAULT 'paid',
                                 CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_email
  ON public.payments (customer_email);
CREATE INDEX idx_payments_created_at
  ON public.payments (created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook uses service role)
CREATE POLICY "Service role manages payments" ON public.payments
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ─── 2. Subscriptions Table ─────────────────────────────────────────────────
-- Subscription lifecycle tracking
CREATE TABLE IF NOT EXISTS public.subscriptions (
  subscription_id    TEXT        PRIMARY KEY,
  customer_email     TEXT        NOT NULL,
  product_id         TEXT,
  status             TEXT        NOT NULL DEFAULT 'active',
                                 CHECK (status IN ('active', 'payment_failed', 'canceled')),
  next_billing_date  TIMESTAMPTZ,
  canceled_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_email
  ON public.subscriptions (customer_email);
CREATE INDEX idx_subscriptions_status
  ON public.subscriptions (status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook uses service role)
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ─── 3. Alerts Table ───────────────────────────────────────────────────────
-- Alert the sales team to payment failures and other critical events
CREATE TABLE IF NOT EXISTS public.alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT        NOT NULL,
                                CHECK (type IN ('payment_failed', 'subscription_issue', 'refund', 'chargeback')),
  message           TEXT        NOT NULL,
  customer_email    TEXT,
  metadata          JSONB,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_type
  ON public.alerts (type);
CREATE INDEX idx_alerts_customer_email
  ON public.alerts (customer_email);
CREATE INDEX idx_alerts_created_at
  ON public.alerts (created_at DESC);
CREATE INDEX idx_alerts_resolved
  ON public.alerts (resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook uses service role)
CREATE POLICY "Service role manages alerts" ON public.alerts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ─── 4. Audit Log Table ────────────────────────────────────────────────────
-- Log all Stripe webhook events for compliance, debugging, and idempotency checks
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        TEXT        NOT NULL,
  event_id          TEXT,
  status            TEXT        NOT NULL,
                                CHECK (status IN ('success', 'error', 'duplicate')),
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_event_type
  ON public.audit_log (event_type);
CREATE INDEX idx_audit_log_event_id
  ON public.audit_log (event_id);
CREATE INDEX idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook uses service role)
CREATE POLICY "Service role manages audit_log" ON public.audit_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ─── 5. Link lead_captures to payments (if not already present) ────────────
-- Add status column to lead_captures to track lead → customer progression
ALTER TABLE public.lead_captures
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'prospect'
                            CHECK (status IN ('prospect', 'engaged', 'customer', 'inactive'));

CREATE INDEX idx_lead_captures_status
  ON public.lead_captures (status)
  WHERE status = 'customer';

-- ─── 6. Stripe Events Table (Idempotency Guard) ────────────────────────────
-- Prevent duplicate processing of Stripe webhook retries
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id          TEXT        PRIMARY KEY,
  event_type        TEXT        NOT NULL,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_events_type
  ON public.stripe_events (event_type);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook uses service role)
CREATE POLICY "Service role manages stripe_events" ON public.stripe_events
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ─── Views for Sales Team Dashboard ────────────────────────────────────────

-- Revenue summary by day
CREATE OR REPLACE VIEW public.payment_summary_daily AS
SELECT
  DATE(created_at) as payment_date,
  COUNT(*) as transaction_count,
  SUM(amount_cents) / 100.0 as total_revenue,
  AVG(amount_cents) / 100.0 as avg_transaction,
  currency
FROM public.payments
WHERE status = 'paid'
GROUP BY DATE(created_at), currency
ORDER BY payment_date DESC;

-- Subscription health check
CREATE OR REPLACE VIEW public.subscription_status_summary AS
SELECT
  status,
  COUNT(*) as subscription_count,
  COUNT(DISTINCT customer_email) as unique_customers
FROM public.subscriptions
GROUP BY status;

-- Unresolved alerts for sales team
CREATE OR REPLACE VIEW public.critical_alerts AS
SELECT
  id,
  type,
  message,
  customer_email,
  created_at,
  (NOW() - created_at) as age
FROM public.alerts
WHERE resolved_at IS NULL
ORDER BY created_at DESC;
