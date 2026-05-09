import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    const [{ data: qrons }, { data: scans }, { data: stats }] = await Promise.all([
      supabase.from('qrons').select('id, name, type, scan_count, created_at').eq('user_id', user.id).gte('created_at', since),
      supabase.from('scan_events').select('id, qron_id, scanned_at').eq('user_id', user.id).gte('scanned_at', since),
      supabase.from('usage_stats').select('streak_days, total_qrons, total_scans, milestone_count').eq('user_id', user.id).single(),
    ]);

    const topQrons = (qrons || []).sort((a: any, b: any) => b.scan_count - a.scan_count).slice(0, 5);

    const digest = {
      period: 'weekly',
      generated_at: new Date().toISOString(),
      user_id: user.id,
      summary: {
        new_qrons_this_week: (qrons || []).length,
        scans_this_week: (scans || []).length,
        current_streak: stats?.streak_days || 0,
        total_qrons: stats?.total_qrons || 0,
        total_scans: stats?.total_scans || 0,
        milestones_earned: stats?.milestone_count || 0,
      },
      top_qrons_this_week: topQrons,
      action_items: [
        ...((!stats?.streak_days || stats.streak_days === 0) ? [{ type: 'streak', message: 'Create a QRON today to start your daily streak' }] : []),
        ...((scans || []).length === 0 ? [{ type: 'share', message: 'Share your QRONs to start getting scans and climb the leaderboard' }] : []),
        ...(!stats?.total_qrons || stats.total_qrons < 10 ? [{ type: 'upgrade', message: 'Upgrade to Pro for AI-styled QRONs, unlimited scans, and analytics', cta_url: '/pricing' }] : []),
      ],
    };

    return NextResponse.json(digest);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
