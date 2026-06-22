import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const period = searchParams.get('period') || 'monthly';

  const usage = {
    user_id: user_id || 'usr_001',
    period,
    generated_at: new Date().toISOString(),
    qr_codes: {
      used: 127,
      limit: 500,
      percentage: 25.4,
      remaining: 373
    },
    scans: {
      total: 48392,
      this_period: 12840,
      last_period: 10920,
      growth_rate: 17.6
    },
    api_calls: {
      total: 8472,
      this_period: 2140,
      limit: 10000,
      percentage: 21.4,
      remaining: 7860
    },
    storage: {
      used_mb: 24.7,
      limit_mb: 1000,
      percentage: 2.5
    },
    exports: {
      total: 84,
      this_period: 18,
      formats: { png: 45, svg: 22, pdf: 17 }
    },
    team_members: {
      active: 3,
      limit: 10,
      invites_pending: 1
    },
    overage_charges: 0,
    next_reset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    platform: 'QRON'
  };

  return NextResponse.json({
    success: true,
    endpoint: '/api/usage',
    usage,
    platform: 'QRON'
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
