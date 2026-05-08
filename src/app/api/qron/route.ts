import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/qron - List all QR codes for authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data: qrons, error, count } = await supabase
      .from('qrons')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      qrons: qrons || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error('[GET /api/qron]', err);
    return NextResponse.json({ error: 'Failed to fetch QR codes' }, { status: 500 });
  }
}

// POST /api/qron - Create a new QR code entry
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, target_url, shortcode, style_preset, metadata } = body;

    if (!target_url) {
      return NextResponse.json({ error: 'target_url is required' }, { status: 400 });
    }

    const { data: qron, error } = await supabase
      .from('qrons')
      .insert({
        user_id: user.id,
        name: name || 'Untitled QR',
        target_url,
        shortcode: shortcode || null,
        style_preset: style_preset || 'default',
        metadata: metadata || {},
        scan_count: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ qron }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/qron]', err);
    return NextResponse.json({ error: 'Failed to create QR code' }, { status: 500 });
  }
}

// PATCH /api/qron - Update a QR code (target URL, name)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Ensure user owns this QR code
    const { data: existing } = await supabase
      .from('qrons')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'QR code not found or access denied' }, { status: 404 });
    }

    const allowedFields = ['name', 'target_url', 'style_preset', 'metadata', 'is_active'];
    const safeUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) safeUpdates[field] = updates[field];
    }

    const { data: qron, error } = await supabase
      .from('qrons')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ qron });
  } catch (err) {
    console.error('[PATCH /api/qron]', err);
    return NextResponse.json({ error: 'Failed to update QR code' }, { status: 500 });
  }
}

// DELETE /api/qron - Delete a QR code
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('qrons')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/qron]', err);
    return NextResponse.json({ error: 'Failed to delete QR code' }, { status: 500 });
  }
}
