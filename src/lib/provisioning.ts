/**
 * Hands-off provisioning.
 *
 * Centralises everything that must happen to grant a customer access after a
 * successful payment, so the same path runs for authenticated AND guest
 * checkouts across every brand. Called from the canonical Stripe webhook
 * (src/app/api/stripe/webhook/route.ts) on checkout.session.completed and
 * invoice.paid.
 *
 * Idempotent at the row level: it resolves an existing profile by user id or
 * email, creating one only if neither exists, then upserts entitlement fields.
 */

import { PLAN_CREDITS, type PlanId } from './plans';
import { type BrandId } from '@shared/brands';

// The webhook passes its existing service-role Supabase client (loosely typed).
type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export interface ProvisionInput {
  email?: string | null;
  userId?: string | null;
  plan?: string | null;
  brand: BrandId;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  isTrial?: boolean;
  /** Explicit generation grant; defaults to PLAN_CREDITS[plan] when omitted. */
  generationsGrant?: number;
}

export interface ProvisionResult {
  profileId: string | null;
  created: boolean;
  status: 'provisioned' | 'no_identity';
}

function grantFor(plan: string | null | undefined, explicit?: number): number | undefined {
  if (typeof explicit === 'number' && !Number.isNaN(explicit)) return explicit;
  if (plan && plan in PLAN_CREDITS) return PLAN_CREDITS[plan as PlanId];
  return undefined;
}

/**
 * Resolve (or create) the buyer's profile and apply entitlements. Returns the
 * profile id so the caller can chain follow-ups (welcome email, referral credit).
 */
export async function provisionPurchase(
  supabase: SupabaseLike,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const email = input.email?.toLowerCase().trim() || null;

  // 1. Resolve the target profile id (by user id, else by email, else create).
  let profileId: string | null = input.userId ?? null;
  let created = false;

  if (!profileId && email) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing?.id) {
      profileId = existing.id as string;
    } else {
      // Guest checkout with no prior account — create a minimal profile so the
      // purchase is never lost. The user can claim it later via the same email.
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({ email, brand: input.brand, created_at: new Date().toISOString() })
        .select('id')
        .maybeSingle();
      profileId = (inserted?.id as string) ?? null;
      created = !!profileId;
    }
  }

  if (!profileId) {
    // No user id and no email — nothing to attach entitlements to.
    return { profileId: null, created: false, status: 'no_identity' };
  }

  // 2. Apply entitlements. Reset usage so the new period starts clean.
  const grant = grantFor(input.plan, input.generationsGrant);
  const update: Record<string, unknown> = {
    brand: input.brand,
    subscription_plan: input.plan ?? undefined,
    subscription_status: input.isTrial ? 'trialing' : 'active',
    subscribed_at: new Date().toISOString(),
    last_payment_at: input.isTrial ? undefined : new Date().toISOString(),
  };
  if (input.stripeCustomerId) update.stripe_customer_id = input.stripeCustomerId;
  if (input.stripeSubscriptionId) update.stripe_subscription_id = input.stripeSubscriptionId;
  if (grant !== undefined) {
    update.generations_limit = grant;
    update.generations_used = 0;
  }

  await supabase.from('profiles').update(update).eq('id', profileId);

  return { profileId, created, status: 'provisioned' };
}
