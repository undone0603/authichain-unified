/**
 * Plans closed to new buyers, and the offer list that leaves them out.
 *
 * Kept apart from checkout-gate.ts so the discovery surfaces (llms.txt, MCP,
 * the estate workers) can import it without pulling in the checkout handler.
 */
import { catalogOffers, type CatalogOffer, type PlanId } from "./plans";

/**
 * Retired for new buyers (RES-86c). Existing subscribers keep billing,
 * webhooks, and plan lookups; /checkout/<id> answers 303 to /pricing and must
 * not mint new sessions.
 */
export const RETIRED_GATED_PLAN_IDS: readonly PlanId[] = [
  "qron_launch",
  "qron_launch_annual",
];

export function isRetiredPlan(id: PlanId): boolean {
  return RETIRED_GATED_PLAN_IDS.includes(id);
}

/**
 * Offers a new buyer can actually open. Anything that tells a person or an
 * agent where to pay lists these, not catalogOffers(): a retired plan's
 * checkout link redirects to /pricing and sells nothing.
 */
export function openCatalogOffers(): CatalogOffer[] {
  return catalogOffers().filter(offer => !isRetiredPlan(offer.id));
}
