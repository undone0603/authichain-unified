/**
 * Minimal slice of the Supabase client this module uses, so callers on the
 * edge Worker (server/webhooks/stripe.ts) and tests can pass their own.
 */
export type AffiliateAccrualClient = {
  rpc: (
    fn: "accrue_affiliate_commission",
    args: {
      p_event_id: string;
      p_affiliate_code: string;
      p_amount_cents: number;
      p_conversion: boolean;
    }
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type AffiliateAccrualResult =
  | { credited: true; affiliateId: string; commission: number }
  | { credited: false; reason: string };

/**
 * Credit an affiliate's pending_payout for a paid sale.
 *
 * `conversion: true` is the first sale (checkout), which also bumps the
 * referral and conversion counters; renewals pass false. The update is
 * conditional on the pending_payout value that was read. Concurrent balance
 * changes are re-read and retried a bounded number of times.
 */
export async function accrueAffiliateCommission(
  supabase: AffiliateAccrualClient | null,
  opts: {
    affiliateCode: string;
    amountCents: number;
    conversion: boolean;
    eventId: string;
  }
): Promise<AffiliateAccrualResult> {
  const { affiliateCode, amountCents, conversion, eventId } = opts;
  if (!supabase) return { credited: false, reason: "no_supabase" };
  if (!affiliateCode) return { credited: false, reason: "no_code" };
  if (!eventId) return { credited: false, reason: "no_event_id" };
  if (!(amountCents > 0)) return { credited: false, reason: "zero_amount" };

  try {
    const { data, error } = await supabase.rpc("accrue_affiliate_commission", {
      p_event_id: eventId,
      p_affiliate_code: affiliateCode,
      p_amount_cents: amountCents,
      p_conversion: conversion,
    });
    if (error) return { credited: false, reason: `rpc: ${error.message}` };
    const result = data as {
      credited?: boolean;
      affiliate_id?: string;
      commission?: number;
      reason?: string;
    } | null;
    if (!result?.credited) {
      return { credited: false, reason: result?.reason || "unknown_result" };
    }
    return {
      credited: true,
      affiliateId: String(result.affiliate_id),
      commission: Number(result.commission),
    };
  } catch (e) {
    return {
      credited: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
