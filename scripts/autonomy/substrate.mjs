#!/usr/bin/env node
/**
 * Company substrate: knowledge graph + agent control plane + revenue flywheel.
 *
 * This is a projection of the existing control plane. It is not a second
 * orchestrator, price catalogue, or switchboard. FOUNDER_ONLY_BUSINESS.md
 * forbids those. Prices are read from src/lib/plans.ts at call time.
 * Switches are read from .github/autonomy.json. Money truth stays
 * classifyRevenue. DPP stage order stays src/lib/dpp-loop.ts DPP_LOOP_ORDER.
 *
 * Run: node scripts/autonomy/substrate.mjs
 * The founder-business pulse calls findSubstrateErrors and fails closed.
 */
import { readFileSync } from "node:fs";
import { agentzExecutionPolicy } from "../../src/lib/economic-authority.ts";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CORE_LEDGER = "authichain-core";

/** Must match src/lib/dpp-loop.ts DPP_LOOP_ORDER. The test pins that. */
export const DPP_LOOP_ORDER = [
  "attributed_visit",
  "checkout_started",
  "payment_succeeded",
  "provisioned",
  "merchant_activated",
  "dpp_published",
  "verification",
  "retained",
];

const LOOP_WORKFLOWS = {
  acquire: [
    "gen-seo-pages.yml",
    "content-publish.yml",
    "marketing-autonomous.yml",
    "reddit-monitor.yml",
    "buyer-signals.yml",
    "ghost-traffic.yml",
    "b2b-outreach.yml",
    "gov-ingest.yml",
  ],
  convert: [
    "revenue-cycle.yml",
    "agentz-orchestration.yml",
    "email-proposals.yml",
    "dpp-outreach-trigger.yml",
    "outreach-trigger.yml",
  ],
  fulfill: ["stripe-webhook-reconcile.yml", "checkout-watchdog.yml"],
  retain: ["revenue-cycle.yml"],
  operate: [
    "ops-pulse.yml",
    "founder-business-pulse.yml",
    "cloudflare-production-health.yml",
  ],
  improve: ["ci-repair-loop.yml", "gemma-loops.yml"],
};

const SURFACES = [
  {
    id: "authichain",
    kind: "surface",
    ledger: CORE_LEDGER,
    offer_ids: [
      "dpp_readiness",
      "made_in_usa_claim_file",
      "made_in_usa_audit_bundle",
    ],
    workflows: [
      "revenue-cycle.yml",
      "ops-pulse.yml",
      "checkout-watchdog.yml",
      "founder-business-pulse.yml",
      "dpp-outreach-trigger.yml",
    ],
  },
  {
    id: "qron",
    kind: "surface",
    ledger: CORE_LEDGER,
    offer_ids: ["free", "qron_launch", "starter", "creator"],
    workflows: [
      "gen-seo-pages.yml",
      "content-publish.yml",
      "marketing-autonomous.yml",
      "b2b-outreach.yml",
    ],
  },
  {
    id: "strainchain",
    kind: "surface",
    ledger: CORE_LEDGER,
    offer_ids: ["strainchain_passport"],
    rail_ids: ["strainchain_farm"],
    workflows: ["b2b-outreach.yml", "revenue-cycle.yml"],
  },
  {
    id: "govchain",
    kind: "surface",
    ledger: CORE_LEDGER,
    offer_ids: [],
    workflows: [
      "gov-engine.yml",
      "gov-ingest.yml",
      "gov-score.yml",
      "gov-proposals.yml",
      "gov-notify.yml",
    ],
    frozen_workflows: ["gov-mint.yml"],
  },
  {
    id: "agentz",
    kind: "executor",
    ledger: CORE_LEDGER,
    offer_ids: [],
    workflows: ["agentz-orchestration.yml"],
    frozen_modes: ["auto"],
  },
];

