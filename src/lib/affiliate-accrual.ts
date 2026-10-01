import { AFFILIATE_BASE_RATE } from "./affiliate-rate";

/**
 * Minimal slice of the Supabase client this module uses, so callers on the
 * edge Worker (server/webhooks/stripe.ts) and tests can pass their own.
 */
export type AffiliateAccrualClient = {
  from: (table: "affiliates") => any;
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
  opts: { affiliateCode: string; amountCents: number; conversion: boolean }
): Promise<AffiliateAccrualResult> {
  const { affiliateCode, amountCents, conversion } = opts;
  if (!supabase) return { credited: false, reason: "no_supabase" };
  if (!affiliateCode) return { credited: false, reason: "no_code" };
  if (!(amountCents > 0)) return { credited: false, reason: "zero_amount" };

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: aff, error } = await supabase
        .from("affiliates")
        .select(
          "id, pending_payout, total_referrals, total_conversions, commission_rate, status"
        )
        .eq("affiliatecode", affiliateCode)
        .maybeSingle();
      if (error) return { credited: false, reason: `lookup: ${error.message}` };
      if (!aff) return { credited: false, reason: "unknown_code" };
      if (aff.status !== "active") return { credited: false, reason: "inactive" };

      const rate = Number(aff.commission_rate ?? AFFILIATE_BASE_RATE);
      const commission = Math.round((amountCents / 100) * rate * 100) / 100;
      if (!(commission > 0))
        return { credited: false, reason: "zero_commission" };

      const update: Record<string, unknown> = {
        pending_payout: Number(aff.pending_payout ?? 0) + commission,
        updated_at: new Date().toISOString(),
      };
      if (conversion) {
        update.total_referrals = Number(aff.total_referrals ?? 0) + 1;
        update.total_conversions = Number(aff.total_conversions ?? 0) + 1;
      }

      const { data: updated, error: updateError } = await supabase
        .from("affiliates")
        .update(update)
        .eq("id", aff.id)
        .eq("pending_payout", aff.pending_payout ?? 0)
        .select("id");
      if (updateError) {
        return { credited: false, reason: `update: ${updateError.message}` };
      }
      if (updated?.length) {
        return { credited: true, affiliateId: String(aff.id), commission };
      }
    }
    return { credited: false, reason: "concurrent_update" };
  } catch (e) {
    return {
      credited: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
