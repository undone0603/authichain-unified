import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { deductCredit } from '@/lib/business-tier';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const CF_WORKER_URL =
  process.env.QRON_WORKER_URL ||
  'https://qron-image-gen.undone-k.workers.dev';

/** Preset prompts keyed by preset ID */
const PRESET_PROMPTS: Record<string, string> = {
  'static-portal':
    'Clean black-and-gold geometry, AuthiChain Protocol seal at center, elegant minimal design',
  'chromatic-portal':
    'Full-spectrum AI art woven around QR matrix, maximum visual impact, vibrant colors',
  'cybernetic-bloom':
    'Circuit-board aesthetics, neon traces, organic glow, futuristic alive design',
  'dark-matter':
    'Void-black deep space with gravitational light distortion, cosmic energy',
  'neon-drift':
    'Synthwave neon gradients, retro-futurist night drive energy, glowing lines',
  'holographic-seal':
    'Rainbow prismatic shimmer, premium foil-effect authentication mark, holographic',
  'living-archive':
    'Biomorphic self-similar fractal forms, organic intelligence encoded',
  'dimensional-gate':
    'AR-depth layering with shadow and parallax, spatial anchor for physical media',
  'neon-matrix':
    'Glowing grid of pulsating neon lines with matrix-like streams of energy',
  'galactic':
    'Cosmic starfields and swirling galaxies, particles orbiting a living QRON',
  'liquid-metal':
    'Flowing metallic fluid forms and shimmering reflections that pulse with light',
  'nature-elements':
    'Organic elemental motifs of leaves vines water and fire swirling around',
};

interface GenerateBody {
  targetUrl?: string;
  prompt?: string;
  mode?: string;
  presetId?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return NextResponse.json(
        { message: 'Authentication required.' },
        { status: 401 }
      );

    let body: GenerateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
    }

    const { targetUrl, prompt, presetId, mode = 'static' } = body;

    // â”€â”€ Rate Limiting check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const rateLimit = await checkRateLimit(session.user.id, 5, 1);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { message: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    if (!targetUrl)
      return NextResponse.json(
        { message: 'Destination URL is required.' },
        { status: 400 }
      );
    if (!prompt && !presetId)
      return NextResponse.json(
        { message: 'A prompt or preset is required.' },
        { status: 400 }
      );

    // â”€â”€ Credit check / deduction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const creditResult = await deductCredit(session.user.id);
    if (!creditResult.ok) {
      return NextResponse.json(
        { message: creditResult.error, code: 'LIMIT_REACHED' },
        { status: 403 }
      );
    }

    // â”€â”€ Resolve prompt from preset or custom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let finalPrompt = prompt || '';
    const presetPrompt = presetId ? PRESET_PROMPTS[presetId] : null;

    // Try DB-backed preset if not in static map
    if (presetId && !presetPrompt) {
      try {
        const admin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: dbPreset } = await admin
          .from('qron_presets')
          .select('prompt')
          .eq('id', presetId)
          .single();
        if (dbPreset?.prompt)
          finalPrompt = prompt
            ? `${prompt}, ${dbPreset.prompt}`
            : dbPreset.prompt;
      } catch {
        /* ignore */
      }
    } else if (presetPrompt) {
      finalPrompt = prompt ? `${prompt}, ${presetPrompt}` : presetPrompt;
    }

    if (!finalPrompt)
      return NextResponse.json(
        { message: 'Could not resolve prompt.' },
        { status: 400 }
      );

    // â”€â”€ Generate via QRON CF Worker (HuggingFace backend) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const workerRes = await fetch(`${CF_WORKER_URL}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        prompt: finalPrompt,
        style: 'space',
      }),
      signal: AbortSignal.timeout(110_000),
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text();
      console.error('[generate] Worker error:', workerRes.status, errText);
      if (workerRes.status === 503)
        return NextResponse.json(
          {
            message: 'Generation service warming up â€” retry in 30s',
            code: 'WARMING_UP',
          },
          { status: 503 }
        );
      return NextResponse.json(
        { message: 'AI generation failed' },
        { status: 502 }
      );
    }

    const workerData = (await workerRes.json()) as {
      id?: string;
      previewUrl?: string;
      downloadUrl?: string;
      status?: string;
    };
    const imageUrl = workerData.downloadUrl || workerData.previewUrl || '';
    if (!imageUrl)
      return NextResponse.json({ message: 'No image returned' }, { status: 502 });

    // â”€â”€ Store generation in Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const qronId = crypto.randomUUID();
    const storableImageUrl = imageUrl.startsWith('data:')
      ? `generated:${qronId}`
      : imageUrl;
    await admin
      .from('qron_generations')
      .insert({
        id: qronId,
        user_id: session.user.id,
        image_url: storableImageUrl,
        destination_url: targetUrl,
        prompt: finalPrompt,
        preset_id: presetId || null,
        mode,
        provider: 'huggingface',
      })
      .then(({ error }) => {
        if (error)
          console.warn('[generate] Supabase insert warning:', error.message);
      });

    // â”€â”€ Register provenance with AuthiChain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let registrationId: string | null = null;
    const authichainUrl = process.env.AUTHICHAIN_API_URL;
    if (authichainUrl) {
      try {
        const regRes = await fetch(`${authichainUrl}/api/qron-register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.AUTHICHAIN_API_SECRET || '',
          },
          body: JSON.stringify({
            user_id: session.user.id,
            asset_url: imageUrl,
            destination_url: targetUrl,
            prompt: finalPrompt,
            preset_id: presetId,
            mode,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (regRes.ok) {
          const regData = (await regRes.json()) as { id?: string };
          registrationId = regData.id || null;
        }
      } catch (err) {
        console.warn(
          '[generate] Provenance registration failed (non-fatal):',
          err
        );
      }
    }

    return NextResponse.json({
      qron: {
        id: qronId,
        imageUrl,
        destinationUrl: targetUrl,
        qrDataUrl: imageUrl,
        prompt: finalPrompt,
        mode,
        registration_id: registrationId,
        createdAt: new Date().toISOString(),
      },
      remaining_credits: creditResult.remaining,
    });
  } catch (err: unknown) {
    console.error('[generate] Error:', err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Unexpected error.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    backend: 'huggingface',
    model: 'DionTimmer/controlnet_qrcode-control_v1p_sd15',
    worker: CF_WORKER_URL,
  });
}
