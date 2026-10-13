/**
 * Deterministic public-offer reply for POST /api/sales.
 *
 * Checkout URLs come from the catalogue (publicCheckoutHref). This module
 * does not call a model, open a Stripe session, or quote a private plan.
 * A seal or verify link here is a pointer to the open verifier, not a verdict.
 */
import {
  isPublicPlanId,
  publicCheckoutHref,
  type PublicPlanId,
} from "./billing/live-catalog";
import { planById, planUsd, PUBLIC_PLAN_IDS } from "./plans";

const PRIVATE_IDS = [
  "strainchain_farm",
  "theater_1",
  "theater_3",
  "studio",
  "business",
  "enterprise_compliance",
] as const;

/** Bare "passport" is the battery offer, not the strainchain_passport alias. */
const ALIASES: Record<string, string> = {
  dpp: "dpp_readiness",
  farm: "strainchain_farm",
};

export type SalesIntent =
  | "purchase"
  | "verify"
  | "info"
  | "refused_private_plan";

export interface SalesAnswer {
  intent: SalesIntent;
  plan: PublicPlanId | null;
  checkout_url: string | null;
  verify_url: string | null;
  reply: string;
}

export const SALES_MAX_CHARS = 4000;

const PURCHASE =
  /\b(buy|purchase|checkout|upgrade|subscribe|pricing|pay|get started|sign up|start using)\b/i;
const VERIFY =
  /\b(verify|verification|check (a |the )?(record|seal|passport))\b/i;

function tokenPresent(text: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

export function mentionedPlanId(text: string): string | null {
  if (/\bfree plan\b/i.test(text)) return "free";
  const candidates = [
    ...PRIVATE_IDS,
    ...PUBLIC_PLAN_IDS,
    ...Object.keys(ALIASES),
  ]
    .filter((id) => id !== "free")
    .sort((a, b) => b.length - a.length);
  for (const id of candidates) {
    if (tokenPresent(text, id)) return ALIASES[id] ?? id;
  }
  if (/\btheaters?\b/i.test(text)) return "theater_1";
  return null;
}

function withUtm(plan: PublicPlanId): string {
  const url = new URL(publicCheckoutHref(plan));
  url.searchParams.set("utm_source", "authichain");
  url.searchParams.set("utm_medium", "sales_api");
  url.searchParams.set(
    "utm_campaign",
    plan === "dpp_readiness" ? "battery-passport" : "sales-api"
  );
  url.searchParams.set("utm_content", plan);
  return url.toString();
}

function recordId(text: string): string | null {
  const match = text.match(
    /\b(polygon-anchor-[A-Za-z0-9_-]+|AC-[0-9A-Fa-f]{8})\b/
  );
  return match ? match[1] : null;
}

export function publicSalesCheckout(plan: PublicPlanId): SalesAnswer {
  const row = planById(plan);
  const url = withUtm(plan);
  const price = planUsd(plan);
  const suffix = row?.price_suffix ?? "";
  const description = row?.description ?? "";
  return {
    intent: "purchase",
    plan,
    checkout_url: url,
    verify_url: null,
    reply: `${row?.name ?? plan} is $${price}${suffix}. ${description} Checkout: ${url}`,
  };
}

export function answerSalesInquiry(text: string): SalesAnswer {
  const named = mentionedPlanId(text);
  if (named && !isPublicPlanId(named)) {
    return {
      intent: "refused_private_plan",
      plan: null,
      checkout_url: null,
      verify_url: null,
      reply:
        "That plan is not a public offer. Public checkout stays on the catalogue confirm page.",
    };
  }

  const publicNamed = named && isPublicPlanId(named) ? named : null;
  if (PURCHASE.test(text) || publicNamed) {
    return publicSalesCheckout(publicNamed ?? "dpp_readiness");
  }

  if (VERIFY.test(text)) {
    const id = recordId(text);
    const verify = id
      ? `https://authichain.com/api/verify?id=${encodeURIComponent(id)}`
      : "https://authichain.com/api/verify";
    return {
      intent: "verify",
      plan: null,
      checkout_url: null,
      verify_url: verify,
      reply: `Open verification reads the public verifier. This reply is not a verdict. ${verify}`,
    };
  }

  const url = withUtm("dpp_readiness");
  return {
    intent: "info",
    plan: "dpp_readiness",
    checkout_url: url,
    verify_url: null,
    reply: `Battery passport readiness uses the EU DPP workspace checkout. It is not an audit, a certification, or legal advice. Offer page: https://authichain.com/battery-passport Checkout: ${url}`,
  };
}

export function salesTextFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.prompt === "string") return record.prompt;
  if (!Array.isArray(record.messages)) return null;
  const parts = record.messages.map((message) => {
    if (!message || typeof message !== "object") return "";
    const row = message as Record<string, unknown>;
    if (typeof row.content === "string") return row.content;
    if (typeof row.text === "string") return row.text;
    return "";
  });
  const joined = parts.join("\n").trim();
  return joined.length > 0 ? joined : null;
}
