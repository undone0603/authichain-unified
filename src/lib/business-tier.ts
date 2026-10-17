import { createClient } from "@supabase/supabase-js";

/**
 * Check if a user is on the business (unlimited) plan.
 * Business-tier users skip credit deduction for generation and minting.
 */
export async function hasUnlimitedPlan(userId: string): Promise<boolean> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin
    .from("profiles")
    .select("tier, generations_limit")
    .eq("id", userId)
    .single();

  // Business/enterprise tier OR generations_limit >= 999999 (unlimited sentinel)
  return (
    data?.tier === "enterprise" || (data?.generations_limit ?? 0) >= 999999
  );
}

type CreditResult = { ok: boolean; remaining?: number; error?: string };

async function loadCreditProfile(userId: string): Promise<{
  admin: ReturnType<typeof createClient>;
  profile: {
    generations_used: number;
    generations_limit: number;
    tier: string | null;
    pack_credits?: number | null;
  } | null;
}> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("generations_used, generations_limit, tier, pack_credits")
    .eq("id", userId)
    .single();

  return { admin, profile };
}

type CreditProfile = {
  generations_used: number;
  generations_limit: number;
  tier: string | null;
  pack_credits?: number | null;
};

function packBalance(profile: CreditProfile): number {
  const n = Number(profile.pack_credits ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isUnlimited(profile: CreditProfile): boolean {
  return profile.tier === "enterprise" || profile.generations_limit >= 999999;
}

/** Monthly/plain allowance left, then separate pack credits (see migration 20261017023000). */
export function creditStatus(profile: CreditProfile | null): CreditResult {
  if (!profile) return { ok: false, error: "Profile not found" };
  if (isUnlimited(profile)) return { ok: true, remaining: Infinity };
  const allowance = Math.max(
    0,
    profile.generations_limit - profile.generations_used
  );
  const remaining = allowance + packBalance(profile);
  if (remaining <= 0) return { ok: false, error: "Generation limit reached" };
  return { ok: true, remaining };
}

/**
 * Which column one generation spends: the monthly/plain allowance first,
 * then pack credits. Null when nothing is left or the profile is unlimited.
 */
export function creditSpend(
  profile: CreditProfile
): { generations_used: number } | { pack_credits: number } | null {
  if (isUnlimited(profile)) return null;
  if (profile.generations_used < profile.generations_limit) {
    return { generations_used: profile.generations_used + 1 };
  }
  const pack = packBalance(profile);
  if (pack > 0) return { pack_credits: pack - 1 };
  return null;
}

/** Non-mutating credit check so a failed generate does not spend a pack. */
export async function checkCredit(userId: string): Promise<CreditResult> {
  const { profile } = await loadCreditProfile(userId);
  return creditStatus(profile);
}

/**
 * Deduct one generation credit from the user's profile: monthly allowance
 * first, then pack credits. Returns { ok, remaining } or { ok: false, error }.
 */
export async function deductCredit(userId: string): Promise<CreditResult> {
  const { admin, profile } = await loadCreditProfile(userId);
  const status = creditStatus(profile);
  if (!status.ok || !profile) return status;
  if (isUnlimited(profile)) return { ok: true, remaining: Infinity };

  const spend = creditSpend(profile);
  if (!spend) return { ok: false, error: "Generation limit reached" };

  const { error } = await (admin.from("profiles") as any)
    .update(spend)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  return { ok: true, remaining: (status.remaining ?? 1) - 1 };
}
