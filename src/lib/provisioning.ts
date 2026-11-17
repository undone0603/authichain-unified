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

/** Durable per-session receipt. Lockstep with workers/stripe-webhook grantReceiptKey. */
export function grantReceiptKey(sessionId: string): string {
  return `grant:${sessionId}`;
}

/** Atomic pack/period grant. Lockstep with workers/stripe-webhook CATALOG_GRANT_RPC. */
export const CATALOG_GRANT_RPC = "grant_catalog_checkout_session";
export const CATALOG_GRANT_MIGRATION =
  "supabase/migrations/20261115180000_atomic_catalog_session_grants.sql";

export function isMissingCatalogGrantRpc(
  error:
    | {
        message?: string;
        code?: string;
        status?: number;
      }
    | null
    | undefined
): boolean {
  if (!error) return false;
  if (error.status === 404) return true;
  const code = error.code || "";
  if (code === "PGRST202" || code === "42883") return true;
  return /does not exist|PGRST202|schema cache|could not find the function/i.test(
    error.message || ""
  );
}

export type CatalogGrantArgs = {
  profileId: string;
  sessionId: string;
  plan: string;
  brand: string;
  generations: number;
  stack: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  isTrial?: boolean;
};

export type CatalogGrantState = {
  receipts: Set<string>;
  receiptProfiles?: Record<string, string | null>;
  row: Record<string, unknown>;
};

/** RPC evidence must name this buyer on both granted and already_granted. */
export function catalogGrantReturnedProfileMatches(
  returnedProfileId: unknown,
  expectedProfileId: string
): boolean {
  return (
    returnedProfileId != null && String(returnedProfileId) === expectedProfileId
  );
}

// The webhook passes its existing service-role Supabase client (loosely typed).
type SupabaseLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc?: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
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
  /** Use the DPP RPC that commits the grant and idempotency key atomically. */
  atomicDppSessionGrant?: boolean;
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
/** Re-read and retry this many times after a conditional write matches 0 rows. */
export const PROVISION_CAS_RETRIES = 3;
const CAS_COLUMNS = [
  "generations_limit",
  "generations_used",
  "last_grant_session_id",
] as const;
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
 * In-memory semantics of grant_catalog_checkout_session: the receipt claim and
 * the credit write are one step. Tests use this instead of split REST calls.
 */