// Capability cards for the one orchestrator. Not a hierarchy and not dispatched.
const ACTORS = [
  {
    id: "orchestrator",
    status: "PARTIAL",
    class: "AUTOMATIC",
    enforced_by: "scripts/revenue-operator.ts#decideOperatorAction",
    may: ["classify", "choose_one_operator_action"],
    may_not: ["invent_charge", "change_price", "send_without_classifySend"],
  },
  {
    id: "protocol_guardian",
    status: "PARTIAL",
    class: "AUTOMATIC",
    enforced_by: "agentz/core/specialists.py#ProtocolGuardian",
    may: ["read_fixtures", "veto_protocol_write"],
    may_not: ["widen_seal_claim"],
  },
  {
    id: "growth_scout",
    status: "PARTIAL",
    class: "AUTOMATIC",
    enforced_by: ".github/autonomy.json#lanes.growth",
    may: ["research"],
    may_not: ["send", "guess_inbox"],
  },
  {
    id: "pilot_closer",
    status: "PARTIAL",
    class: "APPROVAL_REQUIRED",
    enforced_by: "server/outreach/send-guard.ts",
    may: ["draft", "send_inside_article_8"],
    may_not: ["change_price", "invent_customer"],
  },
  {
    id: "revenue_operator",
    status: "IMPLEMENTED",
    class: "AUTOMATIC",
    enforced_by: "scripts/revenue-operator.ts#classifyRevenue",
    may: ["classify"],
    may_not: ["stripe_write", "payout", "refund"],
  },
  {
    id: "trust_healer",
    status: "PARTIAL",
    class: "AUTOMATIC",
    enforced_by: ".github/workflows/ops-pulse.yml",
    may: ["alert", "retry"],
    may_not: ["rotate_secret"],
  },
  {
    id: "gemma",
    status: "PARTIAL",
    class: "AUTOMATIC",
    enforced_by: ".github/workflows/gemma-loops.yml",
    may: ["suggest"],
    may_not: ["merge", "send", "charge", "edit_code"],
  },
  {
    id: "agentz",
    status: "PARTIAL",
    class: "APPROVAL_REQUIRED",
    enforced_by: "scripts/revenue-operator.ts#mayRunAgentzAuto",
    may: ["dry_run", "confirm"],
    may_not: ["mode_auto"],
  },
  {
    id: "founder",
    status: "IMPLEMENTED",
    class: "FOUNDER_ONLY",
    enforced_by: ".github/founder-business.json#founder_only_gates",
    may: ["price", "sku", "refund", "migration", "dns", "secret", "legal_signature", "payout"],
    may_not: [],
  },
];

function workflowIndex(autonomy) {
  const index = new Map();
  for (const [lane, body] of Object.entries(autonomy.lanes ?? {})) {
    for (const [file, state] of Object.entries(body.workflows ?? {})) {
      index.set(file, { lane, state });
    }
  }
  return index;
}

function offerNode(plan, source) {
  return {
    id: plan.id,
    kind: "offer",
    price_usd: plan.price,
    price_source: source,
    cadence: plan.stripe_mode,
    listed: plan.listed !== false,
    public: false,
  };
}

