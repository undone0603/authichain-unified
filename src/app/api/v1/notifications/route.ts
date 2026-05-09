import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const type = searchParams.get('type');
  const read = searchParams.get('read');

  const notifications = [
    {
      id: 'notif_001',
      user_id: 'user_001',
      type: 'scan',
      title: 'QR Code Scanned',
      message: 'Your QR code "Product Launch" was scanned 150 times today.',
      read: false,
      priority: 'normal',
      action_url: '/dashboard/codes/qr_001',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif_002',
      user_id: 'user_001',
      type: 'milestone',
      title: 'Scan Milestone Reached',
      message: 'Congratulations! Your QR code has reached 1,000 total scans.',
      read: false,
      priority: 'high',
      action_url: '/dashboard/analytics',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif_003',
      user_id: 'user_001',
      type: 'billing',
      title: 'Subscription Renewal',
      message: 'Your Pro plan will renew in 7 days. Update payment method if needed.',
      read: true,
      priority: 'normal',
      action_url: '/dashboard/billing',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif_004',
      user_id: 'user_002',
      type: 'campaign',
      title: 'Campaign Completed',
      message: 'Campaign "Summer Sale" has ended. View performance report.',
      read: false,
      priority: 'normal',
      action_url: '/dashboard/campaigns/camp_001',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  let filtered = notifications;
  if (user_id) filtered = filtered.filter(n => n.user_id === user_id);
  if (type) filtered = filtered.filter(n => n.type === type);
  if (read !== null && read !== undefined) filtered = filtered.filter(n => n.read === (read === 'true'));

  const unread_count = filtered.filter(n => !n.read).length;

  return NextResponse.json({
    success: true,
    notifications: filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    total: filtered.length,
    unread_count,
    notification_types: ['scan', 'milestone', 'billing', 'campaign', 'system', 'alert'],
    generated_at: new Date().toISOString()
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { notification_id, read } = body;

  if (!notification_id) {
    return NextResponse.json({ success: false, error: 'notification_id required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Notification ${notification_id} marked as ${read ? 'read' : 'unread'}`,
    updated_at: new Date().toISOString()
  });
}
