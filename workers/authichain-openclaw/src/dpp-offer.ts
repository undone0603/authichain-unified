import { gatedCheckoutUrl, planById } from "../../../src/lib/plans";

const DPP_PLAN_ID = "dpp_readiness";

const PHRASES = new Set([
  "dpp",
  "buy dpp",
  "dpp readiness",
  "eu dpp",
  "checkout dpp",
]);

export function isDppOfferText(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[?!.,]/g, "");
  return PHRASES.has(normalized);
}

/** Inbound reply only. Does not send mail or open a Stripe session. */
export function dppOfferReply(): {
  text: string;
  plan_id: typeof DPP_PLAN_ID;
  checkout_url: string;
  price_usd: number;
  sends_mail: false;
  opens_checkout_session: false;
} {
  const plan = planById(DPP_PLAN_ID);
  if (!plan) throw new Error("plans.ts has no dpp_readiness");
  const checkout_url = gatedCheckoutUrl(DPP_PLAN_ID);
  return {
    text: [
      `${plan.name} is a public offer at $${plan.price}.`,
      `The confirm page is ${checkout_url}.`,
      "This reply does not send email and does not open a Checkout Session.",
    ].join(" "),
    plan_id: DPP_PLAN_ID,
    checkout_url,
    price_usd: plan.price,
    sends_mail: false,
    opens_checkout_session: false,
  };
}

export function inboundDppOffer(text: string) {
  if (!isDppOfferText(text)) return null;
  return dppOfferReply();
}
