-- drizzle/migrations/011_revenue_indices.sql
-- Performance indices for revenue-critical webhook and reporting queries.
-- Idempotent: safe to re-run.
--
-- Apply to Supabase via MCP apply_migration ("011_revenue_indices") at deploy.

-- Fast webhook lookup by Stripe subscription ID (called on every invoice event)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON public.subscriptions ("stripeSubscriptionId");

-- Fast revenue reporting by user + date
CREATE INDEX IF NOT EXISTS idx_revenue_records_user_date
  ON public.revenue_records ("userId", "createdAt");

-- Fast notification fetch per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications ("userId");

-- Fast activity log lookup by user (used in many dashboard queries)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON public.activity_log ("userId");
