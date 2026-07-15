/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const sampleItems = [
  // Industry-Specific Flux Samples
  {
    mode: 'industrial',
    target_url: 'https://qron.space',
    image_url: '/media/samples/01_flux_qron_space.png',
    prompt: 'QRON Space - Cyberpunk Circuit · Neon Blue. Tech/Web3 optimized matrix.',
    style: 'cyber-circuit',
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
    target_url: 'https://authichain.com',
    image_url: '/media/samples/03_flux_authichain.png',
    prompt: 'AuthiChain - Renaissance Marble · Baroque Gold. Blockchain/Authentication seal.',
    style: 'renaissance-gold',
  },
  {
    mode: 'industrial',
    target_url: 'https://ev-industry.ai',
    image_url: '/media/samples/04_flux_ev_industry.png',
    prompt: 'EV Industry - Plasma Lightning · Chrome Supercar. Electric Automotive telemetry.',
    style: 'plasma-chrome',
  },
  {
    mode: 'industrial',
    target_url: 'https://medchain.health',
    image_url: '/media/samples/05_flux_medchain.png',
    prompt: 'MedChain - DNA Helix · Electron Microscope. Healthcare/BioTech secure records.',
    style: 'dna-helix',
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
    target_url: 'https://artisan.coffee',
    image_url: '/media/samples/07_flux_artisan_roasters.png',
    prompt: 'Artisan Roasters - Espresso Macro · Impressionist Warmth. Food & Beverage tracking.',
    style: 'espresso-warmth',
  },
  {
    mode: 'industrial',
    target_url: 'https://propchain.io',
    image_url: '/media/samples/08_flux_propchain.png',
    prompt: 'PropChain - Blueprint Lines · Skyline Gold. Real Estate/PropTech blueprints.',
    style: 'skyline-gold',
  },
  {
    mode: 'industrial',
    target_url: 'https://streamvault.tv',
    image_url: '/media/samples/09_flux_streamvault.png',
    prompt: 'StreamVault - Film Noir · Crimson Velvet Cinema. Entertainment/Media protection.',
    style: 'film-noir',
  },
  {
    mode: 'industrial',
    target_url: 'https://athletedao.io',
    image_url: '/media/samples/10_flux_athletedao.png',
    prompt: 'AthleteDAO - Kinetic Motion · Stadium Floodlights. Sports/Performance collectibles.',
    style: 'kinetic-stadium',
  },
  // Creative Samples
  {
    mode: 'cyberpunk',
    target_url: 'https://qron.space/demo/neon',
    image_url: '/media/samples/01-neon-glitch.png',
    prompt: 'Neon Glitch - High-contrast cyan and magenta digital noise with glowing scan lines.',
    style: 'neon-glitch',
  },
  {
    mode: 'holographic',
    target_url: 'https://qron.space/demo/holographic',
    image_url: '/media/samples/02-holographic-mosaic.png',
    prompt: 'Holographic Mosaic - Shimmering iridescent tiles that shift color based on viewing angle.',
    style: 'holo-mosaic',
  },
  {
    mode: 'static',
    target_url: 'https://qron.space/demo/matrix',
    image_url: '/media/samples/03-matrix-cascade.png',
    prompt: 'Matrix Cascade - Falling green code streams reminiscent of legendary digital rain.',
    style: 'matrix-cascade',
  },
  {
    mode: 'space',
    target_url: 'https://qron.space/demo/nebula',
    image_url: '/media/samples/04-cosmic-nebula.png',
    prompt: 'Cosmic Nebula - Swirling deep space gases and distant starlight clusters.',
    style: 'cosmic-nebula',
  },
  {
    mode: 'echo',
    target_url: 'https://qron.space/demo/aurora',
    image_url: '/media/samples/08-aurora-dreams.png',
    prompt: 'Aurora Dreams - Ethereal northern lights dancing across a high-altitude horizon.',
    style: 'aurora-dreams',
  }
];

async function seed() {
  console.log('Seeding Comprehensive QRON Samples...');
  try {
    // Clear existing demos to avoid duplicates if re-running
    // console.log('Cleaning existing demo items...');
    // await sql`DELETE FROM qrons WHERE is_demo = true`;

    for (const item of sampleItems) {
      await sql`
        INSERT INTO qrons (user_id, mode, target_url, image_url, prompt, style, is_demo, scan_count)
        VALUES (${DEMO_USER_ID}, ${item.mode}, ${item.target_url}, ${item.image_url}, ${item.prompt}, ${item.style}, true, ${Math.floor(Math.random() * 1000 + 500)})
      `;
    }
    console.log('✅ ' + sampleItems.length + ' samples seeded successfully.');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    process.exit();
  }
}

seed();
