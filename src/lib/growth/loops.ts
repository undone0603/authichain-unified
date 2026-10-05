/**
 * First-dollar growth loops — 2026-09-28.
 * Public SKUs must stay inside PUBLIC_PLAN_IDS from src/lib/plans.ts.
 * Do not market First Dollar $1 or AuthiChain Seal $99/mo.
 */

export type GrowthLoopId = "loop_03_qron_starter" | "loop_02_dpp_check" | "loop_01_passport_scan";

export type GrowthEvent =
  | "generate_view"
  | "generate_submit_anon"
  | "free_gen_granted"
  | "free_gen_exhausted"
  | "checkout_starter_view"
  | "checkout_email_captured"
  | "checkout_session_started"
  | "checkout_abandoned"
  | "purchase_starter_succeeded"
  | "dpp_check_view"
  | "dpp_check_completed"
  | "dpp_check_email_captured"
  | "checkout_dpp_view"
  | "purchase_dpp_succeeded"
  | "genetics_view"
  | "passport_qr_scan"
  | "checkout_passport_view"
  | "purchase_passport_succeeded";

export interface GrowthLoop {
  id: GrowthLoopId;
  name: string;
  sku: "starter" | "dpp_readiness" | "strainchain_passport";
  primaryCta: string;
  trigger: string;
  mechanism: string;
  /** Labelled estimates only. No live stranger conversion exists as of 2026-09-28. */
  estimatedCvr: string;
  events: GrowthEvent[];
  killIf: string;
  liveSurfaces: string[];
}

export const GROWTH_LOOPS: GrowthLoop[] = [
  {
    id: "loop_03_qron_starter",
    name: "QRON generate → Starter $29",
    sku: "starter",
    primaryCta: "https://authichain.com/checkout/starter",
    trigger: "Anonymous visitor hits qron.space/generate or authichain.com/generate.",
    mechanism:
      "Generation requires a signed-in account with credits. Unauthenticated submissions are counted and routed to Starter Pack checkout ($29 for 100 one-time generations). Work email is required before Stripe session creation.",
    estimatedCvr: "baseline not established: generate_view → checkout_session_started → purchase_starter_succeeded",
    events: [
      "generate_view",
      "generate_submit_anon",
      "checkout_starter_view",
      "checkout_email_captured",
      "checkout_session_started",
      "checkout_abandoned",
      "purchase_starter_succeeded",
    ],
    killIf:
      "14 days after event wiring: 0 purchase_starter_succeeded from a non-founder email AND generate_view ≥ 200.",
    liveSurfaces: ["https://qron.space/generate", "https://qron.space/pricing", "https://authichain.com/checkout/starter"],
  },
  {
    id: "loop_02_dpp_check",
    name: "DPP-check magnet → $299",
    sku: "dpp_readiness",
    primaryCta: "https://authichain.com/checkout/dpp_readiness",
    trigger: "Organic /p/{dpp-slug} or /docs/dpp-architecture visitor opens /dpp-check.",
    mechanism:
      "Free gap map. After score, offer written assessment + 50 generations for $299. Does not claim EU registry filing, notified-body status, or GS1 Conformant Resolver.",
    estimatedCvr: "estimate: 0.5–2% dpp_check_completed → purchase_dpp_succeeded",
    events: [
      "dpp_check_view",
      "dpp_check_completed",
      "dpp_check_email_captured",
      "checkout_dpp_view",
      "checkout_abandoned",
      "purchase_dpp_succeeded",
    ],
    killIf:
      "30 days after event wiring: 0 purchase_dpp_succeeded from a non-founder email AND dpp_check_completed ≥ 80.",
    liveSurfaces: ["https://authichain.com/dpp-check", "https://authichain.com/docs/dpp-architecture", "https://authichain.com/checkout/dpp_readiness"],
  },
  {
    id: "loop_01_passport_scan",
    name: "Genetics QR → Passport $49",
    sku: "strainchain_passport",
    primaryCta: "https://authichain.com/checkout/strainchain_passport",
    trigger: "Public genetics page or package QR lands on strainchain.io/genetics/{farm}/{cultivar}.",
    mechanism:
      "Page shows recomputed CoA totals already on file. CTA publishes the visitor's cultivar for $49. Never claim METRC live, never claim on-chain COA hash is live, never treat a scan as a potency guarantee.",
    estimatedCvr: "estimate: 1–4% genetics_view → purchase_passport_succeeded",
    events: [
      "genetics_view",
      "passport_qr_scan",
      "checkout_passport_view",
      "checkout_email_captured",
      "checkout_abandoned",
      "purchase_passport_succeeded",
    ],
    killIf:
      "30 days after event wiring: 0 purchase_passport_succeeded from a non-founder email AND genetics_view ≥ 150.",
    liveSurfaces: [
      "https://authichain.com/passport",
      "https://strainchain.io/onboard",
      "https://authichain.com/checkout/strainchain_passport",
    ],
  },
];

export const FIRST_HUMAN_SKU = "starter" as const;

export function loopBySku(sku: GrowthLoop["sku"]): GrowthLoop | undefined {
  return GROWTH_LOOPS.find(l => l.sku === sku);
}
