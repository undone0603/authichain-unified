-- 20260819000002_orphan_columns.sql
--
-- Adds the 56 columns src/db/schema.ts declares that the database did not have
-- and that live code actually reads or writes. Queries touching them raised
-- 42703.
--
-- These are the survivors of the 142 "orphan column" drift findings — declared
-- with no counterpart in the database under either spelling. They were split
-- three ways:
--
--   25  renamed in the schema to an existing column (no DDL; see the commit)
--   61  declarations deleted — nothing in the codebase referenced them
--   56  added here — code depends on them
--
-- The 61 were not judged by eye. Every remaining orphan declaration was deleted
-- at once and `tsc` was run: each resulting error named a property the codebase
-- genuinely uses. Those were restored and the rest stayed deleted. The split is
-- what the compiler proved, not what looked unused.
--
-- Every column is nullable so existing rows survive the add, carrying only the
-- default its declaration specifies. Idempotent — safe to re-run.
--
-- Validated against the live database inside a transaction that was rolled
-- back: all 56 added cleanly, nothing persisted.
--
-- KNOWN DUPLICATES, flagged rather than resolved: products.status,
-- nft_collections.status and autopilot_config.enabled overlap the existing
-- is_active / is_enabled booleans. The declarations type them as integer, so
-- pointing them at the boolean columns would have type-checked and then failed
-- at runtime — the exact class of bug this whole effort exists to remove.
-- Adding the column keeps the code working today; consolidating them is a
-- deliberate follow-up that has to change the TypeScript type too.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "serial_number" varchar(256);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturing_date" timestamp;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "is_public" integer DEFAULT 0;
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "share_token" varchar(128);
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "share_count" integer DEFAULT 0;
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "blockchain_verified" integer DEFAULT 0;
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "metadata" json;
ALTER TABLE "authentications" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "certificate_number" varchar(64);
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "nft_token_id" varchar(256);
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "nft_contract_address" varchar(64);
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "product_id" integer;
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "short_code" text;
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "qr_image_url" text;
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "scan_count" integer DEFAULT 0;
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "last_scanned_at" timestamp;
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'standard';
ALTER TABLE "qr_codes" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}';
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "prospect_name" varchar(256);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "prospect_email" varchar(320);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "prospect_company" varchar(256);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "prospect_title" varchar(256);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "industry" varchar(128);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "template_used" varchar(128);
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "generated_by" varchar(64) DEFAULT 'ai_manager';
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "approved_by" integer;
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "referred_id" integer;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "tier" varchar(50);
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "commission_paid" numeric(10, 2) DEFAULT 0;
ALTER TABLE "autopilot_config" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) DEFAULT 'default';
ALTER TABLE "autopilot_config" ADD COLUMN IF NOT EXISTS "enabled" integer DEFAULT 0;
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "customer_name" varchar(256);
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "delivery_url" text;
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "metadata" json;
ALTER TABLE "nft_collections" ADD COLUMN IF NOT EXISTS "slug" varchar(128);
ALTER TABLE "nft_collections" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active';
ALTER TABLE "nfts" ADD COLUMN IF NOT EXISTS "owner_id" integer;
ALTER TABLE "dead_letter_queue" ADD COLUMN IF NOT EXISTS "task_type" varchar(128);
ALTER TABLE "dead_letter_queue" ADD COLUMN IF NOT EXISTS "last_attempted_at" timestamp;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "metadata" json;
ALTER TABLE "visitor_profiles" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "visitor_profiles" ADD COLUMN IF NOT EXISTS "converted" integer DEFAULT 0;
ALTER TABLE "visitor_profiles" ADD COLUMN IF NOT EXISTS "time_on_site" integer DEFAULT 0;
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "segment" varchar(64);
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "country" varchar(8);
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "utm_source" varchar(128);
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "device_type" varchar(32);
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "ai_generated" integer DEFAULT 0;
ALTER TABLE "personalization_rules" ADD COLUMN IF NOT EXISTS "created_by" integer;
ALTER TABLE "personalization_events" ADD COLUMN IF NOT EXISTS "metadata" json;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "lead_email" varchar(320);
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "segment" varchar(64);
