export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';

export async function GET(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const qr_id = searchParams.get('qr_id');
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const granularity = searchParams.get('granularity') ?? 'day';

  if (!['day', 'week', 'month'].includes(granularity)) {
    return NextResponse.json({ error: 'granularity must be day, week, or month' }, { status: 400 });
  }

  // Build scan query scoped to the authenticated user
  let q = admin
    .from('scan_events')
    .select('id, qron_id, user_agent, scanned_at', { count: 'exact' })
    .eq('user_id', auth.userId);

  if (qr_id) q = q.eq('qron_id', qr_id);
  if (start_date) q = q.gte('scanned_at', start_date);
  if (end_date) q = q.lte('scanned_at', end_date);

  const { data: scans, count, error } = await q.order('scanned_at', { ascending: true }).limit(10000);

  if (error) {
    console.error('[analytics] query failed:', error);
    return NextResponse.json({ error: 'Analytics query failed' }, { status: 500 });
  }

  const rows = scans ?? [];
  const total_scans = count ?? 0;

  // Aggregate daily from real data
  const byDay: Record<string, { scans: number }> = {};
  for (const scan of rows) {
    const day = (scan.scanned_at as string).split('T')[0];
    byDay[day] ??= { scans: 0 };
    byDay[day].scans++;
  }
  const daily_scans = Object.entries(byDay)
    .map(([date, v]) => ({ date, scans: v.scans }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Device breakdown from user-agent
  const deviceMap: Record<string, number> = {};
  for (const scan of rows) {
    const ua = ((scan.user_agent as string) ?? '').toLowerCase();
    const device = /mobile|android|iphone/.test(ua) ? 'mobile'
      : /tablet|ipad/.test(ua) ? 'tablet'
      : 'desktop';
    deviceMap[device] = (deviceMap[device] ?? 0) + 1;
  }
  const by_device = Object.entries(deviceMap).map(([device, count]) => ({
    device,
    count,
    percentage: total_scans > 0 ? Math.round((count / total_scans) * 1000) / 10 : 0,
  }));

  return NextResponse.json({
    success: true,
    analytics: {
      qr_id: qr_id ?? 'all',
      period: {
        start: start_date ?? null,
        end: end_date ?? null,
        granularity,
      },
      summary: {
        total_scans,
        data_points: daily_scans.length,
      },
      by_device,
      daily_scans,
      protocol: 'QRON',
    },
  });
}
