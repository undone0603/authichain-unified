export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';

const SUPPORTED_FORMATS = ['json', 'csv'] as const;
const SUPPORTED_TYPES = ['codes', 'analytics', 'scans', 'campaigns'] as const;
type ExportFormat = typeof SUPPORTED_FORMATS[number];
type ExportType = typeof SUPPORTED_TYPES[number];

export async function GET(req: NextRequest) {
  // Auth required — user_id is ALWAYS derived from the verified session/key,
  // never accepted from query params.
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'json') as ExportFormat;
  const export_type = (searchParams.get('export_type') ?? 'codes') as ExportType;
  const campaign_id = searchParams.get('campaign_id');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');

  if (!SUPPORTED_FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `Invalid format. Supported: ${SUPPORTED_FORMATS.join(', ')}` },
      { status: 400 }
    );
  }

  if (!SUPPORTED_TYPES.includes(export_type)) {
    return NextResponse.json(
      { error: `Invalid export_type. Supported: ${SUPPORTED_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Fetch real data scoped to the authenticated user
  let data: unknown[] = [];
  let total = 0;

  if (export_type === 'codes') {
    let q = admin
      .from('qrons')
      .select('id, name, url, type, status, scans, created_at', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (campaign_id) q = q.eq('campaign_id', campaign_id);
    const { data: rows, count, error } = await q;
    if (error) return NextResponse.json({ error: 'Export query failed' }, { status: 500 });
    data = rows ?? [];
    total = count ?? 0;
  } else if (export_type === 'scans') {
    let q = admin
      .from('scan_events')
      .select('id, qron_id, user_agent, scanned_at', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('scanned_at', { ascending: false })
      .limit(5000);
    if (date_from) q = q.gte('scanned_at', date_from);
    if (date_to) q = q.lte('scanned_at', date_to);
    const { data: rows, count, error } = await q;
    if (error) return NextResponse.json({ error: 'Export query failed' }, { status: 500 });
    data = rows ?? [];
    total = count ?? 0;
  }
  // campaigns / analytics: extend similarly

  const export_record = {
    export_id: crypto.randomUUID(),
    user_id: auth.userId,
    export_type,
    format,
    generated_at: new Date().toISOString(),
    total_rows: total,
    filters: { campaign_id, date_from, date_to },
  };

  if (format === 'json') {
    return NextResponse.json({ success: true, export: export_record, data });
  }

  if (format === 'csv') {
    if (data.length === 0) {
      return new NextResponse('', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${export_type}_export.csv"` },
      });
    }
    const keys = Object.keys(data[0] as object);
    const csv = [
      keys.join(','),
      ...data.map(row =>
        keys.map(k => JSON.stringify((row as any)[k] ?? '')).join(',')
      ),
    ].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${export_type}_export.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
