import { createClient } from '@supabase/supabase-js';
import { PLAN_CREDITS, PLAN_TIER, type PlanId } from './plans';
import { logAutomation } from './automation';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface EntitlementResult {
  /** true if THIS call performed the grant; false if skipped (e.g. already done) */
  granted: boolean;
  reason?: string;
  tier?: string;
  credits?: number;
}

/**
 * Idempotently grant the paid entitlements for a completed Stripe Checkout
 * session: persist the Stripe customer id, raise generation credits, and set
 * the user's tier.
 *
 * Safe to call from BOTH the Stripe webhook (`/api/webhook`) and the
 * post-checkout success backstop (`/api/checkout/verify`). A per-session guard
 * row in `stripe_events` (key = `fulfill:<sessionId>`) makes the grant happen
 * EXACTLY ONCE even if both paths race — the PRIMARY KEY on `event_id` is the
 * arbiter. This is what makes fulfillment resilient to a missed or delayed
 * webhook: the customer still gets what they paid for when they land on the
 * success page, and never gets it twice.
 */
export async function grantCheckoutEntitlements(opts: {
  sessionId: string;
  userId?: string | null;
  planId?: string | null;
  customerId?: string | null;
  source: 'webhook' | 'backstop';
}): Promise<EntitlementResult> {
  const { sessionId, userId, planId, customerId, source } = opts;

  if (!sessionId) return { granted: false, reason: 'missing_session' };
  if (!userId || !planId) return { granted: false, reason: 'missing_metadata' };

  const id = planId as PlanId;
  if (!(id in PLAN_TIER)) return { granted: false, reason: 'unknown_plan' };
  const credits = PLAN_CREDITS[id];
  const tier = PLAN_TIER[id];

  const supabase = getServiceClient();
  const guardKey = `fulfill:${sessionId}`;

  // --- Idempotency claim: first writer wins on the PK unique constraint ---
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', guardKey)
    .maybeSingle();
  if (existing) return { granted: false, reason: 'already_fulfilled' };

  const { error: claimErr } = await supabase
    .from('stripe_events')
    .insert({
      event_id: guardKey,
      event_type: `fulfillment.${source}`,
      processed_at: new Date().toISOString(),
    });
  if (claimErr) {
    // Another path claimed the session between our select and insert (unique
    // violation) — treat as already fulfilled; never double-grant.
    return { granted: false, reason: 'already_fulfilled_race' };
  }

  try {
    // Persist Stripe customer id — required for metered billing + renewals
    if (customerId) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    // Set tier; pin the limit for unlimited (business/enterprise) plans
    await supabase
      .from('profiles')
      .update({
        tier,
        ...(credits >= 999999 ? { generations_limit: 999999 } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Add finite credits incrementally so a prior balance isn't wiped
    if (credits > 0 && credits < 999999) {
      await supabase.rpc('add_generation_credits', { user_uuid: userId, amount: credits });
    }

    await logAutomation('fulfillment.grant', 'event', 'success', {
      sessionId, userId, planId, credits, tier, source,
    });
    return { granted: true, tier, credits };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Release the claim so a redelivery/backstop can complete a half-finished
    // grant rather than being permanently blocked by the guard row.
    await supabase.from('stripe_events').delete().eq('event_id', guardKey);
    await logAutomation('fulfillment.grant', 'event', 'failure', { sessionId, userId, planId, source }, msg);
    throw err;
  }
}
