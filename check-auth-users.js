/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkAuthUsers() {
  try {
    const users = await sql`SELECT id FROM auth.users LIMIT 1`;
    console.log('Found real auth user:', users[0]?.id);
  } catch (err) {
    console.error('Failed to access auth.users:', err.message);
  } finally {
    process.exit();
  }
}

checkAuthUsers();
