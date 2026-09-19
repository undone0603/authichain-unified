-- Additive alignment for the authentic economy on QRON-v2
-- (Supabase project nhdnkzhtadfkkluiulhs).
--
-- Prod already has fee_flows, brands, automation_logs, qrons, certifications,
-- products, lead_captures, profiles. This file is IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS only — never DROP, never CREATE without IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "automation_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workflow_name" text NOT NULL,
    "trigger_type" text NOT NULL,
    "status" text NOT NULL,
    "payload" text,
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fee_flows" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "brand_id" uuid,
    "user_id" uuid,
    "flow_type" text NOT NULL,
    "gross_amount" text DEFAULT '0' NOT NULL,
    "discount_amount" text DEFAULT '0' NOT NULL,
    "net_amount" text DEFAULT '0' NOT NULL,
    "staker_reward_amount" text DEFAULT '0',
    "treasury_amount" text DEFAULT '0',
    "burn_amount" text DEFAULT '0',
    "tx_hash" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "metadata" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "confirmed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "brands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" text NOT NULL,
    "domain" text,
    "logo_url" text,
    "industry" text,
    "staking_tier" text DEFAULT 'none' NOT NULL,
    "qron_staked" text DEFAULT '0' NOT NULL,
    "staking_wallet_address" text,
    "unit_cost_discount" text DEFAULT '0' NOT NULL,
    "base_unit_cost" text DEFAULT '0.05' NOT NULL,
    "is_verified" integer DEFAULT 0 NOT NULL,
    "is_active" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Authoritative staking / fee columns. ADD COLUMN is a no-op when present.
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "staking_tier" text DEFAULT 'none' NOT NULL;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "qron_staked" text DEFAULT '0' NOT NULL;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "staking_wallet_address" text;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "unit_cost_discount" text DEFAULT '0' NOT NULL;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "base_unit_cost" text DEFAULT '0.05' NOT NULL;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "wallet_address" text;

ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "brand_id" uuid;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "flow_type" text;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "gross_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "discount_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "net_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "staker_reward_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "treasury_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "burn_amount" text DEFAULT '0';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "tx_hash" text;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending';
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "metadata" text;
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "fee_flows" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_automation_name" ON "automation_logs" ("workflow_name");
CREATE INDEX IF NOT EXISTS "idx_brands_user" ON "brands" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_brands_tier" ON "brands" ("staking_tier");
CREATE INDEX IF NOT EXISTS "idx_fee_brand" ON "fee_flows" ("brand_id");
CREATE INDEX IF NOT EXISTS "idx_fee_type" ON "fee_flows" ("flow_type");
CREATE INDEX IF NOT EXISTS "idx_fee_created" ON "fee_flows" ("created_at");
