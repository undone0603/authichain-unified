import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const qr_id = searchParams.get('qr_id');
  const rating = searchParams.get('rating');
  const type = searchParams.get('type');

  const feedback = [
    {
      id: 'fb_001',
      qr_id: 'qr_abc123',
      user_id: 'user_001',
      type: 'scan_experience',
      rating: 5,
      comment: 'QR code scanned perfectly, redirected instantly.',
      device: 'mobile',
      os: 'iOS',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: 'fb_002',
      qr_id: 'qr_def456',
      user_id: 'user_002',
      type: 'broken_link',
      rating: 1,
      comment: 'Scanned but destination URL returned 404 error.',
      device: 'mobile',
      os: 'Android',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'fb_003',
      qr_id: 'qr_abc123',
      user_id: 'user_003',
      type: 'design',
      rating: 4,
      comment: 'Love the custom styling but the contrast could be better.',
      device: 'mobile',
      os: 'Android',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ];

  let filtered = feedback;
  if (qr_id) filtered = filtered.filter(f => f.qr_id === qr_id);
  if (rating) filtered = filtered.filter(f => f.rating === parseInt(rating));
  if (type) filtered = filtered.filter(f => f.type === type);

  const avg_rating = filtered.length
    ? (filtered.reduce((sum, f) => sum + f.rating, 0) / filtered.length).toFixed(2)
    : null;

  return NextResponse.json({
    success: true,
    feedback: filtered,
    total: filtered.length,
    avg_rating: avg_rating ? parseFloat(avg_rating) : null,
    types: ['scan_experience', 'broken_link', 'design', 'performance', 'general']
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { qr_id, type, rating, comment, device, os } = body;

  if (!qr_id || !type || !rating) {
    return NextResponse.json({ success: false, error: 'qr_id, type, and rating are required' }, { status: 400 });
  }

  const newFeedback = {
    id: `fb_${Date.now()}`,
    qr_id,
    type,
    rating,
    comment: comment || null,
    device: device || null,
    os: os || null,
    created_at: new Date().toISOString()
  };

  return NextResponse.json({ success: true, feedback: newFeedback }, { status: 201 });
}
