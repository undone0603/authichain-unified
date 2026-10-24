#!/usr/bin/env node
/**
 * One economic orchestration layer.
 *
 * Capabilities are replaceable functions. They are not agents and they do not
 * form a hierarchy. Commercial surfaces sell src/lib/plans.ts through
 * authichain-core. This file does not send mail, charge a card, or store a
 * revenue total.
 *
 * Run: node scripts/autonomy/orchestrate.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { highestValueBlock } from "../../src/lib/economic-authority.ts";
import { gatedCheckoutUrl, planUsd } from "../../src/lib/plans.ts";
import { buildSubstrate, findSubstrateErrors } from "./substrate.mjs";

export const FLYWHEEL = [
  "discovery",
  "trust",
  "transaction",
  "data",
  "intelligence",
  "automation",
  "lower_cost",
  "better_product",
  "more_trust",
  "more_transactions",
];

export const TRUST_DIMENSIONS = [
  "identity_confidence",
  "evidence_quality",
  "source_reliability",
  "attestation_validity",
  "history_consistency",
  "behavioral_anomaly",
  "temporal_consistency",
  "geographic_consistency",
  "counterfeit_risk",
  "data_freshness",
];

export const CAPABILITIES = [
  { id: "catalogue", input: "plan id", output: "price from plans.ts", status: "in_force" },
  { id: "authorize", input: "surface + action", output: "allow or deny", status: "in_force" },
  { id: "next_action", input: "evidence", output: "one ranked action", status: "in_force" },
  { id: "best_case", input: "goal + plans", output: "labeled simulation", status: "in_force" },
  { id: "freedom_ledger", input: "in-force automation", output: "time row or null minutes", status: "in_force" },
  { id: "kill", input: "loop observation", output: "keep or kill", status: "in_force" },
  { id: "why", input: "proposed work", output: "keep or drop", status: "in_force" },
  {
    id: "agentz",
    input: "one user-triggered browser task",
    output: "visible action or a handoff",
    status: "spec",
    source: "agentz_full_codex.html",
  },
];

/** One founder, one brain, many products, many capabilities, one ledger. */
export const SHAPE = {
  founder: 1,
  brain: "scripts/autonomy/orchestrate.mjs",
  products: "src/lib/plans.ts",
  agents: "capabilities",
  network: "authichain-core",
};

/**
 * AgentZ codex, compressed. The four layers and the V2 loop are inside one
 * capability. They are not extra bots. Desktop physics, minting, and $QRON
 * rewards are spec claims, not running products.
 */
export const AGENTZ = {
  status: "SPEC",
  layers: ["physics", "browser", "autonomy", "identity"],
  loop: ["observe", "plan", "act", "verify", "repair", "continue"],
  max_repair: 3,
  requires_user_trigger: true,
  visible: true,
};

export function placeAgentZ(request) {
  const type = request?.type;
  const base = { brain: SHAPE.brain, capability: "agentz", status: AGENTZ.status };
  if (type === "spawn_bot" || request?.separate_process === true) {
    return { ...base, allowed: false, interrupt: "L3", reason: "A new bot must be a capability of this brain" };
  }
  if (type === "background" || request?.user_trigger === false) {
    return { ...base, allowed: false, interrupt: "L4", reason: "No task without an OS-level trigger" };
  }
  if (type === "credential_read" || type === "mint" || type === "qron_reward" || type === "mode_auto") {
    return { ...base, allowed: false, interrupt: "L4", reason: type + " is outside the capability" };
  }
  if (type === "send" || type === "purchase" || type === "delete" || type === "deploy") {
    return { ...base, allowed: false, interrupt: "L3", reason: "Irreversible browser action waits for the founder" };
  }
  if (type === "repair" && Number(request?.cycle) > AGENTZ.max_repair) {
    return { ...base, allowed: false, interrupt: "L2", reason: "Repair cap reached" };
  }
  if (type === "cross_site" || type === "captcha") {
    return { ...base, allowed: false, interrupt: "L2", reason: "User confirms before the capability continues" };
  }
  if (AGENTZ.loop.includes(type) && request?.user_trigger === true) {
    return { ...base, allowed: true, interrupt: "L0", reason: "One visible step inside the existing capability" };
  }
  return { ...base, allowed: false, interrupt: "L3", reason: "Unknown AgentZ request" };
}

const WHY_KEYS = [
  "revenue",
  "cost",
  "customer_value",
  "defensibility",
  "network",
  "automation",
  "risk",
  "infrastructure",
];

export function annualizedHours(savedMinPerWeek) {
  return Math.round((savedMinPerWeek * 52 / 60) * 10) / 10;
}

