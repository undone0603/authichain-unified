import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const track = searchParams.get('track') !== 'false';

  if (!id) {
    return NextResponse.json({ error: 'Missing QRON id parameter' }, { status: 400 });
  }

  // In production this would look up the QRON destination URL from database
  // and log the scan event for analytics
  return NextResponse.json({
    success: true,
    endpoint: '/api/redirect',
    qron_id: id,
    destination_url: `https://example.com/product/${id}`,
    tracking_enabled: track,
    scan_logged: track,
    scan_id: `scan_${Date.now()}`,
    metadata: {
      user_agent: req.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
    },
    message: 'In production, this endpoint performs a 302 redirect to the destination URL',
    protocol: 'QRON',
  });
}
