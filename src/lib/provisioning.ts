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
  /** Stripe checkout session id for session-level idempotency. */
  sessionId?: string | null;
}

export interface ProvisionResult {
  profileId: string | null;
  created: boolean;
  status: "provisioned" | "no_identity" | "upsert_failed";
  error?: string;
  /** This checkout session already granted. Do not reset usage or resend access. */
  skippedIdempotent?: boolean;
}

function grantFor(
  plan: string | null | undefined,
  explicit?: number
): number | undefined {
  if (typeof explicit === "number" && !Number.isNaN(explicit)) return explicit;
  if (plan && plan in PLAN_CREDITS) return PLAN_CREDITS[plan as PlanId];
  return undefined;
}

const UNLIMITED_SENTINEL = 999999;
const LIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due"]);

/** A one-time pack checkout: plan sells in Stripe "payment" mode and no subscription came with it. */
function isOneTimePack(input: ProvisionInput): boolean {
  if (input.stripeSubscriptionId) return false;
  const plan = input.plan ? planById(input.plan as PlanId) : undefined;
  return plan?.stripe_mode === "payment";
}

/** The profile carries a live subscription whose plan/status a pack must not overwrite. */
function hasActiveSubscription(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  if (
    typeof row.stripe_subscription_id !== "string" ||
    !row.stripe_subscription_id
  )
    return false;
  return (
    typeof row.subscription_status === "string" &&
    LIVE_SUB_STATUSES.has(row.subscription_status)
  );
}

/**
 * Stacked credit write for a one-time pack (credits purchased in packs never
 * expire): new limit = max(0, limit - used) + pack, used = 0. Unlimited stays.
 */
export function stackedPackCredits(
  row: Record<string, unknown> | null,
  pack: number
): { generations_limit: number; generations_used: number } {
  const limit = Number(row?.generations_limit);
  const used = Number(row?.generations_used);
  const l = Number.isFinite(limit) ? limit : 0;
  const u = Number.isFinite(used) ? used : 0;
  if (l >= UNLIMITED_SENTINEL)
    return { generations_limit: l, generations_used: u };
  return { generations_limit: Math.max(0, l - u) + pack, generations_used: 0 };
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
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) {
      console.error("[provisioning] profile lookup failed:", lookupError);
      return {
        profileId: null,
        created: false,
        status: "upsert_failed",
        error: lookupError.message || "profile lookup failed",
      };
    }
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

  // Session-level idempotency: do not reset generations_used if this session already granted.
  // A failed read must not look like "no prior grant" — that resets usage on retry.
  // The same read loads the credit/subscription columns a one-time pack stacks on.
  const oneTimePack = isOneTimePack(input);
  let current: Record<string, unknown> | null = null;
  if (input.sessionId || oneTimePack) {
    const { data: existingGrant, error: grantReadError } = await supabase
      .from("profiles")
      .select(
        "last_grant_session_id, generations_limit, generations_used, subscription_plan, subscription_status, stripe_subscription_id"
      )
      .eq("id", profileId)
      .maybeSingle();
    if (grantReadError) {
      console.error(
        "[provisioning] last_grant_session_id read failed:",
        grantReadError
      );
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: grantReadError.message || "grant lookup failed",
      };
    }
    current = (existingGrant as Record<string, unknown> | null) ?? null;
    if (
      input.sessionId &&
      existingGrant?.last_grant_session_id === input.sessionId
    ) {
      console.log(
        JSON.stringify({
          evt: "provision_skipped_idempotent",
          session: input.sessionId,
          profileId,
        })
      );
      return {
        profileId,
        created,
        status: "provisioned",
        skippedIdempotent: true,
      };
    }
  }

  // 2. Apply entitlements. Subscriptions reset usage so the new period starts
  // clean; one-time packs stack onto unused credits instead (never expire).
  const grant = grantFor(input.plan, input.generationsGrant);
  const keepSubscription = oneTimePack && hasActiveSubscription(current);
  // Live public.profiles has no subscribed_at column. PostgREST rejects the
  // whole update when an unknown column is present, so the grant never lands.
  const update: Record<string, unknown> = {
    brand: input.brand,
    // A pack bought by an active subscriber must not overwrite their plan/status.
    subscription_plan: keepSubscription ? undefined : (input.plan ?? undefined),
    subscription_status: keepSubscription
      ? undefined
      : input.isTrial
        ? "trialing"
        : "active",
    last_payment_at: input.isTrial ? undefined : new Date().toISOString(),
  };
  if (input.stripeCustomerId)
    update.stripe_customer_id = input.stripeCustomerId;
  if (input.stripeSubscriptionId)
    update.stripe_subscription_id = input.stripeSubscriptionId;
  if (grant !== undefined) {
    if (oneTimePack) {
      Object.assign(
        update,
        stackedPackCredits(created ? null : current, grant)
      );
    } else {
      update.generations_limit = grant;
      update.generations_used = 0;
    }
    if (input.sessionId) update.last_grant_session_id = input.sessionId;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", profileId);
  if (updateError) {
    console.error("[provisioning] entitlement update failed:", updateError);
    return {
      profileId,
      created,
      status: "upsert_failed",
      error: updateError.message || "profiles update failed",
    };
  }

  return { profileId, created, status: "provisioned" };
}
