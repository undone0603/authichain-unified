/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function check() {
  try {
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products';
    `;
    console.log('Columns in products:', cols.map(c => c.column_name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

check();

