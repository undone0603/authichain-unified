/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || '');

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

