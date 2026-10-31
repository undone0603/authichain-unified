require('dotenv').config();

/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);

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

