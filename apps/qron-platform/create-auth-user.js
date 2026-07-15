/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function createAuthUser() {
  const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';
  console.log('Creating auth user...');
  try {
    await sql`
      INSERT INTO auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
      VALUES (
        ${DEMO_USER_ID}, 
        'demo@qron.space', 
        now(), 
        '{"provider":"email","providers":["email"]}', 
        '{"full_name":"Demo Admin"}', 
        'authenticated', 
        'authenticated'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ Auth user created.');
  } catch (err) {
    console.error('❌ Auth user creation failed:', err.message);
  } finally {
    process.exit();
  }
}

createAuthUser();
