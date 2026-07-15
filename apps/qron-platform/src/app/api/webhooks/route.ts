/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/webhooks
 * 
 * Fetches all active webhook subscriptions for the current user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // First get the brand_id for this user
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json([]);

    const { data, error } = await supabase
      .from('brand_webhooks')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/webhooks
 * 
 * Registers a new webhook endpoint.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // First get the brand_id for this user
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'No brand profile found' }, { status: 400 });

    const { target_url, event_types, secret } = await req.json();

    const { data, error } = await supabase
      .from('brand_webhooks')
      .insert({
        brand_id: brand.id,
        brand: brand.name,
        endpoint_url: target_url,
        events: event_types || ['qron_scanned'],
        secret_key: secret || `whsec_${Math.random().toString(36).substring(2, 11)}`,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks
 * 
 * Revokes a webhook subscription.
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { error } = await supabase
      .from('brand_webhooks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
