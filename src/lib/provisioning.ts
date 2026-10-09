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
 *
 * ARCHITECTURE NOTE: This function writes to Supabase profiles.generations_limit
 * (NOT the Drizzle subscriptions table). The profiles table is the single source
 * of truth for generation entitlements in the deployed system. The Drizzle
 * subscriptions table is a legacy model used only for admin analytics and
 * dunning status. See docs/CREDIT_MODEL_ARCHITECTURE.md for reconciliation.
 */

import { PLAN_CREDITS, planById, type PlanId } from "./plans";
import { type BrandId } from "@shared/brands";

// The webhook passes its existing service-role Supabase client (loosely typed).
type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Subscription-mode catalogue plan (kept over a one-time buy). */
function isSubscriptionPlan(plan: string): boolean {
  return planById(plan as PlanId)?.stripe_mode === "subscription";
}

/**
 * Grant credits at most once per Stripe Checkout Session (ADM-174).
 * Inserts `credit_grants(stripe_session_id PRIMARY KEY)`, ON CONFLICT DO
 * NOTHING. stripe_events (#1639) is keyed by event id and re-claims errored
 * or stale deliveries, so it cannot stop a second add for the same session
 * (completed + async_payment_succeeded, DPP replays, Resend after an error).
 * Fails closed: if the row cannot be written the purchase throws, so Stripe
 * retries instead of granting without a guard.
 */
async function claimCreditGrant(
  supabase: SupabaseLike,
  input: ProvisionInput,
  profileId: string,
  credits: number
): Promise<"granted" | "duplicate"> {
  if (!input.stripeSessionId) {
    throw new Error(
      "credit grant needs stripeSessionId (one-time pack, ADM-174 dedupe)"
    );
  }
  const { data, error } = await supabase
    .from("credit_grants")
    .upsert(
      {
        stripe_session_id: input.stripeSessionId,
        profile_id: profileId,
        plan: input.plan ?? null,
        credits,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true }
    )
    .select("stripe_session_id");
  if (error) {
    throw new Error(
      `credit_grants claim failed: ${error.message || String(error)}`
    );
  }
  return Array.isArray(data) && data.length > 0 ? "granted" : "duplicate";
}

/** One-time (Stripe mode "payment") catalogue plan. */
function isOneTimePlan(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return planById(plan as PlanId)?.stripe_mode === "payment";
}

export interface ProvisionInput {
  email?: string | null;
  userId?: string | null;
  plan?: string | null;
  brand: BrandId;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  isTrial?: boolean;
  /** Stripe Checkout Session id; one-time credit packs grant once per id. */
  stripeSessionId?: string | null;
  /** Explicit generation grant; defaults to PLAN_CREDITS[plan] when omitted. */
  generationsGrant?: number;
}

export interface ProvisionResult {
  profileId: string | null;
  created: boolean;
  status: "provisioned" | "no_identity" | "upsert_failed";
  error?: string;
}

function grantFor(
  plan: string | null | undefined,
  explicit?: number
): number | undefined {
  if (typeof explicit === "number" && !Number.isNaN(explicit)) return explicit;
  if (plan && plan in PLAN_CREDITS) return PLAN_CREDITS[plan as PlanId];
  return undefined;
}

/**
 * Resolve (or create) the buyer's profile and apply entitlements. Returns the
 * profile id so the caller can chain follow-ups (welcome email, referral credit).
 */
export async function provisionPurchase(
  supabase: SupabaseLike,
  input: ProvisionInput
): Promise<ProvisionResult> {
  const email = input.email?.toLowerCase().trim() || null;

  // 1. Resolve the target profile id (by user id, else by email, else create).
  let profileId: string | null = input.userId ?? null;
  let created = false;

  if (!profileId && email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) {
      profileId = existing.id as string;
    } else {
      // Guest checkout with no prior account — create a minimal profile so the
      // purchase is never lost. The user can claim it later via the same email.
      // Live profiles.user_id is an auth.users FK; guests omit it (nullable).
      const insertRow: Record<string, unknown> = {
        email,
        brand: input.brand,
        created_at: new Date().toISOString(),
      };
      if (input.userId) insertRow.user_id = input.userId;

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert(insertRow)
        .select("id")
        .maybeSingle();
      if (insertError) {
        console.error(
          "[provisioning] guest profile insert failed:",
          insertError
        );
        return {
          profileId: null,
          created: false,
          status: "upsert_failed",
          error: insertError.message || String(insertError),
        };
      }
      profileId = (inserted?.id as string) ?? null;
      created = !!profileId;
      if (!profileId) {
        return {
          profileId: null,
          created: false,
          status: "upsert_failed",
          error: "profiles insert returned no id",
        };
      }
    }
  }

  if (!profileId) {
    // No user id and no email — nothing to attach entitlements to.
    return { profileId: null, created: false, status: "no_identity" };
  }

  // 2. Apply entitlements.
  const grant = grantFor(input.plan, input.generationsGrant);
  const oneTime = isOneTimePlan(input.plan);

  const update: Record<string, unknown> = {
    brand: input.brand,
    subscription_plan: input.plan ?? undefined,
    subscription_status: input.isTrial ? "trialing" : "active",
    subscribed_at: new Date().toISOString(),
    last_payment_at: input.isTrial ? undefined : new Date().toISOString(),
  };
  if (input.stripeCustomerId)
    update.stripe_customer_id = input.stripeCustomerId;
  if (input.stripeSubscriptionId)
    update.stripe_subscription_id = input.stripeSubscriptionId;

  if (grant !== undefined && !oneTime) {
    // Subscription / unpriced plans: unchanged. The period starts clean.
    update.generations_limit = grant;
    update.generations_used = 0;
  } else if (grant !== undefined && oneTime && created) {
    // New guest: the pack is their whole balance (0 for the passport).
    // A brand-new profile cannot have been granted by an earlier delivery,
    // but claim the session anyway so a replay never adds on top.
    if (grant > 0) {
      const claim = await claimCreditGrant(supabase, input, profileId, grant);
      if (claim === "duplicate")
        return { profileId, created, status: "provisioned" };
    }
    update.generations_limit = grant;
    update.generations_used = 0;
  } else if (grant !== undefined && oneTime) {
    // ADM-172 / ADM-174: one-time packs on an existing profile ADD to the
    // limit, never reset usage, and never downgrade a subscription plan.
    // A 0-credit product (the StrainChain passport) leaves limit, used and
    // plan unchanged.
    const { data: current } = await supabase
      .from("profiles")
      .select("generations_limit, subscription_plan")
      .eq("id", profileId)
      .maybeSingle();
    const currentPlan =
      typeof current?.subscription_plan === "string"
        ? current.subscription_plan
        : null;
    if (grant === 0 || (currentPlan && isSubscriptionPlan(currentPlan))) {
      delete update.subscription_plan;
    }
    if (grant > 0) {
      const claim = await claimCreditGrant(supabase, input, profileId, grant);
      if (claim === "granted") {
        const existing = Number(current?.generations_limit);
        update.generations_limit =
          (Number.isFinite(existing) ? existing : 0) + grant;
      }
      // "duplicate": this session already credited; record nothing new.
    }
  }

  await supabase.from("profiles").update(update).eq("id", profileId);

  return { profileId, created, status: "provisioned" };
}
