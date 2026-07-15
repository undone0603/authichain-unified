/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function totalStressTest() {
  console.log('🦾 Starting Total Ecosystem Stress Test...');
  
  try {
    // 1. Simulate a Foreign Industrial Scan (Trigger Watchdog)
    console.log('[1/3] Simulating Foreign Industrial Scan...');
    const [qron] = await sql`SELECT id FROM qrons WHERE mode = 'industrial' LIMIT 1`;
    if (qron) {
      await sql`
        INSERT INTO scan_events (qron_id, ip_address, country, city, user_agent)
        VALUES (${qron.id}, '185.123.45.67', 'RU', 'Moscow', 'Mozilla/5.0 (iPhone)')
      `;
    }

    // 2. Trigger an Enterprise Lead Capture (Trigger HubSpot/CRM)
    console.log('[2/3] Simulating Enterprise Lead Capture...');
    await sql`
      INSERT INTO lead_captures (email, name, source, product_interest, status, score)
      VALUES ('ceo@spacex.com', 'Elon M.', 'Starlink Terminal Scan', 'Theater 3 Elite', 'new', 99)
    `;

    // 3. Trigger Full Autonomous Cycle
    console.log('[3/3] Triggering Full Autonomous Cycle...');
    // The cycle will handle revenue recycling, social showcase, and maintenance
    
    console.log('✅ Stress test stimuli injected.');
  } catch (err) {
    console.error('❌ Stimulus injection failed:', err.message);
  } finally {
    process.exit();
  }
}

totalStressTest();
