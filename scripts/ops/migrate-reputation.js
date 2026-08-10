/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

const migration = `
CREATE TABLE IF NOT EXISTS "user_reputation" (
    "user_id" uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    "points" integer DEFAULT 0 NOT NULL,
    "trust_level" text DEFAULT 'novice' NOT NULL,
    "last_updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reputation_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    "event_type" text NOT NULL,
    "points_delta" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reputation_events_user" ON "reputation_events" ("user_id");
`;

async function migrate() {
  try {
    console.log('Running reputation engine migration...');
    await sql.unsafe(migration);
    console.log('✅ REPUTATION MIGRATION COMPLETE: Tables synchronized.');
  } catch (err) {
    console.error('❌ MIGRATION FAILED:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
