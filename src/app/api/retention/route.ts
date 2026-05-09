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

    const { data: stats } = await supabase
      .from('usage_stats')
      .select('streak_days, total_qrons, total_scans, milestone_count, last_active_at, plan')
      .eq('user_id', user.id)
      .single();

    const daysSinceActive = stats?.last_active_at
      ? Math.floor((Date.now() - new Date(stats.last_active_at).getTime()) / 86400000)
      : 999;

    let health = 100;
    if (daysSinceActive > 30) health -= 40;
    else if (daysSinceActive > 14) health -= 25;
    else if (daysSinceActive > 7) health -= 10;
    if (!stats?.streak_days || stats.streak_days < 3) health -= 15;
    if (!stats?.total_qrons || stats.total_qrons < 1) health -= 20;
    if (!stats?.milestone_count || stats.milestone_count < 1) health -= 10;
    health = Math.max(0, health);

    const risk = health < 40 ? 'high' : health < 65 ? 'medium' : 'low';

    const recommendations: any[] = [];
    if (daysSinceActive > 7) recommendations.push({ action: 'login', message: 'Create a QRON to keep your daily streak alive' });
    if (!stats?.streak_days || stats.streak_days < 7) recommendations.push({ action: 'streak', message: 'Build a 7-day streak to unlock the Week Warrior badge' });
    if (!stats?.total_scans || stats.total_scans < 100) recommendations.push({ action: 'share', message: 'Share your QRONs publicly to reach 100 scans and unlock the Scan Hero badge' });
    if (!stats?.plan || stats.plan === 'free') recommendations.push({ action: 'upgrade', message: 'Upgrade to Pro for AI art generation, analytics, and unlimited QRONs', cta_url: '/pricing' });

    return NextResponse.json({
      user_id: user.id,
      health_score: health,
      churn_risk: risk,
      days_since_active: daysSinceActive,
      streak_days: stats?.streak_days || 0,
      total_qrons: stats?.total_qrons || 0,
      total_scans: stats?.total_scans || 0,
      milestones_earned: stats?.milestone_count || 0,
      plan: stats?.plan || 'free',
      recommendations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
