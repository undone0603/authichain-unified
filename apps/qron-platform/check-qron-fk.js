/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkQronFK() {
  try {
    const fks = await sql`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'qrons'::regclass
    `;
    console.log('Constraints on qrons:', fks);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkQronFK();
