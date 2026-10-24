import { gatedCheckoutUrl } from '@/lib/plans';

/**
 * Soft upgrade prompt for credit-low after mode generation.
 * Routes to existing Starter Pack ($29/100). No new SKU.
 * Estimated margin ~90% (COGS ~$0.03/gen estimate).
 */
export function softUpgradePrompt(remainingCredits: number | undefined, modeId?: string): { text: string; url: string } | null {
  if (!modeId || remainingCredits == null || remainingCredits >= 20) return null;

  return {
    text: "You’re using modes. Get 100 more generations for $29 — Starter Pack, paid once.",
    url: gatedCheckoutUrl("starter"),
  };
}