export function freedomEntry(input) {
  const before = input.before_min_per_week;
  const after = input.after_min_per_week;
  if (before == null || after == null) {
    if (input.saved_min_per_week != null || input.annualized_hours != null) {
      throw new Error("unmeasured row cannot claim saved time");
    }
    return {
      ...input,
      before_min_per_week: null,
      after_min_per_week: null,
      saved_min_per_week: null,
      annualized_hours: null,
      revenue_impact_usd: input.revenue_impact_usd ?? null,
    };
  }
  if (typeof before !== "number" || typeof after !== "number" || after > before) {
    throw new Error("founder minutes must be numbers and after must not exceed before");
  }
  if (!input.measurement) throw new Error("measured minutes need a measurement note");
  const saved = before - after;
  return {
    ...input,
    saved_min_per_week: saved,
    annualized_hours: annualizedHours(saved),
    revenue_impact_usd: input.revenue_impact_usd ?? null,
  };
}

export function validateLedger(ledger) {
  const errors = [];
  const ids = new Set();
  for (const entry of ledger.entries ?? []) {
    if (ids.has(entry.id)) errors.push("duplicate freedom row " + entry.id);
    ids.add(entry.id);
    if (!entry.evidence) errors.push(entry.id + " has no evidence");
    if (entry.status !== "autonomous" && entry.status !== "review") {
      errors.push(entry.id + " has no status");
    }
    if (entry.status === "autonomous") {
      for (const key of [
        "action_id",
        "timestamp",
        "agent",
        "capability",
        "authorization_source",
        "risk_level",
        "cost",
        "revenue_attributed",
        "customer_outcome",
        "founder_attention_required",
        "result",
      ]) {
        if (!(key in entry)) errors.push(entry.id + " autonomous row missing " + key);
      }
      if (typeof entry.founder_attention_required !== "boolean") {
        errors.push(entry.id + " founder_attention_required must be boolean");
      }
      if (typeof entry.result !== "string" || !entry.result) {
        errors.push(entry.id + " result must say what happened");
      }
      if (entry.revenue_attributed != null) {
        errors.push(entry.id + " attributes revenue without a verified Stripe pull");
      }
    }
    const unmeasured = entry.before_min_per_week == null || entry.after_min_per_week == null;
    if (unmeasured && (entry.saved_min_per_week != null || entry.annualized_hours != null)) {
      errors.push(entry.id + " claims time it did not measure");
    }
    if (!unmeasured) {
      const saved = entry.before_min_per_week - entry.after_min_per_week;
      if (entry.saved_min_per_week !== saved) errors.push(entry.id + " saved minutes do not match");
      if (entry.annualized_hours !== annualizedHours(saved)) errors.push(entry.id + " annualized hours do not match");
      if (!entry.measurement) errors.push(entry.id + " measured row lacks a measurement note");
    }
  }
  return errors;
}

export function why(work) {
  const hits = WHY_KEYS.filter(key => work?.[key] === true);
  return { keep: hits.length > 0, hits };
}

export function kill(loop, observed) {
  const fired = observed.sessions >= loop.sessions && observed.paid <= loop.kill_paid;
  return {
    kill: fired,
    reason: fired
      ? loop.id + " hit " + loop.sessions + " observations with paid <= " + loop.kill_paid
      : "threshold not reached",
  };
}

export function books(entry) {
  const book = entry.book === "experimental" ? "experimental" : "operating";
  if (book === "experimental" && entry.counts_as_revenue) {
    return { ok: false, book, reason: "experimental output is not operating revenue" };
  }
  return { ok: true, book };
}

export function trustReport(evidence = {}) {
  return {
    single_score: null,
    dimensions: TRUST_DIMENSIONS.map(id => ({
      id,
      value: evidence[id] ?? null,
    })),
  };
}

export function customerNode() {
  return {
    kind: "customer_node",
    pii_stored_here: false,
    permission: "explicit",
    produces: ["attestation", "verification_event", "referral"],
  };
}

export function flywheelCredit(event) {
  if (event === "payment_succeeded") return ["trust", "transaction", "data", "automation"];
  if (event === "verification") return ["trust", "data", "more_trust"];
  return [];
}

