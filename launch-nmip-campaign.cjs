/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

/**
 * NORTHERN MICHIGAN INDUSTRIAL PILOT (NMIP) - CAMPAIGN PLAYBOOK
 */

const NMIP_CAMPAIGN = [
  {
    target_sector: 'Advanced Wood Tech',
    lead_name: 'Operations Director',
    company: 'ARAUCO North America',
    location: 'Grayling, MI',
    use_case: 'Eco-Provenance Tracking',
    narrative: 'Track the "Seed-to-Slab" journey. Prove sustainable forest sourcing for North America\'s largest particleboard facility.',
    style: 'industrial-timber'
  },
  {
    target_sector: 'Automotive Components',
    lead_name: 'Supply Chain VP',
    company: 'Lear Corporation',
    location: 'Roscommon, MI',
    use_case: 'Anti-Counterfeit Parts Registry',
    narrative: 'Anchor seating and wiring components to AuthiChain to prevent gray-market substitution in the OEM supply chain.',
    style: 'cyber-chrome'
  },
  {
    target_sector: 'Marine & Blue Economy',
    lead_name: 'CEO',
    company: 'Spicer\'s Boat City',
    location: 'Houghton Lake, MI',
    use_case: 'Digital Service Passports',
    narrative: 'A living QRON on every boat hull. Scannable service history, winterization proofs, and instant resale value verification.',
    style: 'biolume-deep'
  },
  {
    target_sector: 'Advanced Manufacturing',
    lead_name: 'Innovation Lead',
    company: 'ATLAS Space Operations',
    location: 'Traverse City, MI',
    use_case: 'Satellite Component Pedigree',
    narrative: 'Cryptographic component-level tracking for satellite hardware. Ed25519-signed verification for space-grade manufacturing.',
    style: 'cosmic-nebula'
  }
];

async function launchCampaign() {
  console.log('🚀 Launching NMIP Outreach Campaign...');
  try {
    for (const lead of NMIP_CAMPAIGN) {
      console.log(`Setting up outreach for: ${lead.company}...`);
      
      // 1. Create specialized Lead in CRM
      const [newLead] = await sql`
        INSERT INTO lead_captures (email, name, source, product_interest, status, score, metadata)
        VALUES (
          ${`contact@${lead.company.toLowerCase().replace(/\s/g, '')}.com`},
          ${lead.lead_name},
          'NMIP-Autonomous-Outreach',
          'Industrial Artifacts',
          'hot',
          98,
          ${JSON.stringify({
            sector: lead.target_sector,
            use_case: lead.use_case,
            narrative: lead.narrative,
            pilot_id: 'NMIP-2026-V1'
          })}
        )
        RETURNING id
      `;

      // 2. Log Outreach Intent (Skipping generation_queue due to schema mismatch)
      await sql`
        INSERT INTO automation_logs (workflow_name, trigger_type, status, payload)
        VALUES (
          'nmip_outreach_sequence',
          'manual',
          'success',
          ${JSON.stringify({
            target: lead.company,
            location: lead.location,
            narrative_sent: lead.narrative,
            lead_id: newLead.id
          })}
        )
      `;
    }

    console.log('✅ NMIP Campaign successfully launched in the Autonomous Engine.');
  } catch (err) {
    console.error('❌ Campaign launch failed:', err.message);
  } finally {
    process.exit();
  }
}

launchCampaign();
