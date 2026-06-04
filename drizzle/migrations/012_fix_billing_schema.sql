-- drizzle/migrations/012_fix_billing_schema.sql
-- Reconstructs the revenue pipeline tables to match the Drizzle schema.
--
-- Root cause: subscriptions/revenue_records/notifications were created from a
-- legacy UUID-based Prisma schema that is incompatible with the current integer
-- user ID system. activity_log and service_orders were missing entirely.
--
-- Applied to QRON-v2 Supabase project on 2026-06-04.
-- All affected tables had 0 rows at time of migration.

-- Drop legacy UUID-based subscriptions table
DROP TABLE IF EXISTS public.subscriptions;

CREATE TABLE public.subscriptions (
  id               SERIAL PRIMARY KEY,
  "userId"         INTEGER NOT NULL,
  plan             VARCHAR(50) NOT NULL,
  status           VARCHAR(50) DEFAULT 'active',
  "monthlyQuota"   INTEGER NOT NULL DEFAULT 100,
  "usedQuota"      INTEGER DEFAULT 0,
  "stripeCustomerId"      VARCHAR(128),
  "stripeSubscriptionId"  VARCHAR(128),
  "paddleSubscriptionId"  VARCHAR(128),
  "paddleCustomerId"      VARCHAR(128),
  "billingCycle"          VARCHAR(50) DEFAULT 'monthly',
  "currentPeriodStart"    TIMESTAMP,
  "currentPeriodEnd"      TIMESTAMP,
  "trialEndsAt"           TIMESTAMP,
  "cancelledAt"           TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions ("userId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON public.subscriptions ("stripeSubscriptionId");

-- Fix revenue_records column names
ALTER TABLE public.revenue_records RENAME COLUMN user_id TO "userId";
ALTER TABLE public.revenue_records RENAME COLUMN recorded_at TO "createdAt";
CREATE INDEX IF NOT EXISTS idx_revenue_records_user_date ON public.revenue_records ("userId", "createdAt");

-- Fix notifications column names
ALTER TABLE public.notifications RENAME COLUMN user_id TO "userId";
ALTER TABLE public.notifications RENAME COLUMN is_read TO "isRead";
ALTER TABLE public.notifications RENAME COLUMN created_at TO "createdAt";
ALTER TABLE public.notifications RENAME COLUMN action_url TO "actionUrl";
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications ("userId");

-- Create activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id           SERIAL PRIMARY KEY,
  "userId"     INTEGER,
  action       VARCHAR(256) NOT NULL,
  "entityType" VARCHAR(128),
  "entityId"   INTEGER,
  details      JSON,
  "ipAddress"  VARCHAR(64),
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log ("userId");

-- Create service_orders table
CREATE TABLE IF NOT EXISTS public.service_orders (
  id                      SERIAL PRIMARY KEY,
  "userId"                INTEGER,
  status                  VARCHAR(64) NOT NULL DEFAULT 'pending',
  amount                  NUMERIC(18, 2),
  currency                VARCHAR(8) DEFAULT 'USD',
  details                 JSON,
  "stripeSessionId"       VARCHAR(256),
  "stripePaymentIntentId" VARCHAR(256),
  "createdAt"             TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_orders_user_id ON public.service_orders ("userId");
CREATE INDEX IF NOT EXISTS idx_service_orders_stripe_session ON public.service_orders ("stripeSessionId");
