/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkCols() {
  try {
    const scanCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'scan_events'`;
    console.log('scan_events columns:', scanCols.map(c => c.column_name).join(', '));
    
    const propCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'proposals'`;
    console.log('proposals columns:', propCols.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkCols();
