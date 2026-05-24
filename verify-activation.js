/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function verify() {
  try {
    await sql`INSERT INTO lead_captures (email, source, status) VALUES ('undone.k@gmail.com', 'system_activation', 'qualified')`;
    console.log('✅ Handshake Verified: Machine is writing to database.');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  } finally {
    process.exit();
  }
}

verify();

