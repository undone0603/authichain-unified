/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || '');

async function check() {
  try {
    const res = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'inbound_replies'
      );
    `;
    console.log('inbound_replies exists:', res[0].exists);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

check();
