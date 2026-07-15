/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkStatus() {
  try {
    const res = await sql`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'gov_proposals_status_check'`;
    console.log(res[0].pg_get_constraintdef);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkStatus();
