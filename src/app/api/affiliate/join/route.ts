import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAutomation } from '@/lib/automation';

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
    const random = Buffer.from(crypto.getRandomValues(new Uint8Array(2))).toString('hex');
    const affiliateId = `${base}-${random}`;

    // 2. Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ affiliate_id: affiliateId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    // 3. Create the payable affiliates row the rest of the system depends on
    //    (connect/payout/stats + webhook accrual all look it up by affiliatecode).
    //    Without this, "joining" never actually enrolled a payable affiliate.
    //    Idempotent: skip if this user already has a row.
    const { data: existingAff } = await supabase
      .from('affiliates')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingAff) {
      const { error: affErr } = await supabase.from('affiliates').insert({
        user_id: userId,
        affiliatecode: affiliateId,
        email,
        status: 'active',
        commission_rate: 0.1,
        pending_payout: 0,
        total_referrals: 0,
        total_conversions: 0,
        total_earnings: 0,
        created_at: new Date().toISOString(),
      });
      // Don't fail the join if the affiliates row insert hits a race/constraint;
      // the profile.affiliate_id is already set. Log and continue.
      if (affErr) console.warn('[affiliate/join] affiliates row insert warning:', affErr.message);
    }

    return NextResponse.json({ ok: true, affiliateId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[affiliate/join] Error:', err);
    await logAutomation('affiliate_join', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed to join program' }, { status: 500 });
  }
}
