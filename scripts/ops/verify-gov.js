/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkGov() {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'gov_proposals'`;
    console.log('gov_proposals columns:', cols.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkGov();
