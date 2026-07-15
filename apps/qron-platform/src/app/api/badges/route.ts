import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BADGE_CATALOG = [
  { id: 'first_qron', name: 'QR Pioneer', description: 'Created your first QRON', icon: '🏆', category: 'creation', threshold: 1 },
  { id: 'qron_10', name: 'QR Builder', description: 'Created 10 QRONs', icon: '⚡', category: 'creation', threshold: 10 },
  { id: 'qron_100', name: 'QR Master', description: 'Created 100 QRONs', icon: '🌟', category: 'creation', threshold: 100 },
  { id: 'first_scan', name: 'Scan Starter', description: 'Got your first scan', icon: '📱', category: 'engagement', threshold: 1 },
  { id: 'scan_100', name: 'Scan Hero', description: '100 total scans', icon: '🔥', category: 'engagement', threshold: 100 },
  { id: 'scan_1000', name: 'Viral QR', description: '1,000 total scans', icon: '🚀', category: 'engagement', threshold: 1000 },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day activity streak', icon: '📅', category: 'streak', threshold: 7 },
  { id: 'streak_30', name: 'Monthly Champion', description: '30-day streak', icon: '🎯', category: 'streak', threshold: 30 },
  { id: 'ai_art', name: 'AI Artist', description: 'Generated AI art for a QRON', icon: '🎨', category: 'creative', threshold: 1 },
  { id: 'subscriber', name: 'Pro Member', description: 'Upgraded to a paid plan', icon: '💎', category: 'subscription', threshold: 1 },
];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: earned } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', user.id);

    const earnedIds = new Set((earned || []).map((b: any) => b.badge_id));
    const earnedMap = Object.fromEntries((earned || []).map((b: any) => [b.badge_id, b.earned_at]));

    const badges = BADGE_CATALOG.map(b => ({
      ...b,
      earned: earnedIds.has(b.id),
      earned_at: earnedMap[b.id] || null,
    }));

    return NextResponse.json({ badges, total: BADGE_CATALOG.length, earned_count: earnedIds.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { badge_id } = await req.json();
    const badge = BADGE_CATALOG.find(b => b.id === badge_id);
    if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', user.id)
      .eq('badge_id', badge_id)
      .single();

    if (existing) return NextResponse.json({ message: 'Badge already earned', badge });

    await supabase.from('user_badges').insert({ user_id: user.id, badge_id, earned_at: new Date().toISOString() });

    return NextResponse.json({ success: true, badge, message: `Congratulations! You earned the ${badge.name} badge!` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
