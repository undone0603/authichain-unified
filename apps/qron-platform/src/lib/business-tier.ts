import { createClient } from '@supabase/supabase-js';

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
    .from('profiles')
    .select('tier, generations_limit')
    .eq('id', userId)
    .single();

  // Business/enterprise tier OR generations_limit >= 999999 (unlimited sentinel)
  return (
    data?.tier === 'enterprise' || (data?.generations_limit ?? 0) >= 999999
  );
}

/**
 * Deduct one generation credit from the user's profile.
 * Returns { ok, remaining } or { ok: false, error }.
 */
export async function deductCredit(
  userId: string
): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('generations_used, generations_limit, tier')
    .eq('id', userId)
    .single();

  if (!profile) return { ok: false, error: 'Profile not found' };

  // Business tier = unlimited
  if (profile.tier === 'enterprise' || profile.generations_limit >= 999999) {
    return { ok: true, remaining: Infinity };
  }

  if (profile.generations_used >= profile.generations_limit) {
    return { ok: false, error: 'Generation limit reached' };
  }

  const { error } = await admin
    .from('profiles')
    .update({ generations_used: profile.generations_used + 1 })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    remaining: profile.generations_limit - profile.generations_used - 1,
  };
}
