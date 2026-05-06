/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function seed() {
  console.log('Seeding Final "Full Potential" Mock Data...');
  try {
    const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

    // 1. Fee Flows (Economic Burn) - user_id is nullable
    console.log('Seeding fee flows (Global stats)...');
    const feeFlows = [
      { burn_amount: 155.5, net_amount: 1500.0, flow_type: 'authentication_fee' },
      { burn_amount: 420.0, net_amount: 4000.0, flow_type: 'protocol_treasury' },
      { burn_amount: 87.5, net_amount: 800.0, flow_type: 'burn' },
      { burn_amount: 12.0, net_amount: 120.0, flow_type: 'referral' }
    ];

    for (const f of feeFlows) {
      await sql`
        INSERT INTO fee_flows (flow_type, burn_amount, net_amount, status, created_at)
        VALUES (${f.flow_type}, ${f.burn_amount}, ${f.net_amount}, 'confirmed', ${new Date().toISOString()})
      `;
    }

    // 2. Automation Logs
    console.log('Seeding automation logs...');
    const logs = [
      { workflow_name: 'Industrial Anchor', status: 'success', payload: { asset: 'CHRONOS-2026', tx: '0x123...' } },
      { workflow_name: 'Lead Enrichment', status: 'success', payload: { domain: 'bmw.com', score: 95 } },
      { workflow_name: 'Governance Sync', status: 'success', payload: { proposals: 3, votes: 142 } },
      { workflow_name: 'NFT Minting', status: 'success', payload: { contract: '0xabc...', token: '99' } },
      { workflow_name: 'Daily Burn Protocol', status: 'success', payload: { amount: 15.5 } }
    ];

    for (const log of logs) {
      await sql`
        INSERT INTO automation_logs (workflow_name, status, payload, trigger_type, created_at)
        VALUES (${log.workflow_name}, ${log.status}, ${JSON.stringify(log.payload)}, 'cron', ${new Date().toISOString()})
      `;
    }

    // 3. Lead Captures
    console.log('Seeding lead captures...');
    const leads = [
      { email: 'executive@bmw.com', name: 'Mark Levinson', source: 'Industrial Scan', product_interest: 'Telemetry QRON', status: 'hot', score: 95 },
      { email: 'supply-chain@tesla.com', name: 'Elon M.', source: 'API Docs', product_interest: 'AuthiChain Core', status: 'qualified', score: 88 },
      { email: 'marketing@nike.com', name: 'Phil K.', source: 'Gallery', product_interest: 'Artistic QR', status: 'new', score: 45 },
      { email: 'innovation@apple.com', name: 'Tim C.', source: 'Enterprise Portal', product_interest: 'Story Mode', status: 'qualified', score: 92 }
    ];

    for (const l of leads) {
      await sql`
        INSERT INTO lead_captures (email, name, source, product_interest, status, score, created_at)
        VALUES (${l.email}, ${l.name}, ${l.source}, ${l.product_interest}, ${l.status}, ${l.score}, ${new Date().toISOString()})
      `;
    }

    // 4. Products & Certifications (High Performance Demo)
    console.log('Seeding more high-value products...');
    const moreProducts = [
      { name: 'AuthiChain Ghost Series', manufacturer: 'AuthiChain Industrial', desc: 'Next-gen stealth authentication for high-security environments.', model: 'AC-GHOST-V1' },
      { name: 'StrainChain Bloom Matrix', manufacturer: 'StrainChain AgTech', desc: 'Precision growth tracking and genetic mapping protocol.', model: 'SC-BLOOM-2026' }
    ];

    for (const p of moreProducts) {
      const [newP] = await sql`
        INSERT INTO products (name, manufacturer, description, model_number)
        VALUES (${p.name}, ${p.manufacturer}, ${p.desc}, ${p.model})
        RETURNING id
      `;

      await sql`
        INSERT INTO certifications (product_id, serial_number, name, status, approved_at, seal_svg_url)
        VALUES (${newP.id}, ${'SERIAL-' + Math.random().toString(36).substring(7).toUpperCase()}, ${p.name + ' Certification'}, 'approved', now(), '/media/samples/01_flux_qron_space.png')
      `;
    }

    // 5. Seed a demo-user-scoped folder so the dashboard renders org metadata for this seed
    console.log('Seeding demo-user folder for "Full Potential" showcase...');
    await sql`
      INSERT INTO folders (user_id, name, created_at)
      VALUES (${DEMO_USER_ID}, 'Full Potential 2026', ${new Date().toISOString()})
      ON CONFLICT DO NOTHING
    `;

    console.log('✅ Full Potential Showcase seeded.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