export function buildSubstrate(input) {
  const plans = input.plans ?? [];
  const publicIds = new Set(input.publicPlanIds ?? []);
  const aliases = input.aliases ?? {};
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const workflows = workflowIndex(input.autonomy ?? { lanes: {} });
  const priceSource = "src/lib/plans.ts";

  const nodes = [
    {
      id: CORE_LEDGER,
      kind: "ledger",
      claim: "A seal proves the issuer record is unaltered. It does not prove a lab, a regulator, or that the physical item was never swapped.",
    },
  ];
  const edges = [];

  for (const [alias, target] of Object.entries(aliases)) {
    nodes.push({ id: alias, kind: "alias", target });
    edges.push({ from: alias, type: "ALIAS_OF", to: target });
  }

  for (const surface of SURFACES) {
    nodes.push({
      id: surface.id,
      kind: surface.kind,
      ledger: surface.ledger,
    });
    edges.push({ from: surface.id, type: "USES_LEDGER", to: CORE_LEDGER });
    for (const offerId of surface.offer_ids) {
      edges.push({ from: surface.id, type: "OFFERS", to: offerId });
    }
    for (const railId of surface.rail_ids ?? []) {
      edges.push({ from: surface.id, type: "RAIL_NOT_PUBLIC", to: railId });
    }
    for (const file of surface.workflows) {
      edges.push({ from: surface.id, type: "MAY_CITE", to: file });
    }
    for (const file of surface.frozen_workflows ?? []) {
      edges.push({ from: surface.id, type: "FROZEN", to: file });
    }
  }

  for (const plan of plans) {
    const node = offerNode(plan, priceSource);
    node.public = publicIds.has(plan.id);
    nodes.push(node);
  }

  for (const actor of ACTORS) nodes.push({ ...actor, kind: "actor" });

  const loops = input.founderBusiness?.loops ?? {};
  const flywheel = Object.keys(LOOP_WORKFLOWS).map((stage, index, all) => ({
    stage,
    declared_actions: loops[stage] ?? [],
    workflows: LOOP_WORKFLOWS[stage].map(file => ({
      file,
      lane: workflows.get(file)?.lane ?? null,
      state: workflows.get(file)?.state ?? null,
    })),
    next: all[(index + 1) % all.length],
  }));

  const metrics = (input.founderBusiness?.success_metrics ?? []).map(id => ({
    id,
    value: "UNKNOWN",
    reader: "not_computed_in_substrate",
  }));

  return {
    version: 1,
    authority: "projection",
    loses_to: [
      "docs/OPERATING_CHARTER.md",
      ".github/autonomy.json",
      "scripts/revenue-operator.ts#classifyRevenue",
      "src/lib/plans.ts",
    ],
    qualifying_revenue: "UNKNOWN",
    nodes,
    edges,
    control_plane: {
      actors: ACTORS,
      founder_only_gates: input.founderBusiness?.founder_only_gates ?? [],
      frozen: ["gov-mint", "agentz_mode_auto", "qron_buyback", "require_outreach_approval_false"],
    },
    flywheel: {
      company: flywheel,
      revenue_proof: {
        id: "dpp",
        order: DPP_LOOP_ORDER,
        evidence: "src/lib/dpp-loop.ts",
        rule: "A stage counts only from an observable event.",
        reinvest: {
          from: "retained",
          to: "classifyRevenue",
          spend: "FOUNDER_ONLY",
          when_not_qualifying: "wait_buyer",
        },
      },
    },
    metrics,
  };
}

export function coordinate(substrate, surfaceId) {
  const surface = SURFACES.find(item => item.id === surfaceId);
  if (!surface) return { ok: false, reason: "unknown surface " + surfaceId };
  const offers = substrate.nodes.filter(
    node => node.kind === "offer" && surface.offer_ids.includes(node.id)
  );
  return {
    ok: true,
    surface: surface.id,
    ledger: surface.ledger,
    offers,
    rails: surface.rail_ids ?? [],
    workflows: surface.workflows,
    frozen_workflows: surface.frozen_workflows ?? [],
    frozen_modes: surface.frozen_modes ?? [],
    qualifying_revenue: substrate.qualifying_revenue,
    next_proof_stage: substrate.flywheel.revenue_proof.order[0],
  };
}

function knownWorkflows(substrate) {
  const files = new Set();
  for (const stage of substrate.flywheel.company) {
    for (const workflow of stage.workflows) files.add(workflow.file);
  }
  return files;
}

