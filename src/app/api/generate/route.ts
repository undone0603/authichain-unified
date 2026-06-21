export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { deductCredit } from '@/lib/business-tier';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateLivingQR } from '@/lib/hf-generation';
import { logAutomation } from '@/lib/automation';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const CF_WORKER_URL =
  process.env.QRON_WORKER_URL ||
  'https://qron-image-gen.undone-k.workers.dev';

interface GenResult {
  imageUrl: string;
  scannable: boolean;
  attempts: number;
  provider: 'huggingface' | 'cloudflare-worker';
  model: string;
}

/**
 * Fallback generator: the qron-image-gen Cloudflare Worker (FLUX.1) used when
 * the primary Hugging Face ControlNet path is unavailable (e.g. the model is
 * unhosted/404 on the serverless router). It produces AI art for the prompt
 * rather than a ControlNet-embedded scannable QR, so the paid generation path
 * keeps delivering an asset even if a single HF model goes dark. Throws on
 * failure so the caller can surface a 502 + refund.
 */
async function generateViaWorker(prompt: string): Promise<GenResult> {
  const res = await fetch(`${CF_WORKER_URL}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // style:'none' => worker skips its default gold_vault preset and uses our prompt as-is
    body: JSON.stringify({ prompt, style: 'none' }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Worker fallback ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { downloadUrl?: string; model?: string };
  if (!data.downloadUrl) throw new Error('Worker fallback returned no image');
  return {
    imageUrl: data.downloadUrl,
    scannable: false,
    attempts: 1,
    provider: 'cloudflare-worker',
    model: data.model || 'flux',
  };
}

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

// Allowed URL schemes for targetUrl — prevents javascript: / data: SSRF vectors
const ALLOWED_URL_SCHEMES = ['https:', 'http:'];

function isValidTargetUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const parsed = new URL(raw);
    return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

interface GenerateBody {
  targetUrl?: string;
  prompt?: string;
  mode?: string;
  presetId?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // SECURITY: getUser() performs a server-side JWT validation against Supabase Auth.
    // The previous getSession() only decoded the local JWT without re-validating it,
    // meaning a tampered or replayed token could bypass authentication.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
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

    // Rate limiting
    const rateLimit = await checkRateLimit(user.id, 5, 1);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { message: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    // SECURITY: Validate targetUrl scheme to prevent SSRF / javascript: injection.
    // Previously only checked truthiness — an attacker could pass javascript:alert(1)
    // or a private IP range as the QR destination.
    if (!isValidTargetUrl(targetUrl))
      return NextResponse.json(
        { message: 'Destination URL is required and must be a valid http/https URL.' },
        { status: 400 }
      );

    if (!prompt && !presetId)
      return NextResponse.json(
        { message: 'A prompt or preset is required.' },
        { status: 400 }
      );

    // Credit check / deduction
    const creditResult = await deductCredit(user.id);
    if (!creditResult.ok) {
      return NextResponse.json(
        { message: creditResult.error, code: 'LIMIT_REACHED' },
        { status: 403 }
      );
    }

    // Resolve prompt from preset or custom
    let finalPrompt = prompt || '';
    const presetPrompt = presetId ? PRESET_PROMPTS[presetId] : null;

    if (presetId && !presetPrompt) {
      try {
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: dbPreset } = await adminClient
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

    // Generate via Hugging Face (primary), falling back to the qron-image-gen
    // Cloudflare Worker so a single dead HF model can't break the paid path.
    let genResult: GenResult;
    try {
      const hf = await generateLivingQR({ url: targetUrl, prompt: finalPrompt });
      genResult = {
        imageUrl: hf.imageUrl,
        scannable: hf.scannable,
        attempts: hf.attempts,
        provider: 'huggingface',
        model: 'controlnet-v1p-sd15',
      };
    } catch (hfErr: unknown) {
      const hfMsg = hfErr instanceof Error ? hfErr.message : String(hfErr);
      console.error('[generate] HF generation failed, trying worker fallback:', hfErr);
      await logAutomation('generate.hf', 'event', 'failure', { userId: user.id, presetId, mode }, hfMsg);
      try {
        genResult = await generateViaWorker(finalPrompt);
        console.warn('[generate] Served via Cloudflare Worker fallback (FLUX, not QR-embedded)');
        await logAutomation('generate.fallback', 'event', 'success', { userId: user.id, provider: 'cloudflare-worker' });
      } catch (wErr: unknown) {
        const wMsg = wErr instanceof Error ? wErr.message : String(wErr);
        console.error('[generate] Worker fallback also failed:', wErr);
        await logAutomation('generate.fallback', 'event', 'failure', { userId: user.id, presetId, mode }, wMsg);
        // Both engines failed — refund the credit deducted above so the customer
        // isn't charged a generation for an asset they never received. Unlimited
        // plans (remaining === Infinity) weren't deducted, so skip the refund.
        if (creditResult.remaining !== Infinity) {
          try {
            const refundClient = createAdminClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            await refundClient.rpc('add_generation_credits', { user_uuid: user.id, amount: 1 });
          } catch (refundErr) {
            console.error('[generate] Credit refund failed (manual review):', refundErr);
            await logAutomation('generate.refund', 'event', 'failure', { userId: user.id }, refundErr instanceof Error ? refundErr.message : String(refundErr));
          }
        }
        return NextResponse.json(
          { message: 'AI generation engine is temporarily unavailable. Your credit was not used — try again in 60s.' },
          { status: 502 }
        );
      }
    }

    const imageUrl = genResult.imageUrl;
    if (!imageUrl)
      return NextResponse.json({ message: 'No image returned' }, { status: 502 });

    // Store generation in Supabase
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const qronId = crypto.randomUUID();
    const storableImageUrl = imageUrl.startsWith('data:')
      ? `generated:${qronId}`
      : imageUrl;
    await adminClient
      .from('qron_generations')
      .insert({
        id: qronId,
        user_id: user.id,
        image_url: storableImageUrl,
        destination_url: targetUrl,
        prompt: finalPrompt,
        preset_id: presetId || null,
        mode,
        provider: genResult.provider,
        metadata: {
          scannable: genResult.scannable,
          attempts: genResult.attempts,
          hf_model: genResult.model,
        }
      })
      .then(
        ({ error }) => {
          if (error) {
            console.warn('[generate] Supabase insert warning:', error.message);
            void logAutomation('generate.persist', 'event', 'failure', { qronId, userId: user.id }, error.message);
          }
        },
        (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[generate] Supabase insert failed (non-fatal):', err);
          void logAutomation('generate.persist', 'event', 'failure', { qronId, userId: user.id }, msg);
        }
      );

    // Register provenance with AuthiChain
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
            user_id: user.id,
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
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          '[generate] Provenance registration failed (non-fatal):',
          err
        );
        await logAutomation('generate.provenance_register', 'event', 'failure', { qronId, userId: user.id }, msg);
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] Error:', err);
    await logAutomation('generate', 'event', 'failure', null, msg);
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
