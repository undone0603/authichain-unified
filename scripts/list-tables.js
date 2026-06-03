/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function listTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log('Tables in database:', tables.map(t => t.table_name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

listTables();
