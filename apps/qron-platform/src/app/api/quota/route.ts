import { NextRequest, NextResponse } from 'next/server';

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: {
    qr_codes: 10,
    scans_per_month: 500,
    campaigns: 1,
    team_members: 1,
    custom_domains: 0,
    api_calls_per_day: 100,
    ai_styles: 3,
    export_rows: 100,
  },
  starter: {
    qr_codes: 100,
    scans_per_month: 10000,
    campaigns: 10,
    team_members: 3,
    custom_domains: 1,
    api_calls_per_day: 1000,
    ai_styles: 20,
    export_rows: 5000,
  },
  pro: {
    qr_codes: 1000,
    scans_per_month: 100000,
    campaigns: 50,
    team_members: 10,
    custom_domains: 5,
    api_calls_per_day: 10000,
    ai_styles: 100,
    export_rows: 50000,
  },
  business: {
    qr_codes: 10000,
    scans_per_month: 1000000,
    campaigns: 500,
    team_members: 50,
    custom_domains: 25,
    api_calls_per_day: 100000,
    ai_styles: -1, // unlimited
    export_rows: -1, // unlimited
  },
  enterprise: {
    qr_codes: -1,
    scans_per_month: -1,
    campaigns: -1,
    team_members: -1,
    custom_domains: -1,
    api_calls_per_day: -1,
    ai_styles: -1,
    export_rows: -1,
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const plan = searchParams.get('plan') || 'free';

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['free'];

  // In production, fetch actual usage from DB
  const usage = {
    qr_codes: 0,
    scans_per_month: 0,
    campaigns: 0,
    team_members: 1,
    custom_domains: 0,
    api_calls_today: 0,
    ai_styles_used: 0,
    export_rows_this_month: 0,
  };

  const quota_status: Record<string, { used: number; limit: number; remaining: number | string; percent: number }> = {};

  for (const [key, limit] of Object.entries(limits)) {
    const usageKey = key === 'api_calls_per_day' ? 'api_calls_today' : key;
    const used = (usage as Record<string, number>)[usageKey] || 0;
    const remaining = limit === -1 ? 'unlimited' : Math.max(0, limit - used);
    const percent = limit === -1 ? 0 : Math.round((used / limit) * 100);
    quota_status[key] = { used, limit: limit === -1 ? -1 : limit, remaining, percent };
  }

  const warnings = Object.entries(quota_status)
    .filter(([, v]) => typeof v.remaining === 'number' && v.percent >= 80)
    .map(([k, v]) => ({ resource: k, percent_used: v.percent }));

  return NextResponse.json({
    success: true,
    user_id,
    plan,
    quota: quota_status,
    warnings,
    reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  });
}
