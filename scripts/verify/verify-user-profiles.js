import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL || '');

async function checkUserProfiles() {
  try {
    const data = await sql`SELECT id, user_id FROM user_profiles LIMIT 5`;
    console.log('user_profiles data:', data);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit();
  }
}

checkUserProfiles();
