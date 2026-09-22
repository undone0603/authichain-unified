/**
 * Classify livemode cash and gate AuthiChain outreach.
 * A founder charge or an empty list is not recurring revenue.
 * This module never sends mail and never creates a Stripe session.
 */

import { planPaymentLink } from "../src/lib/plans";

export const DEFAULT_FOUNDER_EMAILS = [
  "undone.k@gmail.com",
  "authichain@gmail.com",
] as const;

export const FROZEN_DISPATCH = [
  "b2b-outreach",
  "outreach-trigger",
  "dpp-outreach-trigger",
  "pipeline-tick",
  "gov-mint",
] as const;

export const FARM_HEAD_PATH = "/api/checkout/plan/strainchain_farm";
export const DEFAULT_ORIGIN = "https://authichain.com";

export type RevenueSubscription = {
  id: string;
  status?: string | null;
  customerEmail?: string | null;
};

export type RevenuePayout = {
  id: string;
  amount: number;
  status?: string | null;
};

export type RevenueCharge = {
  id: string;
  amount: number;
  paid: boolean;
  email?: string | null;
};

export type RevenueSnapshot = {
  subscriptions: RevenueSubscription[];
  payouts: RevenuePayout[];
  charges: RevenueCharge[];
};

export type RevenueVerdict = {
  qualifying: boolean;
  reason: string;
};

export type SendRequest = {
  namedInboxThisTurn: string | null | undefined;
  publishedByCompany: boolean;
  guessedAlias: boolean;
};

export type SendVerdict = {
  allowed: boolean;
  reason: string;
  to?: string;
};

export type RailsStep = {
  id: string;
  url: string;
  method: "GET" | "HEAD";
  accept: number[];
};

export type RailsResult = {
  id: string;
  url: string;
  method: "GET" | "HEAD";
  status: number;
  ok: boolean;
  detail?: string;
};

export type RailsReport = {
  ok: boolean;
  reason: string;
  results: RailsResult[];
};

export type OperatorAction =
  "fix_rails" | "qualifying" | "send_one" | "refuse_send" | "wait_buyer";

export type OperatorDecision = {
  action: OperatorAction;
  reason: string;
  to?: string;
  revenue: RevenueVerdict;
  send?: SendVerdict;
};

