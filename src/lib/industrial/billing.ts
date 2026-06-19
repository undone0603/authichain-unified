import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' as const });
  }
  return _stripe;
}

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin(): ReturnType<typeof createClient> {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

export const METERED_PRICING = {
  verify_product: 1,      // 1 unit = $0.05
  register_product: 10,   // 10 units = $0.50
  check_eu_dpp: 100,      // 100 units = $5.00
  mint_certificate: 20,   // 20 units = $1.00
};

// Meter identifiers for Stripe Meters API (unique names per product).
const METER_IDS: Record<keyof typeof METERED_PRICING, string> = {
  verify_product: 'verify_product_calls',
  register_product: 'register_product_calls',
  check_eu_dpp: 'check_eu_dpp_calls',
  mint_certificate: 'mint_certificate_calls',
};

/**
 * Reports usage to Stripe via the Meters API.
 * Emits a meter event that gets aggregated into the next billing period.
 * Non-blocking by design — failures are logged but don't halt the main flow.
 *
 * @param userId The ID of the user/agency owning the agent
 * @param toolName The tool that was called
 */
export async function reportAgentUsage(userId: string, toolName: keyof typeof METERED_PRICING) {
  try {
    console.log(`[Billing] Reporting usage for ${userId}: ${toolName}`);

    // 1. Get the user's Stripe customer ID from profile
    const { data: profileRow } = await getAdmin()
      .from('profiles')
      .select('stripe_customer_id, tier')
      .eq('user_id', userId)
      .single();
    const profile = profileRow as { stripe_customer_id: string | null; tier: string } | null;

    if (!profile || !profile.stripe_customer_id) {
      console.warn(`[Billing] No Stripe customer for ${userId} - skipping meter event`);
      return;
    }

    // Skip free tier
    if (profile.tier === 'free') return;

    // 2. Emit meter event via Stripe Meters API
    const meterId = METER_IDS[toolName];
    const quantity = METERED_PRICING[toolName];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meterResponse = await (getStripe() as any).billing.meterEvents.create({
      event_name: meterId,
      customer: profile.stripe_customer_id,
      value: quantity,
      timestamp: Math.floor(Date.now() / 1000),
    });

    // 3. Log to DB for internal analytics
    await (getAdmin().from('automation_logs') as any).insert({
      workflow_name: 'metered_usage_reported',
      trigger_type: 'event',
      status: 'success',
      payload: JSON.stringify({
        userId,
        toolName,
        quantity,
        customerId: profile.stripe_customer_id,
        meterEventId: meterResponse.id,
      })
    });

    console.log(`[Billing] Meter event emitted: ${meterId} for ${profile.stripe_customer_id}`);

  } catch (err) {
    console.error('[Billing] Meter event emission failed:', err);
    try {
      await (getAdmin().from('automation_logs') as any).insert({
        workflow_name: 'metered_usage_reported',
        trigger_type: 'event',
        status: 'failure',
        error_message: err instanceof Error ? err.message : String(err),
      });
    } catch (logErr) {
      console.error('[Billing] Failed to write failure log:', logErr);
    }
  }
}
