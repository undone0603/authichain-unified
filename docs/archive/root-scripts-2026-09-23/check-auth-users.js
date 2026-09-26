/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL || '');

async function checkAuthUsers() {
  try {
    const users = await sql`SELECT id FROM auth.users LIMIT 1`;
    console.log('Found real auth user:', users[0]?.id);
  } catch (err) {
    console.error('Failed to access auth.users:', err.message);
  } finally {
    process.exit();
  }
}

checkAuthUsers();
