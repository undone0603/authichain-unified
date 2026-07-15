/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

async function seed() {
  console.log('Seeding Comprehensive Mock Data for Full Potential Showcase...');
  try {
    const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

    // 2. Add detailed Certifications and Products for the Admin/DPP demo
    console.log('Seeding products and certifications...');
    
    // Create a high-end product
    const [product] = await sql`
      INSERT INTO products (name, manufacturer, description, model_number)
      VALUES (
        'AuthiChain Chronos Elite', 
        'AuthiChain Industrial', 
        'A limited edition cryptographic timepiece featuring a living Ed25519 registry seal. Hand-crafted in the virtual theater.',
        'AC-CHRONOS-2026'
      )
      RETURNING id
    `;

    // Create a certification for it
    const [certResult] = await sql`
      INSERT INTO certifications (product_id, serial_number, name, status, approved_at, seal_svg_url)
      VALUES (
        ${product.id}, 
        'AC-99-TR-2026', 
        'Chronos Elite Genesis Certification',
        'approved', 
        ${new Date().toISOString()}, 
        '/media/samples/03_flux_authichain.png'
      )
      RETURNING id
    `;

    // 3. Add DPP Data for that certification
    await sql`
      INSERT INTO dpp_data (
        certification_id, 
        material_composition, 
        carbon_footprint, 
        repairability_score, 
        supply_chain_provenance
      )
      VALUES (
        ${certResult.id},
        ${JSON.stringify({ 'Titanium': '45%', 'Sapphire Crystal': '20%', 'Recycled Gold': '15%', 'Silicon': '20%' })},
        12.4,
        8,
        ${JSON.stringify([
          { event: 'Material Sourcing', location: 'Swiss Alps', date: '2026-01-10' },
          { event: 'Precision Machining', location: 'Theater 3 Labs', date: '2026-02-15' },
          { event: 'Final Assembly', location: 'Polygon Mainnet', date: '2026-03-20' },
          { event: 'Quality Seal Applied', location: 'AuthiChain Core', date: '2026-04-05' }
        ])}
      )
    `;

    // 4. Add high-value Leads for the CRM demo
    console.log('Seeding high-potential leads...');
    try {
        const leads = [
          { email: 'mark.levinson@bmw.com', status: 'hot', product_interest: 'Industrial QR', source: 'Direct Scan' },
          { email: 'sarah.chen@trulieve.com', status: 'customer', product_interest: 'StrainChain Protocol', source: 'Web Referral' },
          { email: 'director@gilmorecarmuseum.org', status: 'new', product_interest: 'Artifact NFTs', source: 'Event Scan' },
          { email: 'dev-ops@tesla.com', status: 'qualified', product_interest: 'API Access', source: 'Documentation' }
        ];

        for (const lead of leads) {
          await sql`
            INSERT INTO leads (email, status, product_interest, source, created_at)
            VALUES (${lead.email}, ${lead.status}, ${lead.product_interest}, ${lead.source}, ${new Date().toISOString()})
          `;
        }
    } catch (e) {
        console.warn('Leads seeding skipped:', e.message);
    }

    // 5. Add some mock Folders and Tags for organization demo
    console.log('Seeding organization metadata...');
    const [folder] = await sql`
      INSERT INTO folders (user_id, name, created_at)
      VALUES (${DEMO_USER_ID}, 'Industrial 2026', ${new Date().toISOString()})
      RETURNING id
    `;
    const [tag] = await sql`
      INSERT INTO tags (user_id, name, color, created_at)
      VALUES (${DEMO_USER_ID}, 'Priority', '#C9A227', ${new Date().toISOString()})
      RETURNING id
    `;

    // Link some QRONs to the folder
    const linkedQrons = await sql`
      UPDATE qrons
      SET folder_id = ${folder.id}, story_enabled = true
      WHERE is_demo = true AND mode = 'industrial' AND prompt LIKE '%AuthiChain%'
      RETURNING id
    `;

    // Link the same QRONs to the Priority tag via the join table
    for (const q of linkedQrons) {
      await sql`
        INSERT INTO qron_tags (qron_id, tag_id)
        VALUES (${q.id}, ${tag.id})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log('✅ Full Potential Mock Data seeded successfully.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
