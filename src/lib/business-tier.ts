import { createClient } from "@supabase/supabase-js";

type CreditDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          tier: string | null;
          generations_limit: number;
          generations_used: number;
        };
        Insert: {
          id?: string;
          tier?: string | null;
          generations_limit?: number;
          generations_used?: number;
        };
        Update: {
          generations_used?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Check if a user is on the business (unlimited) plan.
 * Business-tier users skip credit deduction for generation and minting.
 */
export async function hasUnlimitedPlan(userId: string): Promise<boolean> {
  const admin = createClient<CreditDatabase>(
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
  admin: ReturnType<typeof createClient<CreditDatabase>>;
  profile: {
    generations_used: number;
    generations_limit: number;
    tier: string | null;
  } | null;
}> {
  const admin = createClient<CreditDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("generations_used, generations_limit, tier")
    .eq("id", userId)
    .single();

  return { admin, profile };
}

function creditStatus(
  profile: {
    generations_used: number;
    generations_limit: number;
    tier: string | null;
  } | null
): CreditResult {
  if (!profile) return { ok: false, error: "Profile not found" };

  if (profile.tier === "enterprise" || profile.generations_limit >= 999999) {
    return { ok: true, remaining: Infinity };
  }

  if (profile.generations_used >= profile.generations_limit) {
    return { ok: false, error: "Generation limit reached" };
  }

  return {
    ok: true,
    remaining: profile.generations_limit - profile.generations_used,
  };
}

/** Non-mutating credit check so a failed generate does not spend a pack. */
export async function checkCredit(userId: string): Promise<CreditResult> {
  const { profile } = await loadCreditProfile(userId);
  return creditStatus(profile);
}

/**
 * Deduct one generation credit from the user's profile.
 * Returns { ok, remaining } or { ok: false, error }.
 */
export async function deductCredit(userId: string): Promise<CreditResult> {
  const { admin, profile } = await loadCreditProfile(userId);
  const status = creditStatus(profile);
  if (!status.ok || !profile) return status;

  if (profile.tier === "enterprise" || profile.generations_limit >= 999999) {
    return { ok: true, remaining: Infinity };
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ generations_used: profile.generations_used + 1 })
    .eq("id", userId)
    .eq("generations_used", profile.generations_used)
    .lt("generations_used", profile.generations_limit)
    .select("generations_used");

  if (error) return { ok: false, error: error.message };
  if (!Array.isArray(data) || data.length === 0) {
    return {
      ok: false,
      error: "Generation credit changed during the request; please retry.",
    };
  }

  return {
    ok: true,
    remaining: profile.generations_limit - profile.generations_used - 1,
  };
}
