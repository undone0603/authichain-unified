import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'monthly';
  const user_id = searchParams.get('user_id');

  const report = {
    id: `rpt_${Date.now()}`,
    period,
    user_id,
    generated_at: new Date().toISOString(),
    summary: {
      total_qr_codes: 1247,
      active_qr_codes: 892,
      total_scans: 48392,
      unique_scanners: 31847,
      conversion_rate: 12.4,
      top_performing_qr: { id: 'qr_abc123', name: 'Product Launch Campaign', scans: 8420 }
    },
    scan_trends: [
      { date: '2025-01-09', scans: 1240 },
      { date: '2025-01-10', scans: 1580 },
      { date: '2025-01-11', scans: 1920 },
      { date: '2025-01-12', scans: 1340 },
      { date: '2025-01-13', scans: 980 },
      { date: '2025-01-14', scans: 2150 },
      { date: '2025-01-15', scans: 2480 }
    ],
    device_breakdown: {
      mobile: 72.3,
      desktop: 18.1,
      tablet: 9.6
    },
    geographic_breakdown: [
      { country: 'US', scans: 28450, percentage: 58.8 },
      { country: 'UK', scans: 7200, percentage: 14.9 },
      { country: 'CA', scans: 4800, percentage: 9.9 },
      { country: 'AU', scans: 2940, percentage: 6.1 }
    ],
    revenue: {
      mrr: 2870.00,
      arr: 34440.00,
      growth_rate: 8.3
    },
    platform: 'QRON'
  };

  return NextResponse.json({ success: true, endpoint: '/api/report', report, platform: 'QRON' });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { type, period, user_id, date_range } = body;

  if (!type) return NextResponse.json({ error: 'Report type is required' }, { status: 400 });

  return NextResponse.json({
    success: true,
    message: 'Report generation initiated',
    report_id: `rpt_${Date.now()}`,
    type, period, user_id, date_range,
    status: 'processing',
    estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
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
