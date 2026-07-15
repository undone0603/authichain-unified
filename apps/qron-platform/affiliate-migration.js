/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const migration = `
-- Affiliate Expansion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_id text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by text;

CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "affiliate_id" text NOT NULL,
    "amount" numeric(12, 2) NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "currency" text DEFAULT 'USD' NOT NULL,
    "paid_at" timestamp,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "affiliate_id" text NOT NULL,
    "referred_user_id" uuid NOT NULL,
    "conversion_type" text NOT NULL,
    "commission_earned" numeric(12, 2) DEFAULT '0',
    "status" text DEFAULT 'tracked' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_profiles_affiliate" ON "profiles" ("affiliate_id");
CREATE INDEX IF NOT EXISTS "idx_payout_affiliate" ON "affiliate_payouts" ("affiliate_id");
CREATE INDEX IF NOT EXISTS "idx_referral_affiliate" ON "referrals" ("affiliate_id");
`;

async function migrate() {
  try {
    console.log('Scaling: Adding Affiliate & Referral logic...');
    await sql.unsafe(migration);
    console.log('✅ Affiliate tables live.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();

