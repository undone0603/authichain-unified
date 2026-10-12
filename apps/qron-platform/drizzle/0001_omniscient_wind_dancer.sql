CREATE TABLE "brand_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"endpoint_url" text NOT NULL,
	"secret_key" text NOT NULL,
	"events" text[] DEFAULT '{"qron_scanned"}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deliveries_total" integer DEFAULT 0,
	"deliveries_failed" integer DEFAULT 0,
	"last_delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text,
	"serial_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qr_image_url" text,
	"seal_svg_url" text,
	"approved_at" timestamp,
	"issued_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "certifications_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "component_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"component_name" text NOT NULL,
	"origin_country" text,
	"supplier_id" uuid,
	"material_cert" text,
	"anchored_tx" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpp_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" uuid NOT NULL,
	"material_composition" jsonb,
	"carbon_footprint" numeric,
	"repairability_score" numeric,
	"end_of_life_instructions" text,
	"supply_chain_provenance" jsonb,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" integer PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"current_stage" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_action_at" timestamp,
	"next_action_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_timestamp" timestamp DEFAULT now() NOT NULL,
	"location" text,
	"actor_id" uuid,
	"evidence_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"manufacturer" text,
	"model_number" text,
	"category" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qron_tags" (
	"qron_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "qron_tags_qron_id_tag_id_pk" PRIMARY KEY("qron_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "redirect_rules" (
	"id" integer PRIMARY KEY NOT NULL,
	"qron_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"rule_type" text NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb,
	"weight" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"click_count" integer DEFAULT 0,
	"geo_targets" text[],
	"device_targets" text[],
	"start_time" timestamp,
	"end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qron_id" integer,
	"ip" text,
	"country" text,
	"region" text,
	"city" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"brand_id" uuid,
	"product_id" uuid,
	"theater" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"parsed_state" jsonb NOT NULL,
	"state_hash" text NOT NULL,
	"anchored_tx_hash" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"logo_url" text,
	"primary_color" text,
	"secondary_color" text,
	"api_key_prefix" text,
	"billing_plan" text DEFAULT 'reseller_standard' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_clients_domain_unique" UNIQUE("domain"),
	CONSTRAINT "white_label_clients_api_key_prefix_unique" UNIQUE("api_key_prefix")
);
--> statement-breakpoint
ALTER TABLE "automation_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fee_flows" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_captures" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "qron_deliveries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "qron_nft_mints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "automation_logs" CASCADE;--> statement-breakpoint
DROP TABLE "fee_flows" CASCADE;--> statement-breakpoint
DROP TABLE "lead_captures" CASCADE;--> statement-breakpoint
DROP TABLE "qron_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE "qron_nft_mints" CASCADE;--> statement-breakpoint
DROP INDEX "idx_brands_tier";--> statement-breakpoint
DROP INDEX "idx_living_art_start";--> statement-breakpoint
DROP INDEX "idx_profiles_tier";--> statement-breakpoint
DROP INDEX "idx_qron_generations_user_id";--> statement-breakpoint
DROP INDEX "idx_qrons_mode";--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "qron_staked" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "qron_staked" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "unit_cost_discount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "unit_cost_discount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "base_unit_cost" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "base_unit_cost" SET DEFAULT '0.05';--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "is_verified" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "is_active" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "is_active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "qron_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "qron_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "is_active" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "is_active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "qrons" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "qrons" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "qrons" ALTER COLUMN "style" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "wallet_address" text;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "schedule_type" text;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "cron_expression" text;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "last_run_at" timestamp;--> statement-breakpoint
ALTER TABLE "living_art_schedules" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatarUrl" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "secondaryColor" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "apiKey" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "apiSecret" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "affiliate_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "story_mode_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "scan_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "story_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "story_tier" text;--> statement-breakpoint
ALTER TABLE "qrons" ADD COLUMN "story_unlocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_provenance" ADD CONSTRAINT "component_provenance_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_brand_webhooks_brand" ON "brand_webhooks" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_provenance_product" ON "component_provenance" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sequence_lead" ON "lead_sequences" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_sequence_status" ON "lead_sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lifecycle_product" ON "product_lifecycle_events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_redirect_qron" ON "redirect_rules" USING btree ("qron_id");--> statement-breakpoint
CREATE INDEX "idx_telemetry_theater" ON "telemetry_events" USING btree ("theater");--> statement-breakpoint
CREATE INDEX "idx_telemetry_hash" ON "telemetry_events" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "idx_white_label_domain" ON "white_label_clients" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_brands_domain" ON "brands" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_profiles_user_id" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qrons_short_code" ON "qrons" USING btree ("short_code");--> statement-breakpoint
ALTER TABLE "brands" DROP COLUMN "staking_wallet_address";--> statement-breakpoint
ALTER TABLE "living_art_schedules" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "living_art_schedules" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "living_art_schedules" DROP COLUMN "end_time";--> statement-breakpoint
ALTER TABLE "living_art_schedules" DROP COLUMN "target_image_url";--> statement-breakpoint
ALTER TABLE "living_art_schedules" DROP COLUMN "transition_type";--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_affiliate_id_unique" UNIQUE("affiliate_id");