const ACTIVE = new Set(["active", "trialing", "past_due"]);
const PAID_OUT = new Set(["paid", "in_transit", "pending"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isFounderEmail(
  email: string | null | undefined,
  founderEmails: readonly string[] = DEFAULT_FOUNDER_EMAILS
): boolean {
  if (!email) return false;
  const needle = email.trim().toLowerCase();
  return founderEmails.some(item => item.trim().toLowerCase() === needle);
}

function isStrangerEmail(
  email: string | null | undefined,
  founderEmails: readonly string[]
): boolean {
  if (!email || !email.trim()) return false;
  return !isFounderEmail(email, founderEmails);
}

export function classifyRevenue(
  snapshot: RevenueSnapshot,
  founderEmails: readonly string[] = DEFAULT_FOUNDER_EMAILS
): RevenueVerdict {
  let sawAnonymous = false;
  for (const sub of snapshot.subscriptions) {
    if (!ACTIVE.has((sub.status ?? "active").toLowerCase())) continue;
    if (!sub.customerEmail) {
      sawAnonymous = true;
      continue;
    }
    if (!isFounderEmail(sub.customerEmail, founderEmails)) {
      return {
        qualifying: true,
        reason: `subscription ${sub.id} for ${sub.customerEmail}`,
      };
    }
  }

  const strangerPaid = snapshot.charges.some(
    charge => charge.paid && isStrangerEmail(charge.email, founderEmails)
  );
  let blockedPayout: string | null = null;
  for (const payout of snapshot.payouts) {
    if (!PAID_OUT.has((payout.status ?? "paid").toLowerCase())) continue;
    if (payout.amount <= 0) continue;
    if (strangerPaid) {
      return {
        qualifying: true,
        reason: `payout ${payout.id} with a non-founder paid charge`,
      };
    }
    blockedPayout = payout.id;
  }

  if (blockedPayout) {
    return {
      qualifying: false,
      reason: `payout ${blockedPayout} has no non-founder paid charge`,
    };
  }
  if (sawAnonymous) {
    return {
      qualifying: false,
      reason: "subscription has no customer email; not counted",
    };
  }
  return {
    qualifying: false,
    reason: "no non-founder subscription or payout",
  };
}

export function classifySend(
  req: SendRequest,
  founderEmails: readonly string[] = DEFAULT_FOUNDER_EMAILS
): SendVerdict {
  const to = (req.namedInboxThisTurn ?? "").trim().toLowerCase();
  if (!to) {
    return { allowed: false, reason: "no inbox named this turn" };
  }
  if (!EMAIL_RE.test(to)) {
    return { allowed: false, reason: "named inbox is not an email" };
  }
  if (isFounderEmail(to, founderEmails)) {
    return { allowed: false, reason: "founder inbox is not a prospect" };
  }
  if (req.guessedAlias) {
    return { allowed: false, reason: "guessed alias" };
  }
  if (!req.publishedByCompany) {
    return { allowed: false, reason: "inbox not published by the company" };
  }
  return { allowed: true, reason: `send to ${to}`, to };
}

export function farmRailsSteps(
  origin = DEFAULT_ORIGIN,
  paymentLink = planPaymentLink("strainchain_farm")
): RailsStep[] {
  const base = origin.replace(/\/+$/, "");
  const steps: RailsStep[] = [];
  if (paymentLink) {
    steps.push({
      id: "farm_payment_link",
      url: paymentLink,
      method: "GET",
      accept: [200],
    });
  }
  steps.push({
    id: "farm_head",
    url: `${base}${FARM_HEAD_PATH}`,
    method: "HEAD",
    accept: [204],
  });
  return steps;
}

export async function checkFarmRails(
  origin = DEFAULT_ORIGIN,
  fetchImpl: typeof fetch = fetch,
  paymentLink = planPaymentLink("strainchain_farm")
): Promise<RailsReport> {
  if (!paymentLink) {
    return {
      ok: false,
      reason: "no Farm Payment Link in plans.ts",
      results: [],
    };
  }
  const results: RailsResult[] = [];
  for (const step of farmRailsSteps(origin, paymentLink)) {
    try {
      const res = await fetchImpl(step.url, {
        method: step.method,
        redirect: "manual",
      });
      const ok = step.accept.includes(res.status);
      results.push({
        id: step.id,
        url: step.url,
        method: step.method,
        status: res.status,
        ok,
        detail: ok
          ? undefined
          : `expected ${step.accept.join("|")}, got ${res.status}`,
      });
    } catch (err) {
      results.push({
        id: step.id,
        url: step.url,
        method: step.method,
        status: 0,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const failed = results.filter(r => !r.ok);
  return {
    ok: failed.length === 0,
    reason:
      failed.length === 0
        ? "Farm Payment Link 200 and Farm HEAD 204"
        : failed.map(f => f.detail ?? f.id).join("; "),
    results,
  };
}

export function decideOperatorAction(input: {
  rails: { ok: boolean; reason: string };
  snapshot: RevenueSnapshot;
  founderEmails?: readonly string[];
  send?: SendRequest | null;
}): OperatorDecision {
  const founderEmails = input.founderEmails ?? DEFAULT_FOUNDER_EMAILS;
  const revenue = classifyRevenue(input.snapshot, founderEmails);
  if (!input.rails.ok) {
    return { action: "fix_rails", reason: input.rails.reason, revenue };
  }
  if (revenue.qualifying) {
    return { action: "qualifying", reason: revenue.reason, revenue };
  }
  if (input.send) {
    const send = classifySend(input.send, founderEmails);
    if (send.allowed && send.to) {
      return {
        action: "send_one",
        reason: send.reason,
        to: send.to,
        revenue,
        send,
      };
    }
    return { action: "refuse_send", reason: send.reason, revenue, send };
  }
  return { action: "wait_buyer", reason: revenue.reason, revenue };
}

export function mayDispatch(name: string): {
  allowed: boolean;
  reason: string;
} {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/\.yml$/, "");
  if ((FROZEN_DISPATCH as readonly string[]).includes(id)) {
    return { allowed: false, reason: `${id} is frozen` };
  }
  return { allowed: true, reason: `${id} is not on the freeze list` };
}

export function mayDisableOutreachApproval(value: string | boolean): {
  allowed: boolean;
  reason: string;
} {
  if (value === false || value === "false") {
    return {
      allowed: false,
      reason: "REQUIRE_OUTREACH_APPROVAL must stay true",
    };
  }
  return { allowed: true, reason: "approval remains required" };
}

export function mayRunAgentzAuto(mode: string): {
  allowed: boolean;
  reason: string;
} {
  if (mode.trim().toLowerCase() === "auto") {
    return { allowed: false, reason: "AgentZ --mode auto is frozen" };
  }
  return { allowed: true, reason: `AgentZ mode ${mode}` };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickEmail(...vals: unknown[]): string | null {
  for (const value of vals) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function snapshotFromStripeLike(input: unknown): RevenueSnapshot {
  const root = asRecord(input) ?? {};
  const subscriptions = listOf(root.subscriptions).map((item, index) => {
    const rec = asRecord(item) ?? {};
    return {
      id: typeof rec.id === "string" ? rec.id : `sub_${index}`,
      status: typeof rec.status === "string" ? rec.status : null,
      customerEmail: pickEmail(
        rec.customerEmail,
        rec.customer_email,
        rec.email
      ),
    };
  });
  const payouts = listOf(root.payouts).map((item, index) => {
    const rec = asRecord(item) ?? {};
    return {
      id: typeof rec.id === "string" ? rec.id : `po_${index}`,
      amount: typeof rec.amount === "number" ? rec.amount : 0,
      status: typeof rec.status === "string" ? rec.status : null,
    };
  });
  const charges = listOf(root.charges).map((item, index) => {
    const rec = asRecord(item) ?? {};
    const billing =
      asRecord(rec.billing_details) ?? asRecord(rec.billingDetails);
    return {
      id: typeof rec.id === "string" ? rec.id : `ch_${index}`,
      amount: typeof rec.amount === "number" ? rec.amount : 0,
      paid: rec.paid === true,
      email: pickEmail(
        rec.email,
        rec.receipt_email,
        rec.receiptEmail,
        billing?.email
      ),
    };
  });
  return { subscriptions, payouts, charges };
}

function flagValue(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const eq = argv.find(arg => arg.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const idx = argv.indexOf(name);
  const next = idx >= 0 ? argv[idx + 1] : undefined;
  if (next && !next.startsWith("-")) return next;
  return undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main(argv: string[]): Promise<number> {
  const cmd = argv[2] ?? "decide";
  if (cmd === "rails") {
    const report = await checkFarmRails();
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }

  const snapshotPath = flagValue(argv, "--snapshot");
  let raw: unknown = {};
  if (snapshotPath) {
    const { readFileSync } = await import("node:fs");
    raw = JSON.parse(readFileSync(snapshotPath, "utf8"));
  } else if ((cmd === "classify" || cmd === "decide") && !process.stdin.isTTY) {
    const { readFileSync } = await import("node:fs");
    const stdin = readFileSync(0, "utf8").trim();
    if (stdin) raw = JSON.parse(stdin);
  }
  const snapshot = snapshotFromStripeLike(raw);

  if (cmd === "classify") {
    const verdict = classifyRevenue(snapshot);
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.qualifying ? 0 : 1;
  }

  const sendRequested =
    cmd === "send" || hasFlag(argv, "--to") || Boolean(flagValue(argv, "--to"));
  const to = flagValue(argv, "--to") ?? null;
  const send: SendRequest | null = sendRequested
    ? {
        namedInboxThisTurn: hasFlag(argv, "--named-this-turn") ? to : null,
        publishedByCompany: hasFlag(argv, "--published"),
        guessedAlias: hasFlag(argv, "--guessed"),
      }
    : null;

  if (cmd === "send") {
    const verdict = classifySend({
      namedInboxThisTurn: hasFlag(argv, "--named-this-turn") ? to : null,
      publishedByCompany: hasFlag(argv, "--published"),
      guessedAlias: hasFlag(argv, "--guessed"),
    });
    console.log(JSON.stringify(verdict, null, 2));
    return verdict.allowed ? 0 : 2;
  }

  const rails =
    cmd === "decide" && hasFlag(argv, "--skip-rails")
      ? { ok: true, reason: "rails skipped" }
      : await checkFarmRails();
  const decision = decideOperatorAction({ rails, snapshot, send });
  console.log(JSON.stringify(decision, null, 2));
  if (decision.action === "qualifying" || decision.action === "send_one") {
    return 0;
  }
  if (decision.action === "refuse_send") return 2;
  return 1;
}

const entry = process.argv[1] ?? "";
if (/(^|[\\/])revenue-operator\.[cm]?[jt]s$/.test(entry)) {
  main(process.argv)
    .then(code => process.exit(code))
    .catch(err => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
