import { NextRequest, NextResponse } from 'next/server';

const payments = [
  { id: 'pay_001', user_id: 'usr_001', amount: 29.00, currency: 'usd', status: 'succeeded', plan: 'Pro', method: 'card', card_last4: '4242', created_at: '2025-01-15T10:30:00Z', invoice_id: 'inv_001' },
  { id: 'pay_002', user_id: 'usr_002', amount: 79.00, currency: 'usd', status: 'succeeded', plan: 'Business', method: 'card', card_last4: '5555', created_at: '2025-01-14T14:20:00Z', invoice_id: 'inv_002' },
  { id: 'pay_003', user_id: 'usr_001', amount: 29.00, currency: 'usd', status: 'succeeded', plan: 'Pro', method: 'card', card_last4: '4242', created_at: '2025-01-01T08:00:00Z', invoice_id: 'inv_003' }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const status = searchParams.get('status');

  let filtered = payments;
  if (user_id) filtered = filtered.filter(p => p.user_id === user_id);
  if (status) filtered = filtered.filter(p => p.status === status);

  return NextResponse.json({
    success: true,
    endpoint: '/api/payment',
    payments: filtered,
    total: filtered.length,
    total_revenue: filtered.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0),
    platform: 'QRON'
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { user_id, amount, plan, method = 'card' } = body;

  if (!user_id || !amount) {
    return NextResponse.json({ error: 'user_id and amount are required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    payment: {
      id: `pay_${Date.now()}`,
      user_id,
      amount: parseFloat(amount),
      currency: 'usd',
      status: 'succeeded',
      plan,
      method,
      created_at: new Date().toISOString(),
      invoice_id: `inv_${Date.now()}`,
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
