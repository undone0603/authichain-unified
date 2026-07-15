/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function checkColumns() {
  try {
    const leadCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_captures'`;
    console.log('lead_captures columns:', leadCols.map(c => c.column_name).join(', '));
    
    const logCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'automation_logs'`;
    console.log('automation_logs columns:', logCols.map(c => c.column_name).join(', '));

    const feeCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_flows'`;
    console.log('fee_flows columns:', feeCols.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkColumns();