export function simulate(goal, plans) {
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const rows = [];
  for (const loop of goal.loops) {
    const plan = byId.get(loop.plan_id);
    if (!plan) throw new Error("goal loop missing plan " + loop.plan_id);
    const paid = loop.sessions * loop.cvr;
    rows.push({
      id: loop.id,
      plan_id: plan.id,
      price_usd: plan.price,
      price_source: "src/lib/plans.ts",
      sessions: loop.sessions,
      cvr: loop.cvr,
      paid_count: paid,
      cash_usd: paid * plan.price,
      label: "SIMULATION",
    });
  }
  return {
    label: "SIMULATION",
    not_revenue: true,
    rows,
    cash_usd: rows.reduce((sum, row) => sum + row.cash_usd, 0),
  };
}

export function assumptionsFresh(goal, now) {
  return String(now) <= goal.assumptions_expire;
}

function serviceCatalog(plans, publicPlanIds) {
  const ids = new Set(publicPlanIds);
  return plans
    .filter(plan => ids.has(plan.id))
    .map(plan => ({
      id: plan.id,
      price_usd: plan.price,
      price_source: "src/lib/plans.ts",
      endpoint: "/checkout/" + plan.id,
      primitive: "attestation",
      status: plan.id === "free" ? "free_tier" : "sell_today",
      cost_usd: null,
      margin_usd: null,
    }));
}

export function nextAction(input) {
  const { goal, plans, evidence, publicPlanIds } = input;
  const catalog = serviceCatalog(plans, publicPlanIds);
  const simulation = simulate(goal, plans);
  const dpp = simulation.rows.find(row => row.plan_id === "dpp_readiness");
  const fresh = assumptionsFresh(goal, evidence.now);
  const mode = evidence.mode ?? goal.mode;

  if (!fresh) {
    const block = highestValueBlock(evidence.now, goal.assumptions_expire);
    return {
      action: {
        id: block.action_id,
        interrupt: block.priority,
        priority: block.priority,
        status: block.status,
        blocking_requirement: block.blocking_requirement,
        executable: false,
        blocked_on: block.blocking_requirement,
        mode: "boring",
        why: { revenue: true, risk: true },
      },
      catalog,
      simulation,
      fresh,
    };
  }
  const candidates = [];
  const sellBlock = highestValueBlock(evidence.now, goal.assumptions_expire);
  candidates.push({
    id: "offer_dpp_openclaw",
    interrupt: "L2",
    priority: "L2",
    status: "READY",
    blocking_requirement: null,
    executable: true,
    blocked_on: null,
    mode: "boring",
    plan_id: "dpp_readiness",
    channel: "openclaw_inbound",
    sends_mail: false,
    opens_checkout_session: false,
    checkout_url: gatedCheckoutUrl("dpp_readiness"),
    price_usd: planUsd("dpp_readiness"),
    why: { revenue: true, customer_value: true },
  });
  candidates.push({
    id: "sell_existing_dpp",
    interrupt: sellBlock.priority,
    priority: sellBlock.priority,
    status: evidence.named_inbox ? "CANDIDATE" : "BLOCKED",
    blocking_requirement: evidence.named_inbox
      ? "explicit send approval; no mail sent"
      : sellBlock.blocking_requirement,
    executable: false,
    blocked_on: evidence.named_inbox
      ? "explicit send approval; no mail sent"
      : sellBlock.blocking_requirement,
    mode: "boring",
    plan_id: "dpp_readiness",
    candidate: evidence.named_inbox ?? null,
    simulation_cash_usd: dpp?.cash_usd ?? null,
    why: { revenue: true, customer_value: true, network: true },
  });
  candidates.push({
    id: "classify_live_revenue",
    interrupt: "L1",
    priority: "L1",
    status: evidence.revenue_status === "VERIFIED_REVENUE" ? "READY" : "BLOCKED",
    blocking_requirement: evidence.revenue_status === "VERIFIED_REVENUE" ? null : "fresh Stripe evidence",
    executable: evidence.revenue_status === "VERIFIED_REVENUE",
    blocked_on: evidence.revenue_status === "VERIFIED_REVENUE" ? null : "fresh Stripe evidence",
    mode: "boring",
    why: { revenue: true },
  });
  candidates.push({
    id: "moonshot_si",
    interrupt: "L3",
    executable: false,
    blocked_on: "founder opens moonshot mode",
    mode: "moonshot",
    why: { infrastructure: true },
  });

  const kept = candidates.filter(item => why(item.why).keep && (mode === "moonshot" || item.mode !== "moonshot"));
  const ranked = kept.sort((a, b) => {
    if (a.executable !== b.executable) return a.executable ? -1 : 1;
    return (b.simulation_cash_usd ?? 0) - (a.simulation_cash_usd ?? 0);
  });
  return { action: ranked[0], withheld: ranked.slice(1), catalog, simulation, fresh };
}

