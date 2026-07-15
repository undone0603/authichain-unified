/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const schema = `
CREATE TABLE IF NOT EXISTS "automation_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workflow_name" text NOT NULL,
    "trigger_type" text NOT NULL,
    "status" text NOT NULL,
    "payload" text,
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
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

CREATE TABLE IF NOT EXISTS "lead_captures" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "name" text,
    "source" text DEFAULT 'website',
    "page_url" text,
    "product_interest" text DEFAULT 'qron',
    "utm_source" text,
    "utm_medium" text,
    "utm_campaign" text,
    "status" text DEFAULT 'new',
    "score" integer DEFAULT 0,
    "metadata" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "profiles" (
    "id" uuid PRIMARY KEY NOT NULL,
    "email" text,
    "tier" text DEFAULT 'free' NOT NULL,
    "generations_used" integer DEFAULT 0 NOT NULL,
    "generations_limit" integer DEFAULT 10 NOT NULL,
    "stripe_customer_id" text UNIQUE,
    "stripe_subscription_id" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "qrons" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "mode" text DEFAULT 'standard' NOT NULL,
    "target_url" text NOT NULL,
    "image_url" text NOT NULL,
    "prompt" text,
    "style" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_automation_name" ON "automation_logs" ("workflow_name");
CREATE INDEX IF NOT EXISTS "idx_brands_user" ON "brands" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_fee_brand" ON "fee_flows" ("brand_id");
CREATE INDEX IF NOT EXISTS "idx_lead_email" ON "lead_captures" ("email");
CREATE INDEX IF NOT EXISTS "idx_qrons_user_id" ON "qrons" ("user_id");

CREATE TABLE IF NOT EXISTS "products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "manufacturer" text NOT NULL,
    "model_number" text,
    "category" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "certifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "serial_number" text NOT NULL UNIQUE,
    "status" text DEFAULT 'pending' NOT NULL,
    "qr_data" text,
    "qr_image_url" text,
    "seal_svg_url" text,
    "approved_by" text,
    "approved_at" timestamp,
    "revoked_by" text,
    "revoked_at" timestamp,
    "revocation_reason" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "issued_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "redirect_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "qron_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "name" text NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "rule_type" text NOT NULL,
    "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "start_time" timestamp,
    "end_time" timestamp,
    "a_b_variant" text,
    "a_b_weight" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_products_manufacturer" ON "products" ("manufacturer");
CREATE INDEX IF NOT EXISTS "idx_certifications_serial" ON "certifications" ("serial_number");
CREATE INDEX IF NOT EXISTS "idx_redirect_qron" ON "redirect_rules" ("qron_id");

CREATE TABLE IF NOT EXISTS "folders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tags" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" text NOT NULL,
    "color" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "qron_tags" (
    "qron_id" uuid NOT NULL REFERENCES qrons(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY ("qron_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "idx_folders_user" ON "folders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tags_user" ON "tags" ("user_id");
`;

async function activate() {
  try {
    console.log('Handshaking with database...');
    await sql.unsafe(schema);
    console.log('✅ ECONOMY ACTIVATED: Schema synchronized successfully.');
  } catch (err) {
    console.error('❌ ACTIVATION FAILED:', err.message);
  } finally {
    process.exit();
  }
}

activate();

