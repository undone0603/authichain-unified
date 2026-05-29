/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkConstraints() {
  try {
    const constraints = await sql`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'brands'::regclass
    `;
    console.log('Constraints on brands:', constraints);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkConstraints();
