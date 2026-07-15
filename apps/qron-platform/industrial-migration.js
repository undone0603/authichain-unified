/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const migration = `
-- Industrial Expansion: DPP & API
CREATE TABLE IF NOT EXISTS "dpp_data" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "certification_id" uuid NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    "material_composition" jsonb NOT NULL,
    "carbon_footprint" numeric(12, 4),
    "repairability_score" numeric(4, 2),
    "end_of_life_instructions" text,
    "supply_chain_provenance" jsonb,
    "last_updated" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "name" text NOT NULL,
    "key_prefix" text NOT NULL,
    "key_hash" text NOT NULL,
    "scopes" jsonb DEFAULT '["read", "write"]'::jsonb,
    "last_used_at" timestamp,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_dpp_cert" ON "dpp_data" ("certification_id");
CREATE INDEX IF NOT EXISTS "idx_api_user" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_api_prefix" ON "api_keys" ("key_prefix");
`;

async function migrate() {
  try {
    console.log('Enterprise Scaling: Activating DPP & API Key logic...');
    await sql.unsafe(migration);
    console.log('✅ Industrial tables live.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();

