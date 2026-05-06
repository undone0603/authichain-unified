/* eslint-disable @typescript-eslint/no-require-imports */
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres('postgresql://postgres.nhdnkzhtadfkkluiulhs:QronOps2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const galleryItems = [
  {
    mode: 'holographic',
    target_url: 'https://qron.space/demo/chromatic',
    image_url: '/media/gallery-chromatic-portal-1080.svg',
    prompt: 'Full-spectrum AI art woven around the QR matrix. Maximum visual impact.',
    style: 'chromatic-portal',
  },
  {
    mode: 'static',
    target_url: 'https://qron.space/demo/static',
    image_url: '/media/gallery-static-portal-1080.svg',
    prompt: 'Clean black-and-gold geometry. AuthiChain Protocol seal at center.',
    style: 'static-portal',
  },
  {
    mode: 'enterprise',
    target_url: 'https://qron.space/demo/event',
    image_url: '/media/gallery-event-poster-1350x1080.svg',
    prompt: 'Event poster with AuthiChain-verified QRON for luxury retail.',
    style: 'luxury-brand',
  },
  {
    mode: 'pro',
    target_url: 'https://qron.space/demo/ecommerce',
    image_url: '/media/gallery-ecommerce-card-1080.svg',
    prompt: 'Product card with chromatic QRON for high-end fashion validation.',
    style: 'ecommerce-premium',
  },
  {
    mode: 'living',
    target_url: 'https://qron.space/demo/merch',
    image_url: '/media/gallery-creator-merch-1080.svg',
    prompt: 'Tech gadget with living QR corner for creator merchandise tracking.',
    style: 'creator-merch',
  },
  {
    mode: 'cyberpunk',
    target_url: 'https://qron.space/demo/neon',
    image_url: '/media/neon-matrix.svg',
    prompt: 'Glowing grid of pulsating neon lines with matrix-like streams of energy.',
    style: 'neon-matrix',
  },
  {
    mode: 'space',
    target_url: 'https://qron.space/demo/galactic',
    image_url: '/media/galactic.svg',
    prompt: 'Cosmic starfields and swirling galaxies — particles orbiting a living QRON.',
    style: 'galactic',
  },
  {
    mode: 'dimensional',
    target_url: 'https://qron.space/demo/portfolio-1',
    image_url: '/media/portfolio-qron-1.svg',
    prompt: 'Architectural depth layering, spatial anchor for industrial blueprints.',
    style: 'dimensional-gate',
  },
  {
    mode: 'layered',
    target_url: 'https://qron.space/demo/portfolio-2',
    image_url: '/media/portfolio-qron-2.svg',
    prompt: 'Multi-layered cryptographic signature marks for secure documentation.',
    style: 'secure-mark',
  }
];

async function seed() {
  console.log('Seeding QRON Gallery...');
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

