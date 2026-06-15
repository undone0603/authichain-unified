export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Auth
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 120 scans/min per user
  const rl = await checkRateLimit(auth.userId, 120, 1);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { qron_id } = body as Record<string, unknown>;
  if (typeof qron_id !== 'string' || !qron_id.trim()) {
    return NextResponse.json({ error: 'qron_id is required' }, { status: 400 });
  }

  // Verify qron belongs to this user
  const { data: qron, error: qronErr } = await admin
    .from('qrons')
    .select('id, user_id')
    .eq('id', qron_id.trim())
    .single();

  if (qronErr || !qron) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
  }

  if (qron.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Derive server-side metadata — never trust caller-supplied geo/IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  const { data: scanEvent, error: insertErr } = await admin
    .from('scan_events')
    .insert({
      qron_id: qron.id,
      user_id: auth.userId,
      ip_address: ip,
      user_agent: userAgent,
      scanned_at: new Date().toISOString(),
    })
    .select('id, scanned_at')
    .single();

  if (insertErr) {
    console.error('[scan] insert failed:', insertErr);
    return NextResponse.json({ error: 'Failed to record scan' }, { status: 500 });
  }

  return NextResponse.json({
    status: 'SCAN_RECORDED',
    scan_id: scanEvent.id,
    scanned_at: scanEvent.scanned_at,
    protocol: 'QRON',
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const qron_id = searchParams.get('qron_id');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
  const offset = (page - 1) * limit;

  let query = admin
    .from('scan_events')
    .select('id, qron_id, ip_address, user_agent, scanned_at', { count: 'exact' })
    .eq('user_id', auth.userId)
    .order('scanned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (qron_id) query = query.eq('qron_id', qron_id);

  const { data, error, count } = await query;

  if (error) {
    console.error('[scan] query failed:', error);
    return NextResponse.json({ error: 'Failed to retrieve scan history' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    scans: data,
    total: count ?? 0,
    page,
    limit,
    protocol: 'QRON',
  });
}
