/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function createDemoProfile() {
  console.log('Initializing Demo Profile...');
  const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';
  try {
    await sql`
      INSERT INTO profiles (id, user_id, email, full_name, tier, generations_limit, generations_used)
      VALUES (${DEMO_USER_ID}, ${DEMO_USER_ID}, 'demo@qron.space', 'Qron Demo Admin', 'enterprise', 1000, 0)
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ Demo profile initialized.');
  } catch (err) {
    console.error('❌ Profile initialization failed:', err.message);
  } finally {
    process.exit();
  }
}

createDemoProfile();
