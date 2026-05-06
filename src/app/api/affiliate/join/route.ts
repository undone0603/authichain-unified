import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/affiliate/join
 *
 * Generate a unique affiliate ID for the authenticated user.
 */
export async function POST(_request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const email = session.user.email || '';

    // 1. Generate unique affiliate ID (e.g., first part of email + random)
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const random = Math.random().toString(36).substring(2, 6);
    const affiliateId = `${base}-${random}`;

    // 2. Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ affiliate_id: affiliateId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.json({ ok: true, affiliateId });
  } catch (err: unknown) {
    console.error('[affiliate/join] Error:', err);
    return NextResponse.json({ error: 'Failed to join program' }, { status: 500 });
  }
}
