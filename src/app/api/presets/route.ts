import { NextResponse } from 'next/server';
import { FalaiPreset } from '@/lib/types';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Static fallback presets — used when DB table doesn't exist yet */
const STATIC_PRESETS: FalaiPreset[] = [
  {
    id: 'static-portal',
    name: 'Static Portal',
    description:
      'Clean black-and-gold geometry. AuthiChain Protocol seal at center.',
    is_premium: false,
    tier: 'free',
  },
  {
    id: 'chromatic-portal',
    name: 'Chromatic Portal',
    description:
      'Full-spectrum AI art woven around the QR matrix. Maximum visual impact.',
    is_premium: false,
    tier: 'free',
  },
  {
    id: 'cybernetic-bloom',
    name: 'Cybernetic Bloom',
    description:
      'Circuit-board aesthetics, neon traces, organic glow. Futuristic and alive.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter',
    description:
      'Void-black deep space with gravitational light distortion.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'neon-drift',
    name: 'Neon Drift',
    description:
      'Synthwave neon gradients. Retro-futurist night drive energy.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'holographic-seal',
    name: 'Holographic Seal',
    description:
      'Rainbow prismatic shimmer. Premium foil-effect authentication mark.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'living-archive',
    name: 'Living Archive',
    description:
      'Biomorphic, self-similar fractal forms. Organic intelligence encoded.',
    is_premium: true,
    tier: 'enterprise',
  },
  {
    id: 'dimensional-gate',
    name: 'Dimensional Gate',
    description:
      'AR-depth layering with shadow and parallax. Spatial anchor for physical media.',
    is_premium: true,
    tier: 'enterprise',
  },
  {
    id: 'neon-matrix',
    name: 'Neon Matrix',
    description:
      'Glowing grid of pulsating neon lines with matrix-like streams of energy.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'galactic',
    name: 'Galactic',
    description:
              'Cosmic starfields and swirling galaxies — particles orbiting a living QRON.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'liquid-metal',
    name: 'Liquid Metal',
    description:
      'Flowing metallic fluid forms and shimmering reflections that pulse with light.',
    is_premium: true,
    tier: 'pro',
  },
  {
    id: 'nature-elements',
    name: 'Nature Elements',
    description:
      'Organic elemental motifs of leaves, vines, water and fire swirling around.',
    is_premium: true,
    tier: 'enterprise',
  },
];

export async function GET() {
  // Try DB-backed presets first
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data, error } = await admin
        .from('qron_presets')
        .select(
          'id, name, description, is_premium, tier, prompt, negative_prompt, guidance_scale, controlnet_conditioning_scale, num_inference_steps, image_size'
        )
        .order('is_premium', { ascending: true });

      if (!error && data && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // Fall through to static presets
  }

  return NextResponse.json(STATIC_PRESETS);
}
