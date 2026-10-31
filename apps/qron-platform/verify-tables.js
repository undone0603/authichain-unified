/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);

async function checkTables() {
  console.log('Verifying table existence...');
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in public schema:', tables.map(t => t.table_name).join(', '));
  } catch (err) {
    console.error('Failed to list tables:', err.message);
  } finally {
    process.exit();
  }
}

checkTables();
