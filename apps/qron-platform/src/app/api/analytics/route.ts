import { NextRequest, NextResponse } from 'next/server';

// GET /api/analytics - QR code scan analytics dashboard
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30d';
    const qr_id = searchParams.get('qr_id');

    const analytics = {
      period,
      qr_id: qr_id || 'all',
      summary: {
        total_scans: 14823,
        unique_scanners: 9241,
        avg_scans_per_day: 494,
        top_performing_qr: 'qr_brand_luxury_001',
      },
      scans_by_day: [
        { date: '2024-11-01', scans: 412 },
        { date: '2024-11-02', scans: 538 },
        { date: '2024-11-03', scans: 487 },
        { date: '2024-11-04', scans: 601 },
        { date: '2024-11-05', scans: 523 },
      ],
      top_locations: [
        { country: 'US', scans: 6200, percentage: 41.8 },
        { country: 'UK', scans: 2100, percentage: 14.2 },
        { country: 'DE', scans: 1800, percentage: 12.1 },
        { country: 'JP', scans: 1400, percentage: 9.4 },
        { country: 'CA', scans: 900, percentage: 6.1 },
      ],
      devices: {
        mobile: 78.3,
        desktop: 14.2,
        tablet: 7.5,
      },
      verification_rate: 94.7,
    };

    return NextResponse.json({ success: true, analytics });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
