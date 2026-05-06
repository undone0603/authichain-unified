import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth-api';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateLivingQR } from '@/lib/hf-generation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/generate
 * 
 * Programmatic QRON generation for Industrial/Enterprise users.
 * Requires X-API-Key header.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth via API Key
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'X-API-Key header missing' }, { status: 401 });
    }

    const userId = await verifyApiKey(apiKey);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    }

    // 2. Rate Limiting (10 requests per minute)
    const { ok, remaining: _remaining } = await checkRateLimit(userId, 10, 1);
    if (!ok) {
      return NextResponse.json({ 
        error: 'Too Many Requests', 
        detail: 'Industrial rate limit exceeded (10 RPM)' 
      }, { 
        status: 429,
        headers: { 'X-RateLimit-Limit': '10', 'X-RateLimit-Remaining': '0' }
      });
    }

    // 3. Input Validation
    const body = await req.json();
    const { url, prompt, mode = 'industrial' } = body;

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    // 3. Trigger Generation (Phase 3: HF)
    let imageUrl = '';
    let scannable = false;
    let attempts = 1;
    try {
      const hfResult = await generateLivingQR({
        url,
        prompt: prompt || 'Industrial tech aesthetic, metallic structure',
      });
      imageUrl = hfResult.imageUrl;
      scannable = hfResult.scannable;
      attempts = hfResult.attempts;
    } catch (err: unknown) {
      console.error('[v1/generate] HF Generation failed:', err);
      return NextResponse.json({ error: 'Generation engine temporarily unavailable' }, { status: 502 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 502 });
    }

    // 4. Log and Track (Non-blocking)
    admin.from('qrons').insert({
      user_id: userId,
      mode: mode,
      target_url: url,
      image_url: imageUrl,
      prompt: prompt,
      is_demo: false,
      metadata: {
        scannable,
        attempts,
        hf_model: 'controlnet-v1p-sd15',
        api_version: 'v1'
      }
    }).then();

    // 5. Deduct Credits
    admin.rpc('increment_generations_used', { user_id: userId }).then();

    return NextResponse.json({
      success: true,
      imageUrl,
      url,
      timestamp: new Date().toISOString()
    });

  } catch (err: unknown) {
    console.error('[v1/generate] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
