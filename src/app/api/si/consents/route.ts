import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/require-admin';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { isSiFeedSource, type SiFeedSource } from '../../../../lib/si-feed';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

async function ownerId() {
  const result = await requireAdmin(await createClient());
  return result instanceof NextResponse ? result : result.user.id;
}

export async function GET() {
  try {
    const userId = await ownerId();
    if (userId instanceof NextResponse) return userId;

    const { data, error } = await getSupabaseAdmin()
      .from('si_feed_consents')
      .select('source, share_public, granted_at, revoked_at')
      .eq('user_id', userId);
    if (error) throw error;

    return NextResponse.json(
      { consents: data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load SI Feed permissions' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await ownerId();
    if (userId instanceof NextResponse) return userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== 'object' ||
      !('source' in body) ||
      !isSiFeedSource(body.source as string) ||
      !('share_public' in body) ||
      typeof body.share_public !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'source and boolean share_public are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from('si_feed_consents')
      .upsert(
        {
          user_id: userId,
          source: body.source as SiFeedSource,
          share_public: body.share_public,
          granted_at: body.share_public ? now : null,
          revoked_at: body.share_public ? null : now,
          updated_at: now,
        },
        { onConflict: 'user_id,source' }
      )
      .select('source, share_public, granted_at, revoked_at')
      .single();
    if (error) throw error;

    return NextResponse.json(
      { consent: data },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to update SI Feed permission' }, { status: 503 });
  }
}
