/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function seed() {
  console.log('Seeding Comprehensive Ecosystem Intelligence Data...');
  try {
    const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

    // 1. Brands (Governance/Economy)
    console.log('Seeding brands...');
    const brands = [
      { name: 'Tesla Industrial', domain: 'tesla.com', industry: 'Automotive', qron_staked: 50000, staking_tier: 'elite' },
      { name: 'Trulieve AgTech', domain: 'trulieve.com', industry: 'Agriculture', qron_staked: 25000, staking_tier: 'pro' },
      { name: 'BMW Group', domain: 'bmw.com', industry: 'Automotive', qron_staked: 100000, staking_tier: 'elite' },
      { name: 'Louis Vuitton', domain: 'lvmh.com', industry: 'Luxury', qron_staked: 75000, staking_tier: 'elite' }
    ];

    const mockUserIds = [
        '00000000-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
    ];

    for (let i = 0; i < brands.length; i++) {
      const b = brands[i];
      const uid = mockUserIds[i];
      try {
          await sql`
            INSERT INTO brands (user_id, name, domain, industry, qron_staked, staking_tier, is_verified, is_active)
            VALUES (${uid}, ${b.name}, ${b.domain}, ${b.industry}, ${b.qron_staked}, ${b.staking_tier}, true, true)
            ON CONFLICT (user_id) DO UPDATE SET name = ${b.name}, domain = ${b.domain}, qron_staked = ${b.qron_staked}, staking_tier = ${b.staking_tier}
          `;
      } catch (e) {
          console.warn(`Skipping brand ${b.name}: ${e.message}`);
      }
    }

    // 2. Lead Captures (Pipeline)
    console.log('Seeding lead captures...');
    const leads = [
      { email: 'executive@bmw.com', name: 'Mark Levinson', source: 'Industrial Scan', product_interest: 'Telemetry QRON', status: 'hot', score: 95 },
      { email: 'supply-chain@tesla.com', name: 'Elon M.', source: 'API Docs', product_interest: 'AuthiChain Core', status: 'qualified', score: 88 },
      { email: 'marketing@nike.com', name: 'Phil K.', source: 'Gallery', product_interest: 'Artistic QR', status: 'new', score: 45 }
    ];

    for (const l of leads) {
      await sql`
        INSERT INTO lead_captures (email, name, source, product_interest, status, score, created_at)
        VALUES (${l.email}, ${l.name}, ${l.source}, ${l.product_interest}, ${l.status}, ${l.score}, ${new Date().toISOString()})
      `;
    }

    // 3. Fee Flows (Economic Burn)
    console.log('Seeding fee flows...');
    const feeFlows = [
      { burn_amount: 15.5, net_amount: 150.0, flow_type: 'authentication_fee' },
      { burn_amount: 42.0, net_amount: 400.0, flow_type: 'protocol_treasury' },
      { burn_amount: 8.75, net_amount: 80.0, flow_type: 'burn' }
    ];

    for (const f of feeFlows) {
      await sql`
        INSERT INTO fee_flows (user_id, flow_type, burn_amount, net_amount, status, created_at)
        VALUES (${DEMO_USER_ID}, ${f.flow_type}, ${f.burn_amount}, ${f.net_amount}, 'confirmed', ${new Date().toISOString()})
      `;
    }

    // 4. Automation Logs (Recent Activity)
    console.log('Seeding automation logs...');
    const logs = [
      { workflow_name: 'Industrial Anchor', status: 'success', payload: { asset: 'CHRONOS-2026', tx: '0x123...' } },
      { workflow_name: 'Lead Enrichment', status: 'success', payload: { domain: 'bmw.com', score: 95 } },
      { workflow_name: 'Governance Sync', status: 'success', payload: { proposals: 3, votes: 142 } },
      { workflow_name: 'NFT Minting', status: 'success', payload: { contract: '0xabc...', token: '99' } }
    ];

    for (const log of logs) {
      await sql`
        INSERT INTO automation_logs (workflow_name, status, payload, trigger_type, created_at)
        VALUES (${log.workflow_name}, ${log.status}, ${JSON.stringify(log.payload)}, 'cron', ${new Date().toISOString()})
      `;
    }

    console.log('✅ Ecosystem Intelligence data seeded successfully.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
