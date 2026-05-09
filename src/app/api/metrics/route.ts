import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '7d';

  return NextResponse.json({
    success: true,
    endpoint: '/api/metrics',
    period,
    metrics: {
      qrons_generated: { total: 45230, change: '+12%' },
      total_scans: { total: 187420, change: '+28%' },
      unique_visitors: { total: 94300, change: '+18%' },
      conversion_rate: { value: 0.034, change: '+2%' },
      top_countries: ['US', 'GB', 'CA', 'DE', 'JP'],
      top_campaigns: ['Product Launch Q2', 'Trade Show 2026'],
      scan_by_device: { mobile: 0.78, desktop: 0.18, tablet: 0.04 },
      hourly_distribution: {
        peak_hour: 14,
        peak_day: 'Wednesday',
      },
    },
    protocol: 'QRON',
  });
}
