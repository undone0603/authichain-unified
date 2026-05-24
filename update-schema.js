/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const schema = `
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
`;

async function update() {
  try {
    console.log('Updating database schema...');
    await sql.unsafe(schema);
    console.log('✅ Schema updated: Products, Certifications, and Redirect Rules added.');
  } catch (err) {
    console.error('❌ Update failed:', err.message);
  } finally {
    process.exit();
  }
}

update();

