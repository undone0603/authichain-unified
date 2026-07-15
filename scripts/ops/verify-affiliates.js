/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkAffiliates() {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates'`;
    console.log('affiliates columns:', cols.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkAffiliates();
