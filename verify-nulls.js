/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkNullability() {
  try {
    const brands = await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'user_id'`;
    console.log('brands user_id nullable:', brands[0].is_nullable);

    const fee = await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'fee_flows' AND column_name = 'user_id'`;
    console.log('fee_flows user_id nullable:', fee[0].is_nullable);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkNullability();
