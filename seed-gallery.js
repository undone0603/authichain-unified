/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const galleryItems = [
  {
    mode: 'industrial',
    target_url: 'https://authichain.com',
    image_url: '/media/samples/03_flux_authichain.png',
    prompt: 'AuthiChain - Renaissance Marble · Baroque Gold. Blockchain/Authentication seal.',
    style: 'renaissance-gold',
  },
  {
    mode: 'industrial',
    target_url: 'https://strainchain.io',
    image_url: '/media/samples/02_flux_strainchain.png',
    prompt: 'StrainChain - Bioluminescent Jungle · Sacred Geometry. Cannabis/AgTech provenance.',
    style: 'bio-jungle',
  },
  {
    mode: 'industrial',
    target_url: 'https://luxury.fashion',
    image_url: '/media/samples/06_flux_haute_couture.png',
    prompt: 'Haute Couture - Art Deco Gold · Black Obsidian Velvet. Luxury Fashion validation.',
    style: 'art-deco-velvet',
  },
  {
    mode: 'industrial',
    target_url: 'https://ev-industry.ai',
    image_url: '/media/samples/04_flux_ev_industry.png',
    prompt: 'EV Industry - Plasma Lightning · Chrome Supercar. Electric Automotive telemetry.',
    style: 'plasma-chrome',
  },
  {
    mode: 'holographic',
    target_url: 'https://qron.space/demo/holographic',
    image_url: '/media/samples/02-holographic-mosaic.png',
    prompt: 'Holographic Mosaic - Shimmering iridescent tiles that shift color based on viewing angle.',
    style: 'holo-mosaic',
  },
  {
    mode: 'cyberpunk',
    target_url: 'https://qron.space/demo/neon',
    image_url: '/media/samples/01-neon-glitch.png',
    prompt: 'Neon Glitch - High-contrast cyan and magenta digital noise with glowing scan lines.',
    style: 'neon-glitch',
  }
];

async function seed() {
  console.log('Seeding QRON Gallery with new Flux Masterpieces...');
  try {
    // Clear existing demos to avoid duplicates
    console.log('Cleaning existing demo items...');
    await sql`DELETE FROM qrons WHERE is_demo = true`;
    
    for (const item of galleryItems) {
      await sql`
        INSERT INTO qrons (user_id, mode, target_url, image_url, prompt, style, is_demo, scan_count)
        VALUES (${DEMO_USER_ID}, ${item.mode}, ${item.target_url}, ${item.image_url}, ${item.prompt}, ${item.style}, true, ${Math.floor(Math.random() * 500 + 100)})
      `;
    }
    console.log('✅ Gallery Seeded successfully with ' + galleryItems.length + ' items.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
