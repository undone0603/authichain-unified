import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get('plan');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const users = [
    {
      id: 'user_001',
      name: 'Jordan Lee',
      email: 'jordan@acmecorp.com',
      company: 'Acme Corp',
      plan: 'pro',
      status: 'active',
      qr_codes: 48,
      total_scans: 12840,
      api_calls_month: 2341,
      joined: '2025-09-01T00:00:00Z',
      last_active: '2026-05-09T04:00:00Z',
      mfa_enabled: true,
      protocol: 'QRON'
    },
    {
      id: 'user_002',
      name: 'Casey Morgan',
      email: 'casey@startuphq.io',
      company: 'StartupHQ',
      plan: 'starter',
      status: 'active',
      qr_codes: 12,
      total_scans: 1204,
      api_calls_month: 450,
      joined: '2026-01-15T00:00:00Z',
      last_active: '2026-05-08T20:00:00Z',
      mfa_enabled: false,
      protocol: 'QRON'
    },
    {
      id: 'user_003',
      name: 'Taylor Kim',
      email: 'taylor@enterprise.com',
      company: 'Enterprise Solutions',
      plan: 'enterprise',
      status: 'active',
      qr_codes: 524,
      total_scans: 98421,
      api_calls_month: 18934,
      joined: '2024-06-01T00:00:00Z',
      last_active: '2026-05-09T01:00:00Z',
      mfa_enabled: true,
      protocol: 'QRON'
    }
  ];

  let filtered = users;
  if (plan) filtered = filtered.filter(u => u.plan === plan);
  if (status) filtered = filtered.filter(u => u.status === status);

  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    success: true,
    users: paginated,
    total: filtered.length,
    active: filtered.filter(u => u.status === 'active').length,
    by_plan: {
      starter: filtered.filter(u => u.plan === 'starter').length,
      pro: filtered.filter(u => u.plan === 'pro').length,
      enterprise: filtered.filter(u => u.plan === 'enterprise').length
    },
    total_qr_codes: filtered.reduce((s, u) => s + u.qr_codes, 0),
    total_scans: filtered.reduce((s, u) => s + u.total_scans, 0),
    page,
    limit,
    protocol: 'QRON'
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
