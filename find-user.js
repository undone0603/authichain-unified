/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function findUser() {
  try {
    const users = await sql`SELECT id FROM profiles LIMIT 5`;
    console.log('Valid user IDs:', users.map(u => u.id));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

findUser();
