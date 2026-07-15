import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');
  const parent_id = searchParams.get('parent_id');

  const folders = [
    {
      id: 'folder_001',
      user_id: 'user_001',
      name: 'Marketing Campaigns',
      parent_id: null,
      color: '#3B82F6',
      icon: 'megaphone',
      qr_codes_count: 23,
      subfolders_count: 2,
      description: 'All QR codes for active marketing campaigns',
      created_at: '2025-01-05T00:00:00Z',
      updated_at: '2025-05-01T00:00:00Z'
    },
    {
      id: 'folder_002',
      user_id: 'user_001',
      name: 'Social Media',
      parent_id: 'folder_001',
      color: '#8B5CF6',
      icon: 'share',
      qr_codes_count: 8,
      subfolders_count: 0,
      description: 'QR codes for Instagram, TikTok, and LinkedIn',
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-04-15T00:00:00Z'
    },
    {
      id: 'folder_003',
      user_id: 'user_001',
      name: 'Product Labels',
      parent_id: null,
      color: '#10B981',
      icon: 'tag',
      qr_codes_count: 47,
      subfolders_count: 3,
      description: 'QR codes embedded on physical product packaging',
      created_at: '2025-02-01T00:00:00Z',
      updated_at: '2025-05-08T00:00:00Z'
    },
    {
      id: 'folder_004',
      user_id: 'user_001',
      name: 'Events',
      parent_id: null,
      color: '#F59E0B',
      icon: 'calendar',
      qr_codes_count: 12,
      subfolders_count: 1,
      description: 'QR codes for event check-ins and promotions',
      created_at: '2025-03-15T00:00:00Z',
      updated_at: '2025-05-05T00:00:00Z'
    },
    {
      id: 'folder_005',
      user_id: 'user_002',
      name: 'Restaurant Menu',
      parent_id: null,
      color: '#EF4444',
      icon: 'utensils',
      qr_codes_count: 6,
      subfolders_count: 0,
      description: 'Digital menu QR codes for table placements',
      created_at: '2025-04-01T00:00:00Z',
      updated_at: '2025-04-20T00:00:00Z'
    }
  ];

  let filtered = folders;
  if (user_id) filtered = filtered.filter(f => f.user_id === user_id);
  if (parent_id !== null && parent_id !== undefined) {
    filtered = filtered.filter(f => f.parent_id === (parent_id === 'null' ? null : parent_id));
  }

  const total_qr_codes = filtered.reduce((sum, f) => sum + f.qr_codes_count, 0);

  return NextResponse.json({
    success: true,
    folders: filtered,
    total: filtered.length,
    total_qr_codes,
    generated_at: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id, name, parent_id, color, icon, description } = body;

  if (!user_id || !name) {
    return NextResponse.json({ success: false, error: 'user_id and name are required' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    folder: {
      id: `folder_${Date.now()}`,
      user_id,
      name,
      parent_id: parent_id || null,
      color: color || '#6B7280',
      icon: icon || 'folder',
      qr_codes_count: 0,
      subfolders_count: 0,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  }, { status: 201 });
}
