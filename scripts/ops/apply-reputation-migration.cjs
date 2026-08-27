/* eslint-disable @typescript-eslint/no-require-imports */
// Owner-approved 2026-07-15: applies the reputation tables (additive,
// IF NOT EXISTS) + scheduled_job_runs if absent, against DATABASE_URL.
require('dotenv').config();
const fs = require('fs');
const postgres = require('postgres');

const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]+/, '');
const sql = postgres(url, { ssl: { rejectUnauthorized: false } });

const SCHEDULED_JOB_RUNS = `
CREATE TABLE IF NOT EXISTS "scheduled_job_runs" (
  "id" serial PRIMARY KEY,
  "job_name" varchar(128) NOT NULL,
  "status" varchar(50) NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "duration" integer,
  "itemsProcessed" integer DEFAULT 0,
  "result" json,
  "error" text
);`;

(async () => {
  const before = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('user_reputation','reputation_events','scheduled_job_runs')`;
  console.log('before:', before.map(t => t.table_name).join(', ') || 'none');

  const reputationSql = fs.readFileSync('supabase/migrations/20260715000001_create_reputation_tables.sql', 'utf8');
  await sql.unsafe(reputationSql);
  console.log('reputation migration applied');

  await sql.unsafe(SCHEDULED_JOB_RUNS);
  console.log('scheduled_job_runs ensured');

  const after = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('user_reputation','reputation_events','scheduled_job_runs')
    ORDER BY table_name`;
  console.log('after:', after.map(t => t.table_name).join(', '));

  for (const t of ['user_reputation', 'reputation_events', 'scheduled_job_runs']) {
    const n = await sql.unsafe(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`${t}: ${n[0].n} rows`);
  }
  await sql.end();
  console.log('MIGRATION-OK');
})().catch(e => { console.error('MIGRATION-FAILED:', e.message); process.exit(1); });