export function assess(input, evidence) {
  const substrate = buildSubstrate(input);
  const substrateErrors = findSubstrateErrors(substrate, input);
  const ledgerErrors = validateLedger(input.ledger);
  const hierarchy = CAPABILITIES.some(item => item.children);
  const system = [
    { id: "founder_only", ok: input.founderBusiness?.mode === "founder-only" },
    { id: "one_ledger", ok: input.goal?.ledger === "authichain-core" },
    { id: "boring_mode", ok: (evidence.mode ?? input.goal?.mode) === "boring" || evidence.mode === "moonshot" },
    { id: "substrate_coherent", ok: substrateErrors.length === 0 },
    { id: "flat_capabilities", ok: !hierarchy && CAPABILITIES.length > 0 },
    { id: "freedom_ledger", ok: ledgerErrors.length === 0 },
  ];
  if ((evidence.mode ?? input.goal?.mode) === "boring") {
    const boring = system.find(item => item.id === "boring_mode");
    boring.ok = true;
  }
  const economic = [
    { id: "qualifying_revenue", ok: evidence.qualifying === true, class: "EXTERNAL" },
    { id: "dpp_retained", ok: evidence.dppRetained === true, class: "EXTERNAL" },
  ];
  const ranked = nextAction({ ...input, evidence });
  const systemReached = system.every(item => item.ok);
  const reached = systemReached && economic.every(item => item.ok);
  return {
    reached,
    system_reached: systemReached,
    system,
    economic,
    substrate_errors: substrateErrors,
    ledger_errors: ledgerErrors,
    next_action: ranked.action,
    withheld_actions: ranked.withheld,
    simulation: ranked.simulation,
    catalog: ranked.catalog,
    customer: customerNode(),
    trust: trustReport(),
    flywheel: FLYWHEEL,
    shape: SHAPE,
  };
}

export function iterate(previous, input, evidence) {
  const report = assess(input, evidence);
  const signature = JSON.stringify({
    system: report.system,
    economic: report.economic,
    action: report.next_action?.id ?? null,
  });
  const progressed = !previous || previous.signature !== signature;
  const blocked = !report.reached && report.next_action && report.next_action.executable === false;
  return {
    revision: (previous?.revision ?? 0) + 1,
    signature,
    report,
    progressed,
    blocked,
    stop: report.reached || blocked || !progressed,
  };
}

function loadInput(root) {
  const founderBusiness = JSON.parse(readFileSync(resolve(root, ".github/founder-business.json"), "utf8"));
  const autonomy = JSON.parse(readFileSync(resolve(root, ".github/autonomy.json"), "utf8"));
  const goal = JSON.parse(readFileSync(resolve(root, "docs/operations/best-case-goal.json"), "utf8"));
  const ledger = JSON.parse(readFileSync(resolve(root, "docs/operations/founder-freedom-ledger.json"), "utf8"));
  return { founderBusiness, autonomy, goal, ledger };
}

export async function run(root, evidence, { save = false } = {}) {
  const loaded = loadInput(root);
  const { PLANS, PUBLIC_PLAN_IDS, PLAN_ALIASES } = await import(
    pathToFileURL(resolve(root, "src/lib/plans.ts")).href
  );
  const input = {
    ...loaded,
    plans: PLANS,
    publicPlanIds: PUBLIC_PLAN_IDS,
    aliases: PLAN_ALIASES,
  };
  let state = null;
  for (let i = 0; i < 8; i += 1) {
    const next = iterate(state, input, evidence);
    state = next;
    if (next.stop) break;
  }
  const body = {
    goal_id: loaded.goal.id,
    label: "SIMULATION",
    reached: state.report.reached,
    system_reached: state.report.system_reached,
    revision: state.revision,
    stop: state.report.reached ? "reached" : "external_gate",
    open: state.report.economic.filter(item => !item.ok).map(item => item.id),
    next_action: state.report.next_action,
    simulation: state.report.simulation,
    freedom_rows: loaded.ledger.entries.length,
    freedom_measured_rows: loaded.ledger.entries.filter(entry => entry.saved_min_per_week != null).length,
  };
  if (save) {
    writeFileSync(
      resolve(root, "docs/operations/best-case-status.json"),
      JSON.stringify(body, null, 2) + "\n"
    );
  }
  return body;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = {
    qualifying: false,
    dppRetained: false,
    now: new Date().toISOString().slice(0, 10),
    mode: "boring",
    snapshot: false,
  };
  const body = await run(process.cwd(), evidence, { save: process.argv.includes("--save") });
  console.log(JSON.stringify(body, null, 2));
  if (!body.system_reached) process.exit(1);
}
