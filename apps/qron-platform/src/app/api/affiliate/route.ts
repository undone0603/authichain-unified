import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMMISSION_RATE = 0.30; // 30% recurring commission
const COOKIE_DAYS = 60;

function generateCode(userId: string): string {
  return 'QR' + userId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({
        enrolled: false,
        program: {
          commission_rate: COMMISSION_RATE,
          cookie_days: COOKIE_DAYS,
          min_payout: 50,
          payout_schedule: 'monthly',
          description: 'Earn 30% recurring commission on every paying customer you refer.',
        }
      });
    }

    const { data: referrals } = await supabase
      .from('referral_conversions')
      .select('id, converted_at, plan, monthly_value, status')
      .eq('affiliate_id', affiliate.id);

    const totalEarned = (referrals || []).filter(r => r.status === 'paid').reduce((s: number, r: any) => s + (r.monthly_value * COMMISSION_RATE), 0);
    const pendingEarnings = (referrals || []).filter(r => r.status === 'pending').reduce((s: number, r: any) => s + (r.monthly_value * COMMISSION_RATE), 0);

    return NextResponse.json({
      enrolled: true,
      affiliate_code: affiliate.code,
      affiliate_url: `https://qron.space?ref=${affiliate.code}`,
      stats: {
        total_referrals: (referrals || []).length,
        active_referrals: (referrals || []).filter(r => r.status !== 'churned').length,
        total_earned: parseFloat(totalEarned.toFixed(2)),
        pending_earnings: parseFloat(pendingEarnings.toFixed(2)),
        next_payout_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0],
      },
      recent_referrals: (referrals || []).slice(0, 10),
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

    const { data: existing } = await supabase.from('affiliates').select('id').eq('user_id', user.id).single();
    if (existing) return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });

    const code = generateCode(user.id);
    const { data, error } = await supabase.from('affiliates').insert({
      user_id: user.id,
      code,
      commission_rate: COMMISSION_RATE,
      status: 'active',
      enrolled_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      affiliate_code: code,
      affiliate_url: `https://qron.space?ref=${code}`,
      message: 'Welcome to the QRON Affiliate Program! Share your link and earn 30% recurring commission.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