export function authorize(substrate, surfaceId, action) {
  const type = action?.type;
  const surface = SURFACES.find(item => item.id === surfaceId);
  if (!surface && type !== "add_surface") {
    return { allowed: false, class: "DENIED", reason: "unknown surface" };
  }

  if (type === "change_price" || type === "refund" || type === "payout") {
    return { allowed: false, class: "FOUNDER_ONLY", reason: type + " stays with the founder" };
  }
  if (type === "set_agentz_mode") {
    const policy = agentzExecutionPolicy(String(action.mode ?? ""));
    if (!policy.allowed) {
      return { allowed: false, class: "FROZEN", reason: policy.reason };
    }
  }
  if (type === "dispatch" && (action.workflow === "gov-mint" || action.workflow === "gov-mint.yml")) {
    return { allowed: false, class: "FROZEN", reason: "gov-mint dispatch is frozen" };
  }
  if (type === "send") {
    return {
      allowed: false,
      class: "APPROVAL_REQUIRED",
      reason: "Live send still requires the charter gates and classifySend",
    };
  }
  if (type === "classify_revenue") {
    return { allowed: true, class: "AUTOMATIC", reason: "Read classifyRevenue. Do not replace it.", writes: false };
  }
  if (type === "select_offer") {
    const id = action.offer_id;
    if (surface.offer_ids.includes(id)) {
      return { allowed: true, class: "AUTOMATIC", reason: "Offer is on this surface" };
    }
    if ((surface.rail_ids ?? []).includes(id)) {
      return { allowed: false, class: "DENIED", reason: id + " is a rail, not a public offer" };
    }
    return { allowed: false, class: "DENIED", reason: surfaceId + " does not sell " + id };
  }
  if (type === "cite_workflow") {
    const file = action.workflow;
    if (!knownWorkflows(substrate).has(file) && !surface.workflows.includes(file)) {
      return { allowed: false, class: "DENIED", reason: file + " is not in the projection" };
    }
    if ((surface.frozen_workflows ?? []).includes(file)) {
      return { allowed: false, class: "FROZEN", reason: file + " is frozen for " + surfaceId };
    }
    if (surface.workflows.includes(file) || file === "ops-pulse.yml" || file === "founder-business-pulse.yml") {
      return { allowed: true, class: "AUTOMATIC", reason: "Existing workflow" };
    }
    return { allowed: false, class: "DENIED", reason: surfaceId + " may not cite " + file };
  }
  if (type === "add_surface") {
    if (action.ledger && action.ledger !== CORE_LEDGER) {
      return { allowed: false, class: "DENIED", reason: "A new surface uses " + CORE_LEDGER };
    }
    const offerIds = action.offer_ids ?? [];
    const catalogue = new Set(substrate.nodes.filter(node => node.kind === "offer").map(node => node.id));
    for (const offerId of offerIds) {
      if (!catalogue.has(offerId)) {
        return { allowed: false, class: "FOUNDER_ONLY", reason: "New offer " + offerId + " is a SKU change" };
      }
    }
    const files = action.workflows ?? [];
    const known = knownWorkflows(substrate);
    for (const file of surface?.workflows ?? []) known.add(file);
    for (const file of files) {
      if (!known.has(file)) {
        return { allowed: false, class: "DENIED", reason: "New workflow " + file + " is a new loop" };
      }
    }
    return { allowed: true, class: "AUTOMATIC", reason: "Reuses the core ledger, catalogue, and workflows" };
  }
  return { allowed: false, class: "DENIED", reason: "Unknown action " + type };
}

