require('dotenv').config();

/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);

async function check() {
  try {
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products';
    `;
    console.log('Columns in products:', cols.map(c => c.column_name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

check();

