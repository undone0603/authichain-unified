export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'not_configured'
);

function periodCutoff(period: string): string | null {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const metric = searchParams.get('metric') || 'scans';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  try {
    const cutoff = periodCutoff(period);

    let query = admin
      .from('qrons')
      .select('user_id, scan_count, mode')
      .eq('is_active', true)
      .eq('is_demo', false);

    if (cutoff) query = query.gte('created_at', cutoff);

    const { data: qronRows, error: qronErr } = await query;
    if (qronErr) throw qronErr;

    const stats = new Map<string, { total_scans: number; qr_codes: number; campaigns: number }>();
    for (const row of (qronRows ?? []) as Array<{ user_id: string; scan_count: number | null; mode: string | null }>) {
      const s = stats.get(row.user_id) ?? { total_scans: 0, qr_codes: 0, campaigns: 0 };
      s.total_scans += row.scan_count ?? 0;
      s.qr_codes += 1;
      if (row.mode && row.mode !== 'standard') s.campaigns += 1;
      stats.set(row.user_id, s);
    }

    const sortKey = metric === 'qr_codes' ? 'qr_codes' : metric === 'campaigns' ? 'campaigns' : 'total_scans';
    const ranked = [...stats.entries()]
      .sort((a, b) => b[1][sortKey] - a[1][sortKey])
      .slice(0, limit);

    if (ranked.length === 0) {
      return NextResponse.json({
        success: true,
        leaderboard: [],
        period,
        metric,
        total_participants: 0,
        last_updated: new Date().toISOString(),
        generated_at: new Date().toISOString(),
      });
    }

    const userIds = ranked.map(([uid]) => uid);
    const { data: profileRows } = await admin
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(
      ((profileRows ?? []) as Array<{ user_id: string; full_name: string | null; avatar_url: string | null }>)
        .map(p => [p.user_id, p])
    );

    const leaderboard = ranked.map(([uid, s], i) => {
      const profile = profileMap.get(uid);
      return {
        rank: i + 1,
        user_id: uid,
        display_name: profile?.full_name ?? 'Anonymous',
        avatar: profile?.avatar_url ?? null,
        total_scans: s.total_scans,
        qr_codes: s.qr_codes,
        campaigns: s.campaigns,
      };
    });

    return NextResponse.json({
      success: true,
      leaderboard,
      period,
      metric,
      total_participants: stats.size,
      last_updated: new Date().toISOString(),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[leaderboard]', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
