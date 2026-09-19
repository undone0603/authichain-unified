-- 20260919000001_add_api_usage_and_provisioning_state.sql
--
-- Fixes the two breaking findings schema-drift.yml has been reporting against
-- src/db/schema.ts since at least run #47 (2026-09-15): a missing table and a
-- missing column, both on code paths that run in production today, not
-- dormant declarations.
--
--   missing-table:  api_usage
--     src/lib/api-usage.ts:checkAndIncrementUsage() reads/inserts/updates this
--     table on every call, and is called unconditionally as the first thing
--     POST /api/v1/attestations/verify does (src/app/api/v1/attestations/
--     verify/route.ts:24), before the request is even parsed. With the table
--     absent, that transaction throws (42P01), the route's catch-all returns
--     it as a 400 "invalid attestation" instead of ApiUsageLimitError's 402,
--     and attestation verification — the product's core "Truth Layer" check —
--     fails on every request, not just ones over quota.
--
--   missing-column: white_label_clients.provisioning_state
--     server/services/subscription-orchestrator.ts drives vendor onboarding
--     off client.provisioningState ("PENDING" -> "PROVISIONED" ->
--     "PAYMENT_METHOD_ATTACHED" -> "SUBSCRIBED"), and server/db.ts inserts and
--     updates it directly (createClientState, updateVendorState). Without the
--     column, every white-label client insert that includes it raises 42703
--     and the whole onboarding state machine cannot run.
--
-- Both additions are additive and match src/db/schema.ts's declarations
-- exactly (api_usage: lines ~287-303; white_label_clients.provisioningState:
-- line ~650). provisioning_state is added NOT NULL DEFAULT 'PENDING' — safe
-- on an existing table in Postgres 11+, which backfills the default without a
-- full table rewrite rather than failing on existing rows.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "api_usage" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"              INTEGER NOT NULL,
  "usage_count"          INTEGER NOT NULL DEFAULT 0,
  "billing_period_start" TIMESTAMP NOT NULL,
  "billing_period_end"   TIMESTAMP NOT NULL,
  "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_usage_user_id_period_idx"
  ON "api_usage" ("user_id", "billing_period_start");

ALTER TABLE "white_label_clients"
  ADD COLUMN IF NOT EXISTS "provisioning_state" TEXT NOT NULL DEFAULT 'PENDING';
