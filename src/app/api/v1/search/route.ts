import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type'); // 'qr_codes' | 'campaigns' | 'templates' | 'all'
  const user_id = searchParams.get('user_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!q || q.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  const qrCodes = [
    { id: 'qr_001', type: 'qr_code', name: 'Product Landing Page QR', url: 'https://example.com/product', tags: ['product', 'marketing'], user_id: 'user_001', scans: 1240, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: 'qr_002', type: 'qr_code', name: 'Event Check-in Code', url: 'https://example.com/checkin', tags: ['event', 'checkin'], user_id: 'user_001', scans: 342, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 'qr_003', type: 'qr_code', name: 'Restaurant Menu QR', url: 'https://example.com/menu', tags: ['food', 'restaurant'], user_id: 'user_002', scans: 5621, created_at: new Date(Date.now() - 60 * 86400000).toISOString() }
  ];

  const campaigns = [
    { id: 'camp_001', type: 'campaign', name: 'Summer Product Launch', status: 'active', qr_count: 12, total_scans: 8900, user_id: 'user_001', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
    { id: 'camp_002', type: 'campaign', name: 'Restaurant Loyalty Program', status: 'active', qr_count: 5, total_scans: 3200, user_id: 'user_002', created_at: new Date(Date.now() - 20 * 86400000).toISOString() }
  ];

  const templates = [
    { id: 'tmpl_001', type: 'template', name: 'Modern Blue Circle', category: 'business', preview_url: '/templates/modern-blue.png', uses: 430 },
    { id: 'tmpl_002', type: 'template', name: 'Product Label Classic', category: 'retail', preview_url: '/templates/product-classic.png', uses: 218 }
  ];

  const lowerQ = q.toLowerCase();

  let results: any[] = [];
  
  if (!type || type === 'qr_codes' || type === 'all') {
    let qrs = qrCodes.filter(qr =>
      qr.name.toLowerCase().includes(lowerQ) ||
      qr.url.toLowerCase().includes(lowerQ) ||
      qr.tags.some(t => t.includes(lowerQ))
    );
    if (user_id) qrs = qrs.filter(qr => qr.user_id === user_id);
    results = results.concat(qrs);
  }
  
  if (!type || type === 'campaigns' || type === 'all') {
    let camps = campaigns.filter(c => c.name.toLowerCase().includes(lowerQ));
    if (user_id) camps = camps.filter(c => c.user_id === user_id);
    results = results.concat(camps);
  }
  
  if (!type || type === 'templates' || type === 'all') {
    const tmpl = templates.filter(t => t.name.toLowerCase().includes(lowerQ));
    results = results.concat(tmpl);
  }

  return NextResponse.json({
    success: true,
    query: q,
    results: results.slice(0, limit),
    total: results.length,
    types: ['qr_codes', 'campaigns', 'templates', 'all']
  });
}
