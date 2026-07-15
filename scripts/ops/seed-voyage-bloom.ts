import { generateLivingQR } from './src/lib/hf-generation';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const VOYAGE_BLOOM_ASSETS = [
  {
    name: 'Voyage Bloom #1: Nebula Kush',
    url: 'https://strainchain.io/p/voyage-bloom-001',
    prompt: 'Lush bioluminescent cannabis cola, deep space voyage aesthetic, neon purple and emerald green hues, crystalline trichomes, floating in starry nebula, photorealistic 8k',
    mode: 'living'
  },
  {
    name: 'Voyage Bloom #2: Lunar Diesel',
    url: 'https://strainchain.io/p/voyage-bloom-002',
    prompt: 'Monolithic cannabis bud on the lunar surface, silver and frost trichomes, earth rising in background, hyperdetailed macro photography',
    mode: 'industrial'
  },
  {
    name: 'Voyage Bloom #3: Solar Flare Haze',
    url: 'https://strainchain.io/p/voyage-bloom-003',
    prompt: 'Radiant golden cannabis flower, solar flare background, intense warm lighting, dripping resin, celestial energy, masterpiece',
    mode: 'living'
  },
  {
    name: 'Voyage Bloom #4: Void Walker OG',
    url: 'https://strainchain.io/p/voyage-bloom-004',
    prompt: 'Dark obsidian cannabis bud, glowing electric blue veins, deep void space background, mysterious alien flora, macro 8k',
    mode: 'industrial'
  },
  {
    name: 'Voyage Bloom #5: Asteroid Ice',
    url: 'https://strainchain.io/p/voyage-bloom-005',
    prompt: 'Frozen cannabis flower on an icy asteroid, shattered ice crystals acting as trichomes, brilliant starlight reflections, cinematic lighting',
    mode: 'living'
  }
];

async function seedVoyageBloom() {
  console.log('🚀 INITIALIZING VOYAGE BLOOM AI GENERATION (Phase 3 Autonomous Mode)...');
  
  if (!process.env.HUGGINGFACE_TOKEN) {
    console.error('❌ ERROR: HUGGINGFACE_TOKEN is missing. Inserting placeholders instead.');
    // Insert placeholders for the UI to use
    for (let i = 0; i < VOYAGE_BLOOM_ASSETS.length; i++) {
      const asset = VOYAGE_BLOOM_ASSETS[i];
      await admin.from('qrons').insert({
        user_id: DEMO_USER_ID,
        mode: asset.mode,
        target_url: asset.url,
        image_url: `/media/samples/0${(i % 9) + 1}_flux_qron_space.png`, // Use existing samples
        prompt: asset.prompt,
        is_demo: true,
        scan_count: Math.floor(Math.random() * 5000 + 1000),
        metadata: {
           brand: 'Voyage Bloom',
           tier: 'premium',
           collection: 'Voyage Bloom Genesis',
           phygital_redeemable: true
        }
      });
    }
    console.log('✅ Placeholders inserted. UI is ready for Voyage Bloom.');
    return;
  }

  try {
    for (const asset of VOYAGE_BLOOM_ASSETS) {
      console.log(`\n🎨 Generating for: ${asset.name}...`);
      
      const result = await generateLivingQR({
        url: asset.url,
        prompt: asset.prompt,
        qr_weight: 1.35,
        start_step: 0.35
      });

      console.log(`✅ Generated: ${result.imageUrl}`);

      // Insert into Registry as Demo
      const { error } = await admin
        .from('qrons')
        .insert({
          user_id: DEMO_USER_ID,
          mode: asset.mode,
          target_url: asset.url,
          image_url: result.imageUrl,
          prompt: asset.prompt,
          is_demo: true,
          scan_count: Math.floor(Math.random() * 5000 + 1000),
          metadata: {
             brand: 'Voyage Bloom',
             tier: 'premium',
             collection: 'Voyage Bloom Genesis',
             phygital_redeemable: true,
             scannable: result.scannable,
             hf_model: 'controlnet-v1p-sd15'
          }
        });

      if (error) {
        console.error(`❌ DB Error for ${asset.name}:`, error.message);
      } else {
        console.log(`💎 Registered ${asset.name} to the Premium Registry.`);
      }
      
      // Wait a bit to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✨ VOYAGE BLOOM SEEDING COMPLETE. The Marketplace is now live with Phygital Utility assets.');

  } catch (err: unknown) {
    console.error('💥 SEEDING CRASHED:', err instanceof Error ? err.message : String(err));
  }
}

seedVoyageBloom();
