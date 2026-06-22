import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_LIMITS: Record<string, { qr_codes: number; scans_per_month: number; ai_styles: boolean; custom_domains: number }> = {
  free: { qr_codes: 5, scans_per_month: 500, ai_styles: false, custom_domains: 0 },
  starter: { qr_codes: 25, scans_per_month: 5000, ai_styles: false, custom_domains: 1 },
  pro: { qr_codes: 200, scans_per_month: 50000, ai_styles: true, custom_domains: 5 },
  enterprise: { qr_codes: 999999, scans_per_month: 999999, ai_styles: true, custom_domains: 999 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const [subResult, usageResult] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').eq('user_id', user_id).single(),
    supabase.from('qr_codes').select('id', { count: 'exact', head: true }).eq('user_id', user_id),
  ]);

  const plan = subResult.data?.plan || 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const qrCount = usageResult.count || 0;
  const qrUsagePercent = Math.round((qrCount / limits.qr_codes) * 100);

  const triggers = [];

  if (qrUsagePercent >= 80) {
    triggers.push({
      type: 'quota_warning',
      message: `You've used ${qrUsagePercent}% of your QR code limit. Upgrade to create more.`,
      cta: 'Upgrade Plan',
      urgency: qrUsagePercent >= 100 ? 'high' : 'medium',
    });
  }

  if (plan === 'free') {
    triggers.push({
      type: 'feature_gate',
      message: 'Unlock AI-styled QR codes, analytics, and custom domains with Pro.',
      cta: 'Try Pro Free for 14 Days',
      urgency: 'low',
    });
  }

  if (plan === 'starter') {
    triggers.push({
      type: 'upgrade_nudge',
      message: 'Pro users get 8x more QR codes, AI styles, and priority support.',
      cta: 'Upgrade to Pro',
      urgency: 'low',
    });
  }

  return NextResponse.json({
    current_plan: plan,
    qr_usage: { used: qrCount, limit: limits.qr_codes, percent: qrUsagePercent },
    upsell_triggers: triggers,
    next_plan: plan === 'free' ? 'starter' : plan === 'starter' ? 'pro' : null,
  });
}
