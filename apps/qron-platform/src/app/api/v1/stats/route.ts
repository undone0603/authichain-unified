import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qron_id = searchParams.get('qron_id');
  const period = searchParams.get('period') || '30d';

  return NextResponse.json({
    success: true,
    api_version: 'v1',
    qron_id: qron_id || 'all',
    period,
    stats: {
      total_scans: 18420,
      unique_scans: 11203,
      scan_growth_pct: 24.3,
      top_countries: [
        { country: 'US', scans: 8200, pct: 0.445 },
        { country: 'GB', scans: 3100, pct: 0.168 },
        { country: 'CA', scans: 2400, pct: 0.130 },
        { country: 'DE', scans: 1800, pct: 0.098 },
        { country: 'JP', scans: 920, pct: 0.050 },
      ],
      top_devices: [
        { device: 'mobile', scans: 14376, pct: 0.781 },
        { device: 'desktop', scans: 2947, pct: 0.160 },
        { device: 'tablet', scans: 1097, pct: 0.060 },
      ],
      scans_by_hour: {
        peak_hour: 14,
        peak_day: 'Wednesday',
        distribution: [120, 85, 60, 45, 30, 40, 90, 180, 280, 350, 420, 490, 510, 480, 520, 460, 410, 380, 330, 290, 240, 210, 170, 140]
      },
      conversion_rate: 0.034,
      avg_scans_per_day: 614,
    },
    protocol: 'QRON',
  });
}
