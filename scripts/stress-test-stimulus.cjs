/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('[stress-test-stimulus] DATABASE_URL is not set. Refusing to run with a hardcoded URL.');
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL);

async function totalStressTest() {
  console.log('🦿 Starting Total Ecosystem Stress Test...');
  try {
    console.log('[1/3] Simulating Foreign Industrial Scan...');
    const [qron] = await sql`SELECT id FROM qrons WHERE mode = 'industrial' LIMIT 1`;
    if (qron) {
      await sql`
        INSERT INTO scan_events (qron_id, ip_address, country, city, user_agent)
        VALUES (${qron.id}, '185.123.45.67', 'RU', 'Moscow', 'Mozilla/5.0 (iPhone)')
      `;
    }

    console.log('[2/3] Simulating Enterprise Lead Capture...');
    await sql`
      INSERT INTO lead_captures (email, name, source, product_interest, status, score)
      VALUES ('ceo@spacex.com', 'Elon M.', 'Starlink Terminal Scan', 'Theater 3 Elite', 'new', 99)
    `;

    console.log('[3/3] Triggering Full Autonomous Cycle...');
    console.log('✅ Stress test stimuli injected.');
  } catch (err) {
    console.error('❌ Stimulus injection failed:', err.message);
  } finally {
    process.exit();
  }
}

totalStressTest();
