/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const migration = `
-- Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number text;

-- Certifications
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS qr_data text;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS qr_image_url text;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS seal_svg_url text;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS revoked_by text;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS revoked_at timestamp;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS revocation_reason text;

-- Redirect Rules (Table might be missing or incomplete)
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

-- Folders & Tags
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

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_products_manufacturer" ON "products" ("manufacturer");
CREATE INDEX IF NOT EXISTS "idx_certifications_serial" ON "certifications" ("serial_number");
CREATE INDEX IF NOT EXISTS "idx_redirect_qron" ON "redirect_rules" ("qron_id");
CREATE INDEX IF NOT EXISTS "idx_folders_user" ON "folders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tags_user" ON "tags" ("user_id");
`;

async function migrate() {
  try {
    console.log('Running manual migration for missing columns...');
    await sql.unsafe(migration);
    console.log('✅ Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();

