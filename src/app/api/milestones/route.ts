import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Milestone {
  id: string;
  category: string;
  threshold: number;
  metric: string;
  title: string;
  message: string;
  icon: string;
  reward: { type: string; amount?: number; percent?: number; feature?: string; description: string } | null;
  badge: string;
}

const MILESTONES: Milestone[] = [
  // QR code generation milestones
  { id: 'first_qr', category: 'creation', threshold: 1, metric: 'qr_codes_created', title: 'First QR Code Created!', message: 'Your first dynamic QR is live. Every scan tells a story.', icon: '📷', reward: null, badge: 'QR Creator' },
  { id: 'ten_qrs', category: 'creation', threshold: 10, metric: 'qr_codes_created', title: '10 QR Codes!', message: 'A growing portfolio of dynamic QR experiences.', icon: '📊', reward: null, badge: 'QR Builder' },
  { id: 'hundred_qrs', category: 'creation', threshold: 100, metric: 'qr_codes_created', title: '100 QR Codes!', message: 'You are running a real QR operation. 100 codes tracking real engagement.', icon: '🏆', reward: { type: 'credit', amount: 25, description: '$25 account credit' }, badge: 'QR Power User' },
  { id: 'thousand_qrs', category: 'creation', threshold: 1000, metric: 'qr_codes_created', title: '1,000 QR Codes — Enterprise Scale!', message: '1,000 dynamic QRs. You are enterprise-grade now.', icon: '⚡', reward: { type: 'feature_unlock', feature: 'bulk_api_export', description: 'Bulk API export unlocked' }, badge: 'Enterprise QR' },
  // Scan milestones
  { id: 'first_scan', category: 'engagement', threshold: 1, metric: 'total_scans', title: 'First Scan!', message: 'Your QR just got scanned. The loop is closed.', icon: '📱', reward: null, badge: 'First Scan' },
  { id: 'hundred_scans', category: 'engagement', threshold: 100, metric: 'total_scans', title: '100 Scans!', message: '100 people engaged with your QR experience.', icon: '🔍', reward: null, badge: 'Engaged Brand' },
  { id: 'thousand_scans', category: 'engagement', threshold: 1000, metric: 'total_scans', title: '1,000 Scans — Real Traffic!', message: 'You have real consumer engagement through QR. 1,000 scans.', icon: '🚀', reward: { type: 'credit', amount: 25, description: '$25 account credit' }, badge: 'Traffic Driver' },
  { id: 'ten_thousand_scans', category: 'engagement', threshold: 10000, metric: 'total_scans', title: '10,000 Scans — Brand Scale!', message: 'QR as a genuine marketing channel. 10k scans and counting.', icon: '🌟', reward: { type: 'discount', percent: 20, description: '20% off annual plan' }, badge: 'Scale Marketer' },
  // AI art milestones
  { id: 'first_ai_art', category: 'design', threshold: 1, metric: 'ai_art_generated', title: 'First AI Art QR Generated!', message: 'Beautiful and functional. Your first AI-styled QR is ready.', icon: '🎨', reward: null, badge: 'AI Artist' },
  { id: 'ten_ai_arts', category: 'design', threshold: 10, metric: 'ai_art_generated', title: '10 AI Art QR Codes!', message: 'A gallery of branded QR experiences. 10 AI-generated designs.', icon: '🖼️', reward: { type: 'feature_unlock', feature: 'custom_style_presets', description: 'Custom style presets unlocked' }, badge: 'Design Pro' },
  // Campaign milestones
  { id: 'first_campaign', category: 'campaigns', threshold: 1, metric: 'campaigns_created', title: 'First Campaign Launched!', message: 'Your first QRON campaign is live. Track it, tweak it, win with it.', icon: '📣', reward: null, badge: 'Campaigner' },
  { id: 'five_campaigns', category: 'campaigns', threshold: 5, metric: 'campaigns_created', title: '5 Campaigns Running!', message: 'A multi-campaign marketer. 5 active QRON campaigns.', icon: '📌', reward: { type: 'credit', amount: 30, description: '$30 account credit' }, badge: 'Campaign Manager' },
  // Revenue milestones
  { id: 'first_payment', category: 'revenue', threshold: 1, metric: 'payments_made', title: 'First Payment — You\'re In!', message: 'Welcome to the paid QRON community. Unlimited QR ahead.', icon: '💳', reward: { type: 'bonus', amount: 50, description: '50 bonus AI art generations' }, badge: 'Paying Customer' },
  { id: 'one_year', category: 'retention', threshold: 365, metric: 'days_active', title: 'One Year of QRON!', message: 'A year of dynamic QR experiences. You are a power user.', icon: '🎉', reward: { type: 'credit', amount: 100, description: '$100 account credit' }, badge: 'Annual Member' },
];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: achieved } = await supabase.from('milestone_achievements').select('*').eq('user_id', user.id);
    const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle();
    const achievedIds = (achieved || []).map((a: any) => a.milestone_id);

    const enriched = MILESTONES.map(m => {
      const current = (stats as any)?.[m.metric] || 0;
      const isAchieved = achievedIds.includes(m.id);
      return {
        ...m,
        achieved: isAchieved,
        achieved_at: (achieved || []).find((a: any) => a.milestone_id === m.id)?.achieved_at || null,
        current_value: current,
        progress_percent: Math.min(100, Math.round((current / m.threshold) * 100)),
        remaining: isAchieved ? 0 : Math.max(0, m.threshold - current)
      };
    });

    const total_achieved = achievedIds.length;
    return NextResponse.json({
      success: true,
      total_milestones: MILESTONES.length,
      total_achieved,
      completion_percent: Math.round((total_achieved / MILESTONES.length) * 100),
      milestones: enriched,
      next_milestone: enriched.find(m => !m.achieved) || null
    });
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

    const { metric, new_value } = await req.json();
    if (!metric || new_value === undefined) return NextResponse.json({ error: 'metric and new_value required' }, { status: 400 });

    const triggered = MILESTONES.filter(m => m.metric === metric && new_value >= m.threshold);
    if (!triggered.length) return NextResponse.json({ success: true, newly_achieved: [] });

    const { data: existing } = await supabase.from('milestone_achievements').select('milestone_id').eq('user_id', user.id);
    const existingIds = (existing || []).map((e: any) => e.milestone_id);
    const newlyAchieved = triggered.filter(m => !existingIds.includes(m.id));

    if (newlyAchieved.length > 0) {
      await supabase.from('milestone_achievements').insert(
        newlyAchieved.map(m => ({ user_id: user.id, milestone_id: m.id, metric, value_at_achievement: new_value, reward: m.reward || null, achieved_at: new Date().toISOString() }))
      );
    }

    return NextResponse.json({
      success: true,
      newly_achieved: newlyAchieved.map(m => ({ id: m.id, title: m.title, message: m.message, icon: m.icon, badge: m.badge, reward: m.reward, celebrate: true }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
