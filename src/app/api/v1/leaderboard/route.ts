import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const metric = searchParams.get('metric') || 'scans';
  const limit = parseInt(searchParams.get('limit') || '10');

  const leaderboard = [
    { rank: 1, user_id: 'user_042', display_name: 'BrandLab Co', avatar: '/avatars/42.png', total_scans: 48290, qr_codes: 312, campaigns: 18, growth_pct: 24.5, badge: 'top_scanner' },
    { rank: 2, user_id: 'user_017', display_name: 'TechRetail Inc', avatar: '/avatars/17.png', total_scans: 39140, qr_codes: 205, campaigns: 12, growth_pct: 18.2, badge: 'rising_star' },
    { rank: 3, user_id: 'user_089', display_name: 'EventPro Agency', avatar: '/avatars/89.png', total_scans: 31870, qr_codes: 450, campaigns: 34, growth_pct: 31.7, badge: 'campaign_king' },
    { rank: 4, user_id: 'user_056', display_name: 'LocalBiz Network', avatar: '/avatars/56.png', total_scans: 28430, qr_codes: 87, campaigns: 6, growth_pct: 9.1, badge: null },
    { rank: 5, user_id: 'user_023', display_name: 'DigitalFirst Media', avatar: '/avatars/23.png', total_scans: 25690, qr_codes: 178, campaigns: 22, growth_pct: 15.8, badge: null },
    { rank: 6, user_id: 'user_101', display_name: 'Startup Hub', avatar: '/avatars/101.png', total_scans: 21200, qr_codes: 93, campaigns: 9, growth_pct: 42.3, badge: 'fastest_grower' },
    { rank: 7, user_id: 'user_034', display_name: 'Commerce Plus', avatar: '/avatars/34.png', total_scans: 18750, qr_codes: 264, campaigns: 15, growth_pct: 7.4, badge: null },
    { rank: 8, user_id: 'user_078', display_name: 'Creative Studio X', avatar: '/avatars/78.png', total_scans: 16340, qr_codes: 142, campaigns: 28, growth_pct: 11.2, badge: null },
    { rank: 9, user_id: 'user_045', display_name: 'GrowthHack Agency', avatar: '/avatars/45.png', total_scans: 14890, qr_codes: 67, campaigns: 5, growth_pct: 28.9, badge: null },
    { rank: 10, user_id: 'user_062', display_name: 'QR Masters', avatar: '/avatars/62.png', total_scans: 12560, qr_codes: 389, campaigns: 41, growth_pct: 3.6, badge: null }
  ];

  const top_entries = leaderboard.slice(0, Math.min(limit, 10));

  return NextResponse.json({
    success: true,
    leaderboard: top_entries,
    period,
    metric,
    total_participants: 2847,
    last_updated: new Date(Date.now() - 15 * 60000).toISOString(),
    generated_at: new Date().toISOString()
  });
}
