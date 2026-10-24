/**
 * One resolver for public commerce, revenue evidence, and AgentZ execution.
 *
 * Precedence, highest first:
 *   docs/OPERATING_CHARTER.md
 *   .github/autonomy.json
 *   classifyRevenue
 *   src/lib/plans.ts PUBLIC_PLAN_IDS
 *   docs/ECONOMIC_CONSTITUTION_AND_AGENT_OS.md
 *   .github/founder-business.json
 *
 * The constitution and founder-business file do not override the first four.
 * This module does not charge, send mail, or invent a Stripe result.
 */
import { QRON_ERC20, TOKENOMICS_PAY_TO } from "../../scripts/lib/evm-chains.ts";
import {
  PLAN_ALIASES,
  PLANS,
  PUBLIC_PLAN_IDS,
  type PlanId,
} from "./plans.ts";

export const AUTHORITY_ORDER = [
  "docs/OPERATING_CHARTER.md",
  ".github/autonomy.json",
  "classifyRevenue",
  "src/lib/plans.ts::PUBLIC_PLAN_IDS",
  "docs/ECONOMIC_CONSTITUTION_AND_AGENT_OS.md",
  ".github/founder-business.json",
] as const;

/**
 * Exact founder inboxes, plus "@domain" entries that cover every alias on an
 * owned domain (same contract as scripts/autonomy/revenue-watch.mjs isFounder
 * and .github/autonomy.json founder_emails).
 */
export const DEFAULT_FOUNDER_EMAILS = [
  "undone.k@gmail.com",
  "authichain@gmail.com",
  "@authichain.com",
] as const;

/** Fresh Stripe pull window. Older evidence is REVENUE_DATA_STALE. */
export const REVENUE_FRESH_MS = 24 * 60 * 60 * 1000;

export const X402_TREASURY = TOKENOMICS_PAY_TO;
export const X402_QRON_TOKEN = QRON_ERC20;
export const X402_STATUS_NOT_READY = "HEALTHY_BUT_NOT_SETTLEMENT_READY" as const;

const PUBLIC_SET = new Set<string>(PUBLIC_PLAN_IDS);
const INTERNAL_PLAN_IDS = new Set<string>([
  "strainchain_farm",
  "theater_1",
  "theater_3",
]);

const SURFACE_OFFERS: Record<string, readonly string[]> = {
  authichain: [
    "dpp_readiness",
    "made_in_usa_claim_file",
    "made_in_usa_audit_bundle",
  ],
  qron: ["free", "qron_launch", "starter", "creator"],
  strainchain: ["strainchain_passport"],
  govchain: [],
  agentz: [],
};

export type CommerceVisibility = "public" | "internal" | "absent";

export type CommerceDecision = {
  query: string;
  plan_id: string | null;
  visibility: CommerceVisibility;
  publicly_sellable: boolean;
  alias: boolean;
  surfaces: string[];
};

export type RevenueStatus =
  | "VERIFIED_REVENUE"
  | "NO_QUALIFYING_REVENUE"
  | "REVENUE_UNVERIFIED"
  | "REVENUE_DATA_STALE";

export type RevenueVerdict = {
  qualifying: boolean;
  status: RevenueStatus;
  reason: string;
};

export type StripeRevenueObject = {
  id: string;
  object: "charge" | "subscription" | "payout";
  livemode: boolean;
  amount?: number;
  paid?: boolean;
  status?: string | null;
  customer_email?: string | null;
};

export type StripeRevenueEvidence = {
  source: "stripe_api";
  fetched_at: string;
  objects: StripeRevenueObject[];
};

const freshEvidence = new WeakSet<object>();

const ACTIVE = new Set(["active", "trialing", "past_due"]);
const PAID_OUT = new Set(["paid", "in_transit", "pending"]);

export function publicOfferIds(): readonly string[] {
  return PUBLIC_PLAN_IDS;
}

export function surfaceOffers(surface: string): readonly string[] {
  return SURFACE_OFFERS[surface] ?? [];
}

export function resolveCommerce(raw: string): CommerceDecision {
  const query = (raw || "").trim().toLowerCase();
  const aliasTarget = PLAN_ALIASES[query];
  const planId = aliasTarget ?? (PLANS.some(plan => plan.id === query) ? query : null);
  if (!planId) {
    return {
      query,
      plan_id: null,
      visibility: "absent",
      publicly_sellable: false,
      alias: false,
      surfaces: [],
    };
  }
  const visibility: CommerceVisibility = PUBLIC_SET.has(planId)
    ? "public"
    : INTERNAL_PLAN_IDS.has(planId)
      ? "internal"
      : "absent";
  const surfaces = Object.entries(SURFACE_OFFERS)
    .filter(([, ids]) => ids.includes(planId))
    .map(([surface]) => surface);
  return {
    query,
    plan_id: planId,
    visibility,
    publicly_sellable: visibility === "public",
    alias: Boolean(aliasTarget),
    surfaces,
  };
}

