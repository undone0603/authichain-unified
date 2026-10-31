/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);

async function checkLogs() {
  try {
    const logs = await sql`SELECT workflow_name, status, created_at FROM automation_logs ORDER BY created_at DESC LIMIT 10`;
    console.table(logs);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkLogs();
