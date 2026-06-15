export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-auth-middleware';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateLivingQR } from '@/lib/hf-generation';
import { assertSafeUrl } from '@/lib/ssrf-guard';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const userId = await requireApiKey(req);
  if (userId instanceof NextResponse) return userId;

  // Rate limit: 10 RPM per user
  const rl = await checkRateLimit(userId, 10, 1);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded. Max 10 requests/minute.' }, {
      status: 429,
      headers: { 'X-RateLimit-Remaining': '0' },
    });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, prompt, mode, negative_prompt } = body as Record<string, unknown>;

  if (typeof url !== 'string' || !url.startsWith('http')) {
    return NextResponse.json({ error: 'url is required and must be an http/https URL' }, { status: 400 });
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const ALLOWED_MODES = new Set(['industrial', 'creative', 'enterprise']);
  const resolvedMode = typeof mode === 'string' && ALLOWED_MODES.has(mode) ? mode : 'creative';

  // SSRF guard — block private/loopback/metadata URLs before forwarding to HF
  try {
    await assertSafeUrl(url);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Check credits
  const { data: profile } = await admin
    .from('profiles')
    .select('generations_used, generation_limit')
    .eq('user_id', userId)
    .single();

  if (profile && profile.generations_used >= profile.generation_limit) {
    return NextResponse.json({ error: 'Generation limit reached for your plan' }, { status: 402 });
  }

  try {
    const result = await generateLivingQR({
      url,
      prompt: prompt.trim(),
      negative_prompt: typeof negative_prompt === 'string' ? negative_prompt : undefined,
    });

    if (!result.imageUrl) {
      return NextResponse.json({ error: 'Generation failed: no image returned' }, { status: 502 });
    }

    // Deduct credit only on success
    admin
      .from('profiles')
      .update({ generations_used: (profile?.generations_used ?? 0) + 1 })
      .eq('user_id', userId)
      .then(undefined, (err) => console.error('[generate] credit update failed:', err));

    // Log to qrons table
    admin
      .from('qrons')
      .insert({
        user_id: userId,
        url,
        prompt,
        mode: resolvedMode,
        image_url: result.imageUrl,
        scannable: result.scannable,
        attempts: result.attempts,
        protocol: 'QRON',
      })
      .then(undefined, (err) => console.error('[generate] qron insert failed:', err));

    return NextResponse.json({
      success: true,
      image_url: result.imageUrl,
      scannable: result.scannable,
      attempts: result.attempts,
      protocol: 'QRON',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[generate] error:', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
