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
    .eq('user_id', userId)
    .single();

  return (
    data?.tier === 'enterprise' ||
    data?.tier === 'business' ||
    (data?.generations_limit ?? 0) >= 999999
  );
}

type DeductResult =
  | { ok: true;  remaining: number }
  | { ok: false; error: string };

/**
 * Atomically deduct one generation credit from the user's profile.
 *
 * Uses the `deduct_generation_credit` Postgres RPC which holds a
 * row-level lock (FOR UPDATE) for the duration of the transaction.
 * This prevents the TOCTOU race condition that existed in the previous
 * read-then-update implementation, where two concurrent requests could
 * both read the same `generations_used` value, both pass the limit
 * check, and both increment — resulting in one over-generation.
 *
 * Migration: supabase/migrations/00002_create_deduct_generation_credit_rpc.sql
 */
export async function deductCredit(userId: string): Promise<DeductResult> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin.rpc('deduct_generation_credit', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[deductCredit] RPC error:', error.message);
    return { ok: false, error: 'Credit check failed. Please try again.' };
  }

  const result = data as { status: string; remaining: number };

  switch (result.status) {
    case 'ok':
      return { ok: true, remaining: result.remaining };

    case 'unlimited':
      return { ok: true, remaining: Infinity };

    case 'limit_reached':
      return { ok: false, error: 'Generation limit reached. Please upgrade your plan.' };

    case 'not_found':
      return { ok: false, error: 'Profile not found. Please contact support.' };

    default:
      console.error('[deductCredit] Unexpected RPC status:', result.status);
      return { ok: false, error: 'Unexpected error during credit check.' };
  }
}
