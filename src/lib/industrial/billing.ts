import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27' as any,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

/**
 * BILLING CONFIGURATION
 * Defines the metered pricing for AI agent tool calls.
 */
export const METERED_PRICING = {
  verify_product: 1,      // 1 unit = $0.05
  register_product: 10,   // 10 units = $0.50
  check_eu_dpp: 100,      // 100 units = $5.00
  mint_certificate: 20,   // 20 units = $1.00
};

/**
 * Reports usage to Stripe Metered Billing.
 * Part of the "Stripe for AI Agents" autonomous revenue stream.
 * 
 * @param userId The ID of the user/agency owning the agent
 * @param toolName The tool that was called
 */
export async function reportAgentUsage(userId: string, toolName: keyof typeof METERED_PRICING) {
  try {
    console.log(`[Billing] Reporting usage for ${userId}: ${toolName}`);

    // 1. Get the user's active metered subscription item
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, tier')
      .eq('user_id', userId)
      .single();

    if (!profile || !profile.stripe_subscription_id) {
      console.warn(`[Billing] No active subscription for ${userId} - skipping reporting`);
      return;
    }

    // Skip reporting for free tier or if not enterprise (unless we want to bill everyone)
    if (profile.tier === 'free') return;

    // 2. Find the metered subscription item
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const meteredItem = subscription.items.data.find(item => 
      item.price.recurring?.usage_type === 'metered'
    );

    if (!meteredItem) {
      console.error(`[Billing] No metered item found in subscription ${profile.stripe_subscription_id}`);
      return;
    }

    // 3. Report usage units based on tool value
    const quantity = METERED_PRICING[toolName] || 1;
    
    await (stripe as any).subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });

    // 4. Log to DB for internal analytics
    await admin.from('automation_logs').insert({
      workflow_name: 'metered_usage_reported',
      trigger_type: 'event',
      status: 'success',
      payload: JSON.stringify({ userId, toolName, quantity, subscriptionId: subscription.id })
    });

    console.log(`[Billing] Successfully reported ${quantity} units for ${toolName}`);

  } catch (err) {
    console.error('[Billing] Reporting failed:', err);
    // Non-blocking log
    admin.from('automation_logs').insert({
      workflow_name: 'metered_usage_reported',
      trigger_type: 'event',
      status: 'failure',
      error_message: err instanceof Error ? err.message : String(err)
    }).then();
  }
}
