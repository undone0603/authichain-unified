CREATE TYPE "public"."tier" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"status" text NOT NULL,
	"payload" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
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
--> statement-breakpoint
CREATE TABLE "fee_flows" (
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
--> statement-breakpoint
CREATE TABLE "lead_captures" (
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
--> statement-breakpoint
CREATE TABLE "living_art_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qron_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"target_image_url" text NOT NULL,
	"transition_type" text DEFAULT 'default',
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"generations_used" integer DEFAULT 0 NOT NULL,
	"generations_limit" integer DEFAULT 10 NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "qron_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_session_id" text NOT NULL,
	"customer_email" text,
	"image_url" text,
	"qr_url" text,
	"prompt" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qron_deliveries_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "qron_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"url" text,
	"prompt" text,
	"mode" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qron_nft_mints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qron_id" text,
	"recipient" text NOT NULL,
	"image_url" text,
	"destination_url" text,
	"tx_hash" text NOT NULL,
	"chain" text,
	"contract_address" text,
	"minted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qrons" (
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
--> statement-breakpoint
CREATE INDEX "idx_automation_name" ON "automation_logs" USING btree ("workflow_name");--> statement-breakpoint
CREATE INDEX "idx_brands_user" ON "brands" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_brands_tier" ON "brands" USING btree ("staking_tier");--> statement-breakpoint
CREATE INDEX "idx_fee_brand" ON "fee_flows" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_fee_type" ON "fee_flows" USING btree ("flow_type");--> statement-breakpoint
CREATE INDEX "idx_fee_created" ON "fee_flows" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_email" ON "lead_captures" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_lead_status" ON "lead_captures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_living_art_qron" ON "living_art_schedules" USING btree ("qron_id");--> statement-breakpoint
CREATE INDEX "idx_living_art_start" ON "living_art_schedules" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_profiles_stripe_customer" ON "profiles" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_tier" ON "profiles" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_qron_deliveries_session" ON "qron_deliveries" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "idx_qron_deliveries_email" ON "qron_deliveries" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "idx_qron_generations_user_id" ON "qron_generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qron_nft_mints_recipient" ON "qron_nft_mints" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX "idx_qron_nft_mints_tx_hash" ON "qron_nft_mints" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_qron_nft_mints_qron_id" ON "qron_nft_mints" USING btree ("qron_id");--> statement-breakpoint
CREATE INDEX "idx_qrons_user_id" ON "qrons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qrons_mode" ON "qrons" USING btree ("mode");