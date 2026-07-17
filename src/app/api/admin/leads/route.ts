/**
 * @file route.ts
 * @project qron-platform
 * @author AuthiChain Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/leads
 *
 * Fetches all ecosystem leads with filtering and search.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const authResult = await requireAdmin(supabase);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');

    let query = supabase
      .from('lead_captures')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (source) query = query.eq('product_interest', source);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/leads
 * 
 * Updates a lead's status or score.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const authResult = await requireAdmin(supabase);
    if (authResult instanceof NextResponse) return authResult;

    const { id, status, score } = await request.json();

    const { data, error } = await supabase
      .from('lead_captures')
      .update({ status, score, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
