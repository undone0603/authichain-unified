/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function findAnyUser() {
  try {
    const qrons = await sql`SELECT user_id FROM qrons LIMIT 1`;
    if (qrons.length > 0) {
      console.log('Found user ID in qrons:', qrons[0].user_id);
      return;
    }
    const brands = await sql`SELECT user_id FROM brands LIMIT 1`;
    if (brands.length > 0) {
      console.log('Found user ID in brands:', brands[0].user_id);
      return;
    }
    console.log('No user IDs found in qrons or brands.');
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

findAnyUser();
