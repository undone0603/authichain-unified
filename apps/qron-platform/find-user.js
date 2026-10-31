/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const sql = postgres(databaseUrl);

async function findUser() {
  try {
    const users = await sql`SELECT id FROM profiles LIMIT 5`;
    console.log('Valid user IDs:', users.map(u => u.id));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

findUser();
