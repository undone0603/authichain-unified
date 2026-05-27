/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkSubs() {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions'`;
    console.log('subscriptions columns:', cols.map(c => c.column_name).join(', '));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkSubs();