export function applyCatalogGrantState(
  state: CatalogGrantState,
  args: CatalogGrantArgs
):
  | { status: "granted" | "already_granted"; profileId: string }
  | { status: "conflict"; profileId: string } {
  const key = grantReceiptKey(args.sessionId);
  if (state.receipts.has(key)) {
    if (
      state.receiptProfiles &&
      Object.prototype.hasOwnProperty.call(state.receiptProfiles, key)
    ) {
      const receiptProfile = state.receiptProfiles[key];
      if (receiptProfile == null || receiptProfile !== args.profileId) {
        return {
          status: "conflict",
          profileId: receiptProfile ?? args.profileId,
        };
      }
    }
    return { status: "already_granted", profileId: args.profileId };
  }
  if (state.row.last_grant_session_id === args.sessionId) {
    state.receipts.add(key);
    if (state.receiptProfiles) {
      state.receiptProfiles[key] = args.profileId;
    }
    return { status: "already_granted", profileId: args.profileId };
  }
  state.receipts.add(key);
  if (state.receiptProfiles) {
    state.receiptProfiles[key] = args.profileId;
  }
  const credits = args.stack
    ? stackedPackCredits(state.row, args.generations)
    : {
        generations_limit: args.generations,
        generations_used: 0,
      };
  const keepSubscription = args.stack && hasActiveSubscription(state.row);
  Object.assign(state.row, credits, {
    last_grant_session_id: args.sessionId,
    brand: args.brand,
  });
  if (!keepSubscription) {
    state.row.subscription_plan = args.plan;
    state.row.subscription_status = args.isTrial ? "trialing" : "active";
    if (args.stripeSubscriptionId) {
      state.row.stripe_subscription_id = args.stripeSubscriptionId;
    }
  }
  if (args.stripeCustomerId) {
    state.row.stripe_customer_id = args.stripeCustomerId;
  }
  return { status: "granted", profileId: args.profileId };
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

  if (input.atomicDppSessionGrant) {
    if (
      input.plan !== "dpp_readiness" ||
      !input.sessionId ||
      input.stripeSubscriptionId
    ) {
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: "invalid atomic DPP grant request",
      };
    }
    if (!supabase.rpc) {
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: "atomic DPP grant RPC unavailable",
      };
    }

    const { data, error } = await supabase.rpc("grant_dpp_checkout_session", {
      p_profile_id: profileId,
      p_session_id: input.sessionId,
      p_brand: input.brand,
      p_stripe_customer_id: input.stripeCustomerId ?? null,
    });
    if (error) {
      console.error("[provisioning] atomic DPP grant failed:", error.message);
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: error.message || "atomic DPP grant failed",
      };
    }

    const result = data as { profile_id?: unknown; status?: unknown } | null;
    if (result?.status === "already_granted") {
      return {
        profileId,
        created,
        status: "provisioned",
        skippedIdempotent: true,
      };
    }
    if (result?.status !== "granted" || result.profile_id !== profileId) {
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: "atomic DPP grant returned invalid evidence",
      };
    }
    return { profileId, created, status: "provisioned" };
  }

  const oneTimePack = isOneTimePack(input);
  const grant = grantFor(input.plan, input.generationsGrant);

  // Checkout sessions claim grant:{sessionId} and apply credits in one RPC.
  // Split REST (profile write, then receipt insert) is not exactly-once: a
  // crash between them lets a later replay restack after last_grant moves.
  if (input.sessionId && grant !== undefined && input.plan) {
    if (!supabase.rpc) {
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: "atomic catalog grant RPC unavailable",
      };
    }
    const { data, error } = await supabase.rpc(CATALOG_GRANT_RPC, {
      p_profile_id: profileId,
      p_session_id: input.sessionId,
      p_plan: input.plan,
      p_brand: input.brand,
      p_generations: grant,
      p_stack: oneTimePack,
      p_stripe_customer_id: input.stripeCustomerId ?? null,
      p_stripe_subscription_id: input.stripeSubscriptionId ?? null,
      p_is_trial: Boolean(input.isTrial),
    });
    if (error) {
      console.error(
        "[provisioning] atomic catalog grant failed:",
        error.message
      );
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: isMissingCatalogGrantRpc(error)
          ? "atomic catalog grant RPC unavailable"
          : error.message || "atomic catalog grant failed",
      };
    }
    const result = data as { profile_id?: unknown; status?: unknown } | null;
    if (result?.status === "already_granted") {
      if (!catalogGrantReturnedProfileMatches(result.profile_id, profileId)) {
        return {
          profileId,
          created,
          status: "upsert_failed",
          error: "catalog_grant_receipt_conflict",
        };
      }
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
    if (
      result?.status !== "granted" ||
      !catalogGrantReturnedProfileMatches(result.profile_id, profileId)
    ) {
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: "atomic catalog grant returned invalid evidence",
      };
    }
    return { profileId, created, status: "provisioned" };
  }

  // No checkout session id: invoice refill and similar writes stay on CAS.
  // Lost-update guard (CFA-346, no extra table): the write is conditional on
  // the generations_limit / generations_used / last_grant_session_id values
  // read. If another writer got there first, the update matches 0 rows;
  // re-read and retry, then fail closed so Stripe redelivers.
  const needsRead = Boolean(oneTimePack);

  for (let attempt = 0; attempt <= PROVISION_CAS_RETRIES; attempt++) {
    let current: Record<string, unknown> | null = null;
    if (needsRead) {
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
    }

    // 2. Apply entitlements. Subscriptions reset usage so the new period starts
    // clean; one-time packs stack onto unused credits instead (never expire).
    const keepSubscription = oneTimePack && hasActiveSubscription(current);
    // Live public.profiles has no subscribed_at column. PostgREST rejects the
    // whole update when an unknown column is present, so the grant never lands.
    const update: Record<string, unknown> = {
      brand: input.brand,
      // A pack bought by an active subscriber must not overwrite their plan/status.
      subscription_plan: keepSubscription
        ? undefined
        : (input.plan ?? undefined),
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
        Object.assign(update, stackedPackCredits(current, grant));
      } else {
        update.generations_limit = grant;
        update.generations_used = 0;
      }
      if (input.sessionId) update.last_grant_session_id = input.sessionId;
    }

    // biome-ignore lint: loosely typed PostgREST builder
    let q: any = supabase.from("profiles").update(update).eq("id", profileId);
    const conditional = needsRead && current !== null;
    if (conditional) {
      for (const col of CAS_COLUMNS) {
        const v = current![col];
        q = v === null || v === undefined ? q.is(col, null) : q.eq(col, v);
      }
      q = q.select("id");
    }
    const { data: written, error: updateError } = await q;
    if (updateError) {
      console.error("[provisioning] entitlement update failed:", updateError);
      return {
        profileId,
        created,
        status: "upsert_failed",
        error: updateError.message || "profiles update failed",
      };
    }
    if (!conditional || (Array.isArray(written) && written.length > 0)) {
      return { profileId, created, status: "provisioned" };
    }
    console.warn(
      JSON.stringify({
        evt: "provision_cas_conflict",
        session: input.sessionId ?? null,
        profileId,
        attempt,
      })
    );
  }

  return {
    profileId,
    created,
    status: "upsert_failed",
    error: "concurrent profile update; retry",
  };
}
