/**
 * Stripe Payment Links — Authentic Economy
 *
 * Every entry is derived from `src/lib/plans.ts`, the source of truth for
 * anything that charges a human. Keys are kept for existing importers.
 *
 * Until 2026-09-23 this file hard-coded links that belonged to no live
 * Stripe account (QRON Single/Brand Pack/Enterprise, credit packs,
 * AuthiChain Starter $299/mo, StrainChain Basic $199/mo). Those products were
 * archived in the 2026-08-31 Stripe cleanup, so each key now points at the
 * closest live catalogue SKU and shows that SKU's real name and price.
 */
import { planById, planPaymentLink, type PlanId } from "../src/lib/plans";

export interface PaymentLinkOffer {
  name: string;
  price: string;
  url: string;
}

function offer(id: PlanId): PaymentLinkOffer {
  const plan = planById(id);
  if (!plan?.stripe_payment_link) {
    throw new Error(`plans.ts ${id} has no Stripe Payment Link`);
  }
  const suffix = plan.price_suffix === "/month" ? "/mo" : "";
  return {
    name: plan.name,
    price: `$${plan.price.toLocaleString("en-US")}${suffix}`,
    // Gated authichain.com/checkout/<plan> (GET = confirm page, no session).
    url: planPaymentLink(id) ?? plan.stripe_payment_link,
  };
}

export const PAYMENT_LINKS = {
  qron: {
    singleDesign: offer("starter"),
    brandPack: offer("creator"),
    enterprise: offer("theater_3"),
    credits50: offer("starter"),
    credits250: offer("creator"),
    credits1000: offer("creator"),
  },
  authichain: {
    starter: offer("dpp_readiness"),
  },
  strainchain: {
    basic: offer("strainchain_farm"),
  },
} as const;

export type PaymentLinkKey = keyof typeof PAYMENT_LINKS;