export function founderBusinessCannotOverride(topic: string): {
  allowed: false;
  winner: string;
  reason: string;
} {
  return {
    allowed: false,
    winner: AUTHORITY_ORDER[0],
    reason:
      topic +
      " stays with the charter, autonomy.json, classifyRevenue, or PUBLIC_PLAN_IDS",
  };
}

/** SI chooses the next input. It does not send, charge, deploy, or start a second brain. */
export const SI = {
  id: "si",
  permissions: [] as const,
  may_send: false,
  may_charge: false,
  may_deploy: false,
  may_set_agentz_auto: false,
} as const;

export type SplitAnswer = {
  brain: string;
  value: unknown;
};

export type SplitBrain = {
  question: string;
  split: boolean;
  canonical_brain: string | null;
  canonical: unknown;
  brains: SplitAnswer[];
  si: typeof SI;
};

/** Two brains, one question. The first answer is canonical. A disagreement is a split. */
export function generateSplitBrain(question: string, answers: SplitAnswer[]): SplitBrain {
  const canonical = answers[0] ?? null;
  const split = answers.some(
    answer => JSON.stringify(answer.value) !== JSON.stringify(canonical?.value)
  );
  return {
    question,
    split,
    canonical_brain: canonical?.brain ?? null,
    canonical: canonical?.value ?? null,
    brains: answers,
    si: SI,
  };
}

export function agentzAutoSplit(callerAllowsAuto: boolean): SplitBrain {
  return generateSplitBrain("agentz_auto", [
    {
      brain: "src/lib/economic-authority.ts",
      value: agentzExecutionPolicy("auto").allowed,
    },
    { brain: "caller", value: callerAllowsAuto },
  ]);
}

export function agentzExecutionPolicy(mode: string): {
  mode: string;
  allowed: boolean;
  reason: string;
  class: "FROZEN" | "AUTOMATIC";
  authorization_source: "src/lib/economic-authority.ts#agentzExecutionPolicy";
} {
  const normalized = (mode || "").trim().toLowerCase().replace(/_/g, "-");
  const source = "src/lib/economic-authority.ts#agentzExecutionPolicy" as const;
  if (normalized === "auto") {
    return {
      mode: "auto",
      allowed: false,
      reason: "AgentZ --mode auto is frozen",
      class: "FROZEN",
      authorization_source: source,
    };
  }
  if (normalized === "confirm" || normalized === "dry-run") {
    return {
      mode: normalized,
      allowed: true,
      reason: "AgentZ mode " + normalized,
      class: "AUTOMATIC",
      authorization_source: source,
    };
  }
  return {
    mode: normalized || "unknown",
    allowed: false,
    reason: "unknown AgentZ mode",
    class: "FROZEN",
    authorization_source: source,
  };
}

export function x402Identity(): {
  treasury: string;
  qron_token: string;
  settlement_status: typeof X402_STATUS_NOT_READY;
  settled: false;
} {
  return {
    treasury: X402_TREASURY,
    qron_token: X402_QRON_TOKEN,
    settlement_status: X402_STATUS_NOT_READY,
    settled: false,
  };
}

export function isFounderEmail(
  email: string | null | undefined,
  founderEmails: readonly string[] = DEFAULT_FOUNDER_EMAILS
): boolean {
  if (!email) return false;
  const needle = email.trim().toLowerCase();
  if (!needle) return false;
  if (founderEmails.some(item => item.trim().toLowerCase() === needle)) {
    return true;
  }
  const at = needle.lastIndexOf("@");
  if (at < 0) return false;
  const domainEntry = needle.slice(at);
  return founderEmails.some(
    item => item.trim().toLowerCase() === domainEntry
  );
}

function strangerEmail(
  email: string | null | undefined,
  founderEmails: readonly string[]
): boolean {
  if (!email || !email.trim()) return false;
  return !isFounderEmail(email, founderEmails);
}

/**
 * Mark evidence that this process just read from Stripe object fields.
 * A parsed snapshot is not in this set, even if it claims livemode.
 */
