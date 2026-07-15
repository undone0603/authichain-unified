/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function seedLeaderboard() {
  console.log('Seeding Affiliate Growth Leaderboard...');
  try {
    const affiliates = [
      { code: 'GROWTH-ELITE', count: 142, revenue: 12400 },
      { code: 'VISUAL-WEB', count: 89, revenue: 8200 },
      { code: 'IND-SUPPLY', count: 64, revenue: 5600 },
      { code: 'BETA-BLOCK', count: 42, revenue: 3100 },
      { code: 'MODERN-MKT', count: 31, revenue: 2200 }
    ];

    const mockUserIds = [
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '66666666-6666-6666-6666-666666666666',
        '77777777-7777-7777-7777-777777777777',
        '88888888-8888-8888-8888-888888888888'
    ];

    for (let i = 0; i < affiliates.length; i++) {
      const a = affiliates[i];
      const uid = mockUserIds[i];
      try {
          await sql`
            INSERT INTO affiliates (user_id, affiliatecode, total_referrals, total_earnings, status, created_at)
            VALUES (${uid}, ${a.code}, ${a.count}, ${a.revenue * 0.2}, 'active', ${new Date().toISOString()})
          `;
      } catch (e) {
          console.warn(`Skipping ${a.code}: ${e.message}`);
      }
    }
    console.log('✅ Leaderboard seeded.');
  } catch (err) {
    console.error('❌ Leaderboard seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seedLeaderboard();
