import { NextRequest, NextResponse } from 'next/server';

// GET /api/notifications - Get user notifications
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unread_only = searchParams.get('unread_only') === 'true';

    const notifications = [
      {
        id: 'notif_001',
        type: 'scan_milestone',
        title: 'QR Code reached 1,000 scans',
        message: 'Your QR code qr_brand_luxury_001 just hit 1,000 scans!',
        read: false,
        created_at: '2024-11-05T10:23:00Z',
      },
      {
        id: 'notif_002',
        type: 'billing',
        title: 'Invoice paid successfully',
        message: 'Your November invoice of $499 has been paid.',
        read: true,
        created_at: '2024-11-01T08:00:00Z',
      },
      {
        id: 'notif_003',
        type: 'security',
        title: 'New login detected',
        message: 'A new login was detected from San Francisco, CA.',
        read: false,
        created_at: '2024-11-04T15:44:00Z',
      },
    ];

    const filtered = unread_only ? notifications.filter(n => !n.read) : notifications;
    return NextResponse.json({ success: true, notifications: filtered, unread_count: notifications.filter(n => !n.read).length });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notification_ids, mark_all_read } = body;
    return NextResponse.json({
      success: true,
      marked_read: mark_all_read ? 'all' : notification_ids,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