export function findSubstrateErrors(substrate, input) {
  const errors = [];
  const plans = new Map((input.plans ?? []).map(plan => [plan.id, plan]));
  const workflows = workflowIndex(input.autonomy ?? { lanes: {} });
  const publicIds = new Set(input.publicPlanIds ?? []);

  if (substrate.qualifying_revenue !== "UNKNOWN") {
    errors.push("Substrate must not store a qualifying revenue total");
  }
  if (substrate.authority !== "projection") {
    errors.push("Substrate authority must stay projection");
  }

  for (const surface of SURFACES) {
    if (surface.ledger !== CORE_LEDGER) {
      errors.push(surface.id + " ledger must be " + CORE_LEDGER);
    }
    for (const offerId of [...surface.offer_ids, ...(surface.rail_ids ?? [])]) {
      if (!plans.has(offerId)) errors.push(surface.id + " names unknown plan " + offerId);
    }
    for (const offerId of surface.offer_ids) {
      if (offerId !== "free" && !publicIds.has(offerId) && plans.has(offerId)) {
        errors.push(surface.id + " sells non-public plan " + offerId);
      }
    }
    for (const railId of surface.rail_ids ?? []) {
      if (publicIds.has(railId)) errors.push(railId + " is public and cannot be marked rail-only");
    }
    for (const file of [...surface.workflows, ...(surface.frozen_workflows ?? [])]) {
      if (!workflows.has(file)) errors.push("Workflow missing from autonomy.json: " + file);
    }
  }

  for (const [alias, target] of Object.entries(input.aliases ?? {})) {
    if (!plans.has(target)) errors.push("Alias " + alias + " points at unknown plan " + target);
  }

  const loops = input.founderBusiness?.loops ?? {};
  for (const stage of Object.keys(LOOP_WORKFLOWS)) {
    if (!loops[stage]) errors.push("founder-business.json missing loop " + stage);
  }
  for (const stage of substrate.flywheel.company) {
    for (const workflow of stage.workflows) {
      if (!workflows.has(workflow.file)) {
        errors.push("Flywheel cites missing workflow " + workflow.file);
      }
    }
  }

  const proof = substrate.flywheel.revenue_proof.order;
  if (proof.join(",") !== DPP_LOOP_ORDER.join(",")) {
    errors.push("DPP flywheel order drifted from DPP_LOOP_ORDER");
  }
  if (proof.indexOf("payment_succeeded") > proof.indexOf("provisioned")) {
    errors.push("Provision cannot precede payment");
  }

  for (const metric of substrate.metrics) {
    if (metric.value !== "UNKNOWN") errors.push("Metric " + metric.id + " must stay UNKNOWN in the projection");
  }

  const denied = [
    authorize(substrate, "qron", { type: "change_price" }),
    authorize(substrate, "agentz", { type: "set_agentz_mode", mode: "auto" }),
    authorize(substrate, "govchain", { type: "dispatch", workflow: "gov-mint.yml" }),
    authorize(substrate, "strainchain", { type: "select_offer", offer_id: "strainchain_farm" }),
    authorize(substrate, "qron", { type: "select_offer", offer_id: "dpp_readiness" }),
    authorize(substrate, "future", { type: "add_surface", ledger: "other", offer_ids: ["starter"] }),
  ];
  if (denied.some(result => result.allowed)) {
    errors.push("A denied coordination action was allowed");
  }
  const allowed = authorize(substrate, "future", {
    type: "add_surface",
    ledger: CORE_LEDGER,
    offer_ids: ["starter"],
    workflows: ["ops-pulse.yml"],
  });
  if (!allowed.allowed) errors.push("Reuse of the core was rejected: " + allowed.reason);

  return errors;
}

async function main() {
  const root = process.cwd();
  const founderBusiness = JSON.parse(readFileSync(resolve(root, ".github/founder-business.json"), "utf8"));
  const autonomy = JSON.parse(readFileSync(resolve(root, ".github/autonomy.json"), "utf8"));
  const { PLANS, PUBLIC_PLAN_IDS, PLAN_ALIASES } = await import(
    pathToFileURL(resolve(root, "src/lib/plans.ts")).href
  );
  const input = {
    plans: PLANS,
    publicPlanIds: PUBLIC_PLAN_IDS,
    aliases: PLAN_ALIASES,
    founderBusiness,
    autonomy,
  };
  const substrate = buildSubstrate(input);
  const errors = findSubstrateErrors(substrate, input);
  if (errors.length) {
    for (const message of errors) console.error("::error::" + message);
    process.exit(1);
  }
  console.log(JSON.stringify(substrate, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
