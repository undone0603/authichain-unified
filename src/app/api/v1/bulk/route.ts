export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';
import { assertSafeUrl } from '@/lib/ssrf-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = new Set(['url', 'text', 'email', 'phone', 'wifi']);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Bulk operations cost more — 10 requests/min
  const rl = await checkRateLimit(`bulk:${auth.userId}`, 10, 1);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { codes } = body as Record<string, unknown>;

  if (!Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json({ error: 'codes array is required and must not be empty' }, { status: 400 });
  }

  if (codes.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 QR codes per bulk request' }, { status: 400 });
  }

  const results: unknown[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (let index = 0; index < codes.length; index++) {
    const code = codes[index] as Record<string, unknown>;

    if (!code.name || typeof code.name !== 'string') {
      results.push({ index, success: false, error: 'name is required and must be a string' });
      continue;
    }

    if (!code.url || typeof code.url !== 'string') {
      results.push({ index, success: false, error: 'url is required and must be a string' });
      continue;
    }

    // SSRF guard — block private/loopback URLs
    try {
      await assertSafeUrl(code.url as string);
    } catch (err: unknown) {
      results.push({ index, success: false, error: (err as Error).message });
      continue;
    }

    const type = typeof code.type === 'string' && ALLOWED_TYPES.has(code.type) ? code.type : 'url';

    const id = crypto.randomUUID();
    toInsert.push({
      id,
      user_id: auth.userId,
      name: (code.name as string).slice(0, 255),
      url: code.url,
      type,
      campaign_id: typeof code.campaign_id === 'string' ? code.campaign_id : null,
      style: code.style ?? { foreground: '#000000', background: '#ffffff', logo: false },
      status: 'active',
      protocol: 'QRON',
    });

    results.push({
      index,
      success: true,
      qr_code: {
        id,
        name: code.name,
        url: code.url,
        type,
        status: 'active',
        scans: 0,
        created_at: new Date().toISOString(),
        protocol: 'QRON',
      },
    });
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await admin.from('qrons').insert(toInsert);
    if (insertErr) {
      console.error('[bulk] insert failed:', insertErr);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }
  }

  const succeeded = results.filter((r: any) => r.success);
  const failed = results.filter((r: any) => !r.success);

  return NextResponse.json({
    success: true,
    processed: codes.length,
    created: succeeded.length,
    failed: failed.length,
    results,
    batch_id: crypto.randomUUID(),
    protocol: 'QRON',
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    success: true,
    endpoint: '/api/v1/bulk',
    description: 'Bulk QR code creation endpoint',
    max_per_request: 500,
    supported_operations: ['create'],
    example_request: {
      codes: [
        { name: 'Product 1', url: 'https://example.com/1', type: 'url' },
        { name: 'Product 2', url: 'https://example.com/2', type: 'url' },
      ],
    },
    protocol: 'QRON',
  });
}
