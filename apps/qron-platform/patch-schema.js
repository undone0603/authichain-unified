/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const migration = `
-- Fix QRONs table for gallery and analytics
ALTER TABLE qrons ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE qrons ADD COLUMN IF NOT EXISTS scan_count integer DEFAULT 0;
ALTER TABLE qrons ADD COLUMN IF NOT EXISTS folder_id uuid;

-- Fix Profiles table for onboarding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS generations_used integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS generations_limit integer DEFAULT 10;
`;

async function migrate() {
  try {
    console.log('Patching schema for gallery and onboarding...');
    await sql.unsafe(migration);
    console.log('✅ Schema patched.');
  } catch (err) {
    console.error('❌ Patch failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();

