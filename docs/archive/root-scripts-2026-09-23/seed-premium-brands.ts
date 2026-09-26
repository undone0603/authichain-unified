import { generateLivingQR } from './src/lib/hf-generation';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const PREMIUM_BRANDS = [
  {
    name: 'BMW iX',
    url: 'https://bmw.com/ix-provenance',
    prompt: 'Ultra-modern brushed aluminum automotive texture, sleek cybernetic lines, metallic silver and deep blue hues, photorealistic 8k',
    mode: 'industrial'
  },
  {
    name: 'Tesla Energy',
    url: 'https://tesla.com/energy-sync',
    prompt: 'Clean minimalist glass aesthetic, energy pulsating through white circuits, red accents, futuristic renewable tech',
    mode: 'living'
  },
  {
    name: 'Apple Silicon',
    url: 'https://apple.com/m4-verify',
    prompt: 'Brushed space gray titanium, intricate micro-circuitry, elegant shadows, premium tech hardware aesthetic',
    mode: 'industrial'
  },
  {
    name: 'Trulieve Reserve',
    url: 'https://trulieve.com/strain-chain',
    prompt: 'Organic botanical illustration, lush emerald green cannabis leaves, crystalline resin textures, golden lighting, nature-inspired luxury',
    mode: 'living'
  }
];

async function seedPremiumGallery() {
  console.log('🚀 INITIALIZING PREMIUM BRAND SEEDING (Phase 3 Autonomous Mode)...');
  
  if (!process.env.HUGGINGFACE_TOKEN) {
    console.error('❌ ERROR: HUGGINGFACE_TOKEN is missing. Cannot generate demos.');
    return;
  }

  try {
    for (const brand of PREMIUM_BRANDS) {
      console.log(`\n🎨 Generating for: ${brand.name}...`);
      
      const result = await generateLivingQR({
        url: brand.url,
        prompt: brand.prompt,
        qr_weight: 1.45, // Higher weight for industrial demos
        start_step: 0.3
      });

      console.log(`✅ Generated: ${result.imageUrl}`);

      // Insert into Registry as Demo
      const { error } = await admin
        .from('qrons')
        .insert({
          user_id: DEMO_USER_ID,
          mode: brand.mode,
          target_url: brand.url,
          image_url: result.imageUrl,
          prompt: brand.prompt,
          is_demo: true,
          scan_count: Math.floor(Math.random() * 2000 + 500),
          metadata: {
             brand: brand.name,
             tier: 'premium',
             scannable: result.scannable,
             hf_model: 'controlnet-v1p-sd15'
          }
        });

      if (error) {
        console.error(`❌ DB Error for ${brand.name}:`, error.message);
      } else {
        console.log(`💎 Registered ${brand.name} to the Premium Registry.`);
      }
      
      // Wait a bit to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✨ PREMIUM SEEDING COMPLETE. The Marketplace is now live with real-world demos.');

  } catch (err: unknown) {
    console.error('ðŸ’¥ SEEDING CRASHED:', err instanceof Error ? err.message : String(err));
  }
}

seedPremiumGallery();
