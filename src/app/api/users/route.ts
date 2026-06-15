export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth-middleware';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_UPDATE_FIELDS = new Set(['name', 'company', 'timezone', 'avatar']);

/**
 * GET /api/users
 * Returns the authenticated user's own profile.
 * Never returns other users — caller identity comes from the session only.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { data: profile, error } = await admin
    .from('profiles')
    .select('user_id, display_name, email, tier, company, timezone, avatar_url, mfa_enabled, created_at, last_active_at')
    .eq('user_id', session.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: profile });
}

/**
 * PATCH /api/users
 * Updates allowed fields of the authenticated user's own profile.
 * Ignores any field not in the ALLOWED_UPDATE_FIELDS allowlist.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Allowlist: strip any keys the caller is not permitted to update
  const safeUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) safeUpdates[key] = value;
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json(
      { error: `No valid fields to update. Allowed: ${[...ALLOWED_UPDATE_FIELDS].join(', ')}` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('user_id', session.id)
    .select('user_id, display_name, email, tier, company, timezone, avatar_url, updated_at')
    .single();

  if (error) {
    console.error('[users] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: updated });
}
