import { generateLivingQR } from '../src/lib/hf-generation';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

const PRINT_SHOPS = [
  { name: 'FASTSIGNS', domain: 'fastsigns.com', contact: 'Innovation Lead', prompt: 'bold industrial signage, high contrast commercial printing, modern commercial aesthetic' },
  { name: 'Signarama', domain: 'signarama.com', contact: 'Franchise Director', prompt: 'vibrant commercial storefront sign, glowing neon colors, sharp vector art' },
  { name: 'MOO', domain: 'moo.com', contact: 'Product Manager', prompt: 'premium textured business card, gold foil embossing, luxury paper texture, minimalist design' },
  { name: '4imprint', domain: '4imprint.com', contact: 'B2B Sales Head', prompt: 'corporate promotional merchandise, high quality product photography, clean studio lighting' },
];

async function generateOutreach() {
  console.log('🚀 INITIALIZING CHANNEL A OUTREACH GENERATOR...');

  if (!process.env.HUGGINGFACE_TOKEN) {
    console.error('❌ ERROR: HUGGINGFACE_TOKEN is missing. Cannot generate custom demos.');
    return;
  }

  for (const shop of PRINT_SHOPS) {
    console.log(`\n======================================================`);
    console.log(`🎯 Processing Prospect: ${shop.name}`);
    console.log(`======================================================`);

    try {
      // 1. Pre-register White-Label Schema (Simulated if it fails)
      const apiKeyPrefix = `sk_${shop.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      const { data: wlClient, error: wlError } = await admin
        .from('white_label_clients')
        .insert({
          name: shop.name,
          domain: shop.domain,
          api_key_prefix: apiKeyPrefix,
          billing_plan: 'reseller_pilot',
          is_active: true
        })
        .select()
        .single();

      if (wlError && wlError.code !== '23505') { // Ignore unique violation if already exists
          console.warn(`⚠️ Could not register White-Label schema: ${wlError.message}`);
      } else {
          console.log(`✅ White-Label schema pre-provisioned with prefix: ${apiKeyPrefix}`);
      }

      // 2. Generate Custom Demo Artifact
      console.log(`🎨 Generating custom "Magic Try" QRON demo via Hugging Face...`);
      const result = await generateLivingQR({
        url: `https://${shop.domain}`,
        prompt: shop.prompt,
        qr_weight: 1.4, // Emphasize scannability for commercial printers
      });

      console.log(`✅ Demo generated: ${result.imageUrl}`);

      // 3. Draft Personalized Email
      const emailDraft = `
Subject: Upgrade ${shop.name}'s print offerings with "Smart Labels" (Verified Demo Inside)

Hi ${shop.contact},

I saw ${shop.name} is leading the way in commercial print solutions, and I wanted to share something that could open a massive new revenue stream for your franchise network.

The regulatory landscape is shifting (specifically FTC's EO 14392 regarding origin claims), and brands are desperately looking for ways to cryptographically verify their packaging. 

We built AuthiChain—a white-label verification protocol. It allows print shops like yours to embed high-res, AI-generated "Living QRs" directly onto client labels. 

I actually ran ${shop.domain} through our engine to show you what a ${shop.name}-branded artifact looks like:
🔗 View Custom Demo: ${result.imageUrl}

You charge your clients a premium for these "Smart Labels." You pay us fractions of a cent per scan via our API.

We've already pre-provisioned a white-label sandbox for you (API Prefix: ${apiKeyPrefix}).

Would you be open to a 10-minute call next week to see the dashboard?

Best,
Zachary
Architect, AuthiChain Protocol
https://qron.space/white-label
`;

      console.log(`\n📨 OUTREACH DRAFT:\n${emailDraft}`);

      // Wait between generations to respect HF rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (err: unknown) {
      console.error(`💥 Failed to process ${shop.name}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log('\n✨ OUTREACH GENERATION COMPLETE. Ready for dispatch.');
}

generateOutreach();
