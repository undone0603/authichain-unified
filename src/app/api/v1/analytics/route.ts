import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qr_id = searchParams.get('qr_id');
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const granularity = searchParams.get('granularity') || 'day';

  const analyticsData = {
    qr_id: qr_id || 'all',
    period: { start: start_date || '2026-04-01', end: end_date || '2026-05-01', granularity },
    summary: {
      total_scans: 2706,
      unique_scans: 1991,
      conversion_rate: 0.74,
      avg_scans_per_day: 87.3,
      peak_day: '2026-04-15',
      peak_hour: 14,
      total_qr_codes: 3
    },
    by_device: [
      { device: 'mobile', count: 2164, percentage: 79.9 },
      { device: 'tablet', count: 325, percentage: 12.0 },
      { device: 'desktop', count: 217, percentage: 8.1 }
    ],
    by_os: [
      { os: 'iOS', count: 1354, percentage: 50.0 },
      { os: 'Android', count: 1082, percentage: 40.0 },
      { os: 'Windows', count: 162, percentage: 6.0 },
      { os: 'macOS', count: 108, percentage: 4.0 }
    ],
    by_country: [
      { country: 'US', count: 1623, percentage: 60.0 },
      { country: 'CA', count: 406, percentage: 15.0 },
      { country: 'GB', count: 271, percentage: 10.0 },
      { country: 'AU', count: 162, percentage: 6.0 },
      { country: 'Other', count: 244, percentage: 9.0 }
    ],
    daily_scans: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
      scans: Math.floor(Math.random() * 150) + 50,
      unique: Math.floor(Math.random() * 100) + 30
    })),
    protocol: 'QRON'
  };

  return NextResponse.json({ success: true, analytics: analyticsData });
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
