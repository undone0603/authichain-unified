import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

const VOYAGE_BLOOM_ASSETS = [
  {
    name: 'Voyage Bloom #1: Nebula Kush',
    brand: 'Voyage Bloom',
    image: 'https://i.imgur.com/8x8Mv3j.png', // High quality placeholder
    id: 'AC-VB-001'
  },
  {
    name: 'Voyage Bloom #2: Lunar Diesel',
    brand: 'Voyage Bloom',
    image: 'https://i.imgur.com/QjZ9fBq.png',
    id: 'AC-VB-002'
  },
  {
    name: 'Voyage Bloom #3: Solar Flare Haze',
    brand: 'Voyage Bloom',
    image: 'https://i.imgur.com/8x8Mv3j.png',
    id: 'AC-VB-003'
  }
];

async function seedStrainChainNFTs() {
  console.log('💎 Seeding Voyage Bloom NFT Collection to Truth Layer...');

  try {
    for (const asset of VOYAGE_BLOOM_ASSETS) {
      const { error } = await admin
        .from('product_qrons')
        .upsert({
          id: asset.id,
          product_name: asset.name,
          brand: asset.brand,
          qron_image_url: asset.image,
          qron_mode: 'industrial',
          metadata: {
            collection: 'Voyage Bloom Genesis',
            tier: 'premium',
            industry: 'cannabis',
            verified: true
          },
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Failed to seed ${asset.name}:`, error.message);
      } else {
        console.log(`✅ Seeded ${asset.name}`);
      }
    }
    console.log('\n✨ StrainChain Market Sync Complete.');
  } catch (err: any) {
    console.error('💥 Sync Crashed:', err.message);
  }
}

seedStrainChainNFTs();
