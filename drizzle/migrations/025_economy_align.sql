-- Additive alignment for the authentic economy on QRON-v2
-- (Supabase project nhdnkzhtadfkkluiulhs).
--
-- Prod already has fee_flows, brands, automation_logs, qrons, certifications,
-- products, lead_captures, profiles. This file is IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS only — never DROP, never CREATE of those existing tables.
--
-- Authoritative brands staking columns on prod today:
--   staking_tier, qron_staked, staking_locked_until, wallet_address,
--   unit_cost_discount, base_unit_cost
-- Do not invent staking_wallet_address (not on prod; schema-drift 42703).

CREATE TABLE IF NOT EXISTS "automation_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workflow_name" text NOT NULL,
    "trigger_type" text NOT NULL,
    "status" text NOT NULL,
    "payload" text,
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Authoritative staking / fee columns. ADD COLUMN is a no-op when present.
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "staking_tier" text DEFAULT 'none';
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "qron_staked" numeric DEFAULT 0;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "staking_locked_until" timestamptz;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "unit_cost_discount" numeric DEFAULT 0;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "base_unit_cost" numeric DEFAULT 0.05;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "wallet_address" text;

ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "flow_type" text;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "gross_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "discount_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "net_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "staker_reward_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "treasury_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "burn_amount" numeric DEFAULT 0;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "tx_hash" text;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_automation_name" ON "automation_logs" ("workflow_name");
CREATE INDEX IF NOT EXISTS "idx_brands_user" ON "brands" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_brands_tier" ON "brands" ("staking_tier");
CREATE INDEX IF NOT EXISTS "idx_fee_brand" ON "fee_flows" ("brand_id");
CREATE INDEX IF NOT EXISTS "idx_fee_type" ON "fee_flows" ("flow_type");
CREATE INDEX IF NOT EXISTS "idx_fee_created" ON "fee_flows" ("created_at");
