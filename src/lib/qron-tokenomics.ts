/**
 * $QRON obligation math. Not settlement.
 *
 * Live chain: 1_000_000_000 supply, almost all held by the payTo EOA.
 * The 100_000_000 figure on govchain.us is theater. Do not use it.
 *
 * Two different percents must not be added:
 * - Supply split 40/30/15/15 is a proposed cap table, not the holder map.
 * - Fiat burn is 25% of an enterprise-revenue dollar.
 *   The other four buckets split only the remaining 75%, in that same
 *   40:30:15:15 ratio, so the parts sum to the dollar. Applying 40/30/15/15
 *   to the gross and then also taking 25% burn would book 125%.
 *
 * Nothing here buys, burns, or transfers tokens. Autonomy stays off.
 */

export const LIVE_QRON_SUPPLY = 1_000_000_000;
export const THEATER_SUPPLY_DO_NOT_USE = 100_000_000;

export const SUPPLY_SPLIT = {
  treasury: 0.4,
  nodeOperators: 0.3,
  coreContributors: 0.15,
  ecosystemGrants: 0.15,
} as const;

export const FIAT_BURN_RATE = 0.25;

export type RevenueObligations = {
  amountCents: number;
  burnCents: number;
  treasuryCents: number;
  nodeOperatorsCents: number;
  coreContributorsCents: number;
  ecosystemGrantsCents: number;
  settlesOnChain: false;
  autonomyEnabled: false;
};

export function computeRevenueObligations(
  amountFiatUsd: number
): RevenueObligations {
  if (!Number.isFinite(amountFiatUsd) || amountFiatUsd < 0) {
    throw new Error("amountFiatUsd must be a non-negative finite number");
  }
  const cents = Math.round(amountFiatUsd * 100);
  const burnCents = Math.round(cents * FIAT_BURN_RATE);
  const rest = cents - burnCents;
  const treasuryCents = Math.round(rest * SUPPLY_SPLIT.treasury);
  const nodeOperatorsCents = Math.round(rest * SUPPLY_SPLIT.nodeOperators);
  const coreContributorsCents = Math.round(
    rest * SUPPLY_SPLIT.coreContributors
  );
  const ecosystemGrantsCents =
    rest - treasuryCents - nodeOperatorsCents - coreContributorsCents;
  const sum =
    burnCents +
    treasuryCents +
    nodeOperatorsCents +
    coreContributorsCents +
    ecosystemGrantsCents;
  if (sum !== cents) {
    throw new Error(`obligation sum ${sum} != ${cents}`);
  }
  return {
    amountCents: cents,
    burnCents,
    treasuryCents,
    nodeOperatorsCents,
    coreContributorsCents,
    ecosystemGrantsCents,
    settlesOnChain: false,
    autonomyEnabled: false,
  };
}