export function sealStripeEvidence(
  objects: StripeRevenueObject[],
  fetchedAt = new Date().toISOString()
): StripeRevenueEvidence {
  const evidence: StripeRevenueEvidence = {
    source: "stripe_api",
    fetched_at: fetchedAt,
    objects,
  };
  freshEvidence.add(evidence);
  return evidence;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function emailOf(record: Record<string, unknown>): string | null {
  const billing = asRecord(record.billing_details) ?? asRecord(record.billingDetails);
  for (const value of [
    record.customer_email,
    record.customerEmail,
    record.receipt_email,
    record.receiptEmail,
    record.email,
    billing?.email,
  ]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Copy livemode only from the Stripe object's own boolean. Missing is false. */
export function stripeObjectFromApi(record: Record<string, unknown>, index: number): StripeRevenueObject | null {
  const kind = record.object;
  const object =
    kind === "charge" || kind === "subscription" || kind === "payout"
      ? kind
      : record.paid === true || typeof record.amount === "number"
        ? "charge"
        : record.status && (record.customer || record.customer_email || record.customerEmail)
          ? "subscription"
          : null;
  if (!object) return null;
  const id = typeof record.id === "string" ? record.id : object + "_" + index;
  return {
    id,
    object,
    livemode: record.livemode === true,
    amount: typeof record.amount === "number" ? record.amount : undefined,
    paid: record.paid === true,
    status: typeof record.status === "string" ? record.status : null,
    customer_email: emailOf(record),
  };
}

export function sealStripeApiPayload(
  payload: { charges?: unknown[]; subscriptions?: unknown[]; payouts?: unknown[] },
  fetchedAt = new Date().toISOString()
): StripeRevenueEvidence {
  const objects: StripeRevenueObject[] = [];
  const groups: Array<[string, unknown[] | undefined]> = [
    ["charge", payload.charges],
    ["subscription", payload.subscriptions],
    ["payout", payload.payouts],
  ];
  for (const [fallback, list] of groups) {
    for (const [index, item] of (list ?? []).entries()) {
      const record = asRecord(item);
      if (!record) continue;
      const mapped = stripeObjectFromApi(
        record.object ? record : { ...record, object: fallback },
        index
      );
      if (mapped) objects.push(mapped);
    }
  }
  return sealStripeEvidence(objects, fetchedAt);
}

function qualifies(object: StripeRevenueObject, founderEmails: readonly string[]): boolean {
  if (object.livemode !== true) return false;
  if (!strangerEmail(object.customer_email, founderEmails)) return false;
  if (object.object === "subscription") {
    return ACTIVE.has((object.status ?? "").toLowerCase());
  }
  if (object.object === "charge") {
    return object.paid === true && (object.amount ?? 0) > 0;
  }
  return false;
}

export function classifyRevenue(
  input: unknown,
  founderEmails: readonly string[] = DEFAULT_FOUNDER_EMAILS,
  now = Date.now()
): RevenueVerdict {
  if (!input || typeof input !== "object" || !freshEvidence.has(input)) {
    return {
      qualifying: false,
      status: "REVENUE_UNVERIFIED",
      reason: "Stripe evidence was not freshly obtained",
    };
  }
  const evidence = input as StripeRevenueEvidence;
  if (evidence.source !== "stripe_api" || typeof evidence.fetched_at !== "string") {
    return {
      qualifying: false,
      status: "REVENUE_UNVERIFIED",
      reason: "Stripe evidence was not freshly obtained",
    };
  }
  const fetched = Date.parse(evidence.fetched_at);
  if (!Number.isFinite(fetched) || fetched > now + 120_000) {
    return {
      qualifying: false,
      status: "REVENUE_UNVERIFIED",
      reason: "Stripe fetched_at is missing or not a real pull time",
    };
  }
  if (now - fetched > REVENUE_FRESH_MS) {
    return {
      qualifying: false,
      status: "REVENUE_DATA_STALE",
      reason: "Stripe evidence is older than 24 hours",
    };
  }
  const objects = Array.isArray(evidence.objects) ? evidence.objects : [];
  const sale = objects.find(object => qualifies(object, founderEmails));
  if (sale) {
    return {
      qualifying: true,
      status: "VERIFIED_REVENUE",
      reason: sale.object + " " + sale.id + " livemode non-founder paid with email",
    };
  }
  const payout = objects.find(
    object =>
      object.object === "payout" &&
      object.livemode === true &&
      (object.amount ?? 0) > 0 &&
      PAID_OUT.has((object.status ?? "paid").toLowerCase())
  );
  if (payout) {
    return {
      qualifying: false,
      status: "NO_QUALIFYING_REVENUE",
      reason: "payout " + payout.id + " has no livemode non-founder paid charge",
    };
  }
  return {
    qualifying: false,
    status: "NO_QUALIFYING_REVENUE",
    reason: "fresh Stripe pull has no livemode non-founder paid activity with an email",
  };
}

export function highestValueBlock(nowIso: string, assumptionsExpire: string): {
  action_id: string;
  priority: "L2" | "L1";
  status: "BLOCKED";
  blocking_requirement: string;
  executable: false;
} {
  if (String(nowIso) > assumptionsExpire) {
    return {
      action_id: "revalidate_cvr",
      priority: "L1",
      status: "BLOCKED",
      blocking_requirement: "measured conversion, not another guess",
      executable: false,
    };
  }
  return {
    action_id: "sell_existing_dpp",
    priority: "L2",
    status: "BLOCKED",
    blocking_requirement: "verified_inbox",
    executable: false,
  };
}

export type PlanIdRef = PlanId;
