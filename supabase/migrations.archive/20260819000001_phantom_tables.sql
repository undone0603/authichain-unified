-- 20260819000001_phantom_tables.sql
--
-- Creates the 16 tables that src/db/schema.ts declares and the database does
-- not have. Every one of them is queried by live server code, so each was
-- raising 42P01 rather than returning nothing:
--
--   staking_positions, qron_reward_ledger  server/scheduled-jobs.ts
--   staking_positions, platform_fees,      server/staking/db.ts
--     transactions
--   character_generations, character_assets, verification_claims,
--     consensus_results, qron_reward_ledger, checkpoint_batches
--                                          server/character-service.ts
--   bayesian_priors                        server/jobs/db-helpers.ts,
--                                          server/agents/db-helpers.ts
--   ai_models, model_purchases,            server/marketplace/db.ts
--     model_reviews
--   referral_clicks                        server/referral/core.ts
--   telemetry_events                       src/app/api/telemetry/route.ts,
--                                          src/app/actions/anchoring.ts
--   checkpoint_batches                     src/lib/autonomous-controller.ts
--   prompt_cache                           server/_core/llm.ts
--
-- Six of them (character_assets, character_generations, consensus_results,
-- checkpoint_batches, qron_reward_ledger, verification_claims) already had a
-- migration: drizzle/0005_amazing_molly_hayes.sql. It could never run here —
-- it is MySQL, `CREATE TABLE `character_assets`` with `int AUTO_INCREMENT`,
-- left over from before this project moved to Postgres. That file is dead and
-- this supersedes it.
--
-- Column names are snake_case, matching the rest of the database. The
-- declarations were camelCase and have been corrected in the same commit, so
-- the schema and these statements agree.
--
-- Validated against the live database inside a transaction that was rolled
-- back: all 15 tables created cleanly, nothing persisted. prompt_cache was
-- added afterwards and validated the same way.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "telemetry_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" integer,
  "brand_id" uuid,
  "product_id" integer,
  "theater" text NOT NULL,
  "source" text,
  "metrc_tag" text,
  "raw_payload" jsonb NOT NULL,
  "parsed_state" jsonb NOT NULL,
  "ledger_hash" text,
  "state_hash" text,
  "anchored_tx_hash" text,
  "is_compliant" boolean,
  "gps_location" jsonb,
  "timestamp" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "referral_clicks" (
  "id" serial PRIMARY KEY,
  "referral_code" varchar(32) NOT NULL,
  "ip_address" varchar(64),
  "user_agent" text,
  "referer" text,
  "landing_page" text,
  "converted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_models" (
  "id" serial PRIMARY KEY,
  "name" varchar(256) NOT NULL,
  "description" text,
  "category" varchar(128),
  "price" integer NOT NULL DEFAULT 0,
  "model_status" varchar(50) DEFAULT 'draft',
  "downloads" integer DEFAULT 0,
  "rating" numeric(3, 2) DEFAULT 0,
  "review_count" integer DEFAULT 0,
  "creator_id" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "model_purchases" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "model_id" integer NOT NULL,
  "price_paid" integer NOT NULL,
  "purchase_type" varchar(50) DEFAULT 'purchase',
  "purchase_status" varchar(50) DEFAULT 'active',
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "model_reviews" (
  "id" serial PRIMARY KEY,
  "model_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "rating" integer NOT NULL,
  "review" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "character_generations" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "archetype" varchar(32) NOT NULL,
  "style" varchar(128),
  "colorway" varchar(64),
  "mood" varchar(64),
  "prompt" text NOT NULL,
  "negative_prompt" text,
  "provider" varchar(64),
  "provider_model" varchar(64),
  "variant_count" integer DEFAULT 1,
  "status" varchar(50) DEFAULT 'pending',
  "context" text,
  "best_asset_id" integer,
  "selected_asset_id" integer,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "character_assets" (
  "id" serial PRIMARY KEY,
  "generation_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "image_url" text NOT NULL,
  "prompt" text,
  "is_recommended" integer DEFAULT 0,
  "is_selected" integer DEFAULT 0,
  "mint_status" varchar(50) DEFAULT 'not_minted',
  "nft_token_id" varchar(64),
  "metadata_uri" text,
  "metadata_hash" varchar(128),
  "image_hash" varchar(128),
  "protocol_fit_score" varchar(8),
  "thumbnail_clarity_score" varchar(8),
  "premium_feel_score" varchar(8),
  "silhouette_score" varchar(8),
  "trust_symbolism_score" varchar(8),
  "mint_readiness_score" varchar(8),
  "ui_compatibility_score" varchar(8),
  "total_score" varchar(8),
  "score_iconity" integer,
  "score_trust_clarity" integer,
  "score_premium_feel" integer,
  "score_silhouette" integer,
  "score_ui_compat" integer,
  "score_mint_ready" integer,
  "score_protocol_align" integer,
  "audio_url" text,
  "selected_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification_claims" (
  "id" serial PRIMARY KEY,
  "agent_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "authentication_id" integer,
  "claim_type" varchar(50) NOT NULL,
  "confidence" integer NOT NULL,
  "evidence" text,
  "reasoning" text,
  "weight" varchar(16),
  "status" varchar(50) DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "consensus_results" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL,
  "authentication_id" integer NOT NULL,
  "verdict" varchar(50) NOT NULL,
  "confidence" integer NOT NULL,
  "participant_count" integer DEFAULT 0,
  "finalized_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "qron_reward_ledger" (
  "id" serial PRIMARY KEY,
  "agent_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "amount" numeric(20, 9) NOT NULL,
  "reason" varchar(64) NOT NULL,
  "reference_type" varchar(32),
  "reference_id" integer,
  "status" varchar(50) DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staking_positions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "agent_id" integer,
  "amount" numeric(20, 9) NOT NULL,
  "status" varchar(50) DEFAULT 'active',
  "multiplier" numeric(5, 2) DEFAULT 1.00,
  "apy" numeric(5, 2) DEFAULT 5.00,
  "rewards_earned" numeric(20, 9) DEFAULT 0,
  "last_reward_calculation" timestamp,
  "staked_at" timestamp NOT NULL DEFAULT now(),
  "release_at" timestamp,
  "end_date" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "checkpoint_batches" (
  "id" serial PRIMARY KEY,
  "batch_hash" varchar(128) NOT NULL,
  "blockchain_tx_hash" varchar(128),
  "claim_count" integer DEFAULT 0,
  "status" varchar(50) DEFAULT 'pending',
  "finalized_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "platform_fees" (
  "id" serial PRIMARY KEY,
  "type" varchar(64) NOT NULL,
  "amount" numeric(18, 8) NOT NULL,
  "currency" varchar(16) DEFAULT 'USD',
  "status" varchar(50) DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "type" varchar(64) NOT NULL,
  "amount" numeric(18, 8) NOT NULL,
  "currency" varchar(16) DEFAULT 'USD',
  "status" varchar(50) DEFAULT 'pending',
  "metadata" json,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bayesian_priors" (
  "id" serial PRIMARY KEY,
  "segment" varchar(64) NOT NULL UNIQUE,
  "prior_alpha" numeric(10, 4) DEFAULT 2.0000,
  "prior_beta" numeric(10, 4) DEFAULT 18.0000,
  "current_mean" numeric(5, 4) DEFAULT 0.1000,
  "observations_count" integer DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "prompt_cache" (
  "id" serial PRIMARY KEY,
  "prompt_hash" varchar(128) NOT NULL UNIQUE,
  "response" text NOT NULL,
  "provider" varchar(64),
  "model" varchar(64),
  "usage" json,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_telemetry_theater" ON "telemetry_events" ("theater");
CREATE INDEX IF NOT EXISTS "idx_telemetry_hash" ON "telemetry_events" ("state_hash");
