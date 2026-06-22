import { NextRequest, NextResponse } from 'next/server';

const plans = [
  { id: 'plan_starter', name: 'Starter', price: 0, interval: 'month', features: ['10 QR codes', 'Basic analytics', 'PNG export', 'Community support'], max_qr_codes: 10 },
  { id: 'plan_pro', name: 'Pro', price: 29, interval: 'month', features: ['500 QR codes', 'Advanced analytics', 'All export formats', 'AI art styling', 'Priority support'], max_qr_codes: 500 },
  { id: 'plan_business', name: 'Business', price: 79, interval: 'month', features: ['Unlimited QR codes', 'Full analytics', 'API access', 'Custom branding', 'Team management', 'Dedicated support'], max_qr_codes: -1 },
  { id: 'plan_enterprise', name: 'Enterprise', price: 299, interval: 'month', features: ['Unlimited QR codes', 'Full analytics', 'API access', 'White-label', 'SLA', 'Custom integrations', 'Dedicated CSM'], max_qr_codes: -1 }
];

const subscriptions = [
  { id: 'sub_001', user_id: 'usr_001', plan: 'plan_pro', status: 'active', current_period_end: '2025-02-15T00:00:00Z', qr_codes_used: 127, qr_codes_limit: 500 },
  { id: 'sub_002', user_id: 'usr_002', plan: 'plan_business', status: 'active', current_period_end: '2025-02-20T00:00:00Z', qr_codes_used: 1843, qr_codes_limit: -1 }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const user_id = searchParams.get('user_id');

  if (type === 'plans') {
    return NextResponse.json({ success: true, plans, platform: 'QRON' });
  }

  let filtered = subscriptions;
  if (user_id) filtered = filtered.filter(s => s.user_id === user_id);

  return NextResponse.json({
    success: true,
    endpoint: '/api/subscription',
    subscriptions: filtered,
    total: filtered.length,
    active: filtered.filter(s => s.status === 'active').length,
    platform: 'QRON'
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { user_id, plan_id } = body;

  if (!user_id || !plan_id) {
    return NextResponse.json({ error: 'user_id and plan_id are required' }, { status: 400 });
  }

  const plan = plans.find(p => p.id === plan_id);
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    subscription: {
      id: `sub_${Date.now()}`,
      user_id, plan_id,
      plan_name: plan.name,
      status: 'active',
      amount: plan.price,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      qr_codes_limit: plan.max_qr_codes,
      platform: 'QRON'
    },
    platform: 'QRON'
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
