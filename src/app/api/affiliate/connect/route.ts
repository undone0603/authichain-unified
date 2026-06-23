import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { logAutomation } from '@/lib/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' as const });
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://authichain.com';

/**
 * POST /api/affiliate/connect
 *
 * Starts (or resumes) Stripe Connect Express onboarding for the authenticated
 * affiliate. Creates an Express account on first call, persists the acct_… id
 * to profiles.stripe_account_id, and returns a one-time onboarding link.
 *
 * Only users with an `affiliates` row may onboard — this is the table that
 * actually drives payouts.
 */
export async function POST(_request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const admin = getAdmin();

    // Must be a registered affiliate (affiliates table is the source of truth)
    const { data: affiliate } = await admin
      .from('affiliates')
      .select('id, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({ error: 'Not an affiliate' }, { status: 403 });
    }

    const stripe = getStripe();

    // Reuse an existing connected account if present, else create one.
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id, email')
      .eq('id', user.id)
      .maybeSingle();

    let accountId = (profile as { stripe_account_id?: string } | null)?.stripe_account_id || null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email ?? (profile as { email?: string } | null)?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: user.id, affiliate_id: String(affiliate.id) },
      });
      accountId = account.id;
      await admin
        .from('profiles')
        .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/dashboard/affiliate?connect=refresh`,
      return_url: `${APP_URL}/dashboard/affiliate?connect=done`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url, accountId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logAutomation('affiliate_connect', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed to start Connect onboarding' }, { status: 500 });
  }
}

/**
 * GET /api/affiliate/connect
 *
 * Returns the current Connect onboarding status for the authenticated affiliate
 * (whether the account can receive transfers yet).
 */
export async function GET(_request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    const accountId = (profile as { stripe_account_id?: string } | null)?.stripe_account_id;
    if (!accountId) {
      return NextResponse.json({ connected: false, payouts_enabled: false });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ connected: true, payouts_enabled: false });
    }

    const account = await getStripe().accounts.retrieve(accountId);
    return NextResponse.json({
      connected: true,
      payouts_enabled: account.payouts_enabled === true,
      details_submitted: account.details_submitted === true,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read Connect status' }, { status: 500 });
  }
}
