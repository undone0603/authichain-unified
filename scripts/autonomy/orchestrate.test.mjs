import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGENTZ,
  CAPABILITIES,
  SHAPE,
  annualizedHours,
  assess,
  assumptionsFresh,
  books,
  customerNode,
  flywheelCredit,
  freedomEntry,
  iterate,
  kill,
  placeAgentZ,
  trustReport,
  validateLedger,
  why,
} from "./orchestrate.mjs";
import { PLAN_ALIASES, PLANS, PUBLIC_PLAN_IDS } from "../../src/lib/plans.ts";

const goal = JSON.parse(readFileSync(new URL("../../docs/operations/best-case-goal.json", import.meta.url), "utf8"));
const ledger = JSON.parse(readFileSync(new URL("../../docs/operations/founder-freedom-ledger.json", import.meta.url), "utf8"));
const founderBusiness = JSON.parse(readFileSync(new URL("../../.github/founder-business.json", import.meta.url), "utf8"));
const autonomy = JSON.parse(readFileSync(new URL("../../.github/autonomy.json", import.meta.url), "utf8"));

const input = {
  plans: PLANS,
  publicPlanIds: PUBLIC_PLAN_IDS,
  aliases: PLAN_ALIASES,
  founderBusiness,
  autonomy,
  goal,
  ledger,
};

const evidence = {
  qualifying: false,
  dppRetained: false,
  now: "2026-10-06",
  mode: "boring",
  snapshot: false,
};

test("the formula example is 45 to 3, not a ledger claim", () => {
  assert.equal(annualizedHours(42), 36.4);
  const row = freedomEntry({
    id: "formula-example",
    what: "formula only",
    before_min_per_week: 45,
    after_min_per_week: 3,
    risk: "low",
    revenue_impact_usd: null,
    status: "autonomous",
    evidence: "unit",
    measurement: "arithmetic check, not a founder observation",
  });
  assert.equal(row.saved_min_per_week, 42);
  assert.equal(row.annualized_hours, 36.4);
  assert.throws(() => freedomEntry({
    before_min_per_week: null,
    after_min_per_week: null,
    saved_min_per_week: 42,
    annualized_hours: 36.4,
  }));
});

test("the committed ledger is autonomous and unmeasured", () => {
  assert.deepEqual(validateLedger(ledger), []);
  assert.equal(ledger.entries.length, 2);
  assert.ok(ledger.entries.every(entry => entry.saved_min_per_week == null));
  assert.ok(ledger.entries.every(entry => entry.status === "autonomous"));
});

test("best case is a simulation and the live goal stops on the buyer gate", () => {
  const report = assess(input, evidence);
  assert.equal(report.system_reached, true);
  assert.equal(report.reached, false);
  assert.equal(report.next_action.id, "offer_dpp_openclaw");
  assert.equal(report.next_action.interrupt, "L2");
  assert.equal(report.next_action.status, "READY");
  assert.equal(report.next_action.executable, true);
  assert.equal(report.next_action.sends_mail, false);
  assert.equal(report.next_action.opens_checkout_session, false);
  assert.equal(report.next_action.checkout_url, "https://authichain.com/checkout/dpp_readiness");
  assert.equal(report.next_action.price_usd, 299);
  const mail = report.withheld_actions.find(item => item.id === "sell_existing_dpp");
  assert.equal(mail.status, "BLOCKED");
  assert.equal(mail.executable, false);
  assert.equal(mail.blocked_on, "verified_inbox");
  const candidate = assess(input, { ...evidence, named_inbox: "pilot.contact@example.com" });
  assert.equal(candidate.next_action.id, "offer_dpp_openclaw");
  assert.equal(candidate.next_action.sends_mail, false);
  const namedMail = candidate.withheld_actions.find(item => item.id === "sell_existing_dpp");
  assert.equal(namedMail.status, "CANDIDATE");
  assert.equal(namedMail.executable, false);
  assert.equal(namedMail.candidate, "pilot.contact@example.com");
  assert.equal(namedMail.blocking_requirement, "explicit send approval; no mail sent");
  assert.equal(report.simulation.not_revenue, true);
  assert.equal(report.simulation.cash_usd, 4833);
  assert.equal(report.simulation.rows.find(row => row.plan_id === "dpp_readiness").cash_usd, 4485);
  assert.ok(report.catalog.some(item => item.id === "dpp_readiness" && item.status === "sell_today"));
  assert.equal(report.catalog.some(item => item.id === "strainchain_farm"), false);
  const step = iterate(null, input, evidence);
  assert.equal(step.stop, false);
  assert.equal(step.blocked, false);
  assert.equal(step.revision, 1);
  const settled = iterate(step, input, evidence);
  assert.equal(settled.stop, true);
  assert.equal(settled.progressed, false);
});

test("stale assumptions and moonshots do not outrank a fresh catalogue sale", () => {
  assert.equal(assumptionsFresh(goal, "2026-10-06"), true);
  assert.equal(assumptionsFresh(goal, "2026-12-01"), false);
  const stale = assess(input, { ...evidence, now: "2026-12-01" });
  assert.equal(stale.next_action.id, "revalidate_cvr");
  assert.equal(stale.next_action.status, "BLOCKED");
  assert.equal(stale.next_action.executable, false);
  assert.equal(stale.next_action.blocking_requirement, "measured conversion, not another guess");
  const moon = assess(input, { ...evidence, mode: "moonshot" });
  assert.notEqual(moon.next_action.id, "moonshot_si");
});

test("AgentZ is one capability under the brain, not a second company", () => {
  assert.equal(SHAPE.founder, 1);
  assert.equal(SHAPE.network, "authichain-core");
  assert.equal(CAPABILITIES.filter(item => item.id === "agentz").length, 1);
  assert.equal(AGENTZ.layers.length, 4);
  assert.equal(placeAgentZ({ type: "observe", user_trigger: true }).allowed, true);
  assert.equal(placeAgentZ({ type: "spawn_bot" }).allowed, false);
  assert.equal(placeAgentZ({ type: "background", user_trigger: false }).interrupt, "L4");
  assert.equal(placeAgentZ({ type: "qron_reward", user_trigger: true }).allowed, false);
  assert.equal(placeAgentZ({ type: "mint", user_trigger: true }).allowed, false);
  assert.equal(placeAgentZ({ type: "send", user_trigger: true }).interrupt, "L3");
  assert.equal(placeAgentZ({ type: "repair", user_trigger: true, cycle: 4 }).interrupt, "L2");
  const report = assess(input, evidence);
  assert.equal(report.shape.brain, SHAPE.brain);
});

test("one layer: flat capabilities, two books, explainable trust, no single score", () => {
  assert.equal(CAPABILITIES.some(item => item.children), false);
  assert.equal(books({ book: "experimental", counts_as_revenue: true }).ok, false);
  assert.equal(books({ book: "operating", counts_as_revenue: true }).ok, true);
  assert.equal(trustReport().single_score, null);
  assert.equal(trustReport().dimensions.length, 10);
  assert.equal(customerNode().pii_stored_here, false);
  assert.deepEqual(flywheelCredit("payment_succeeded"), ["trust", "transaction", "data", "automation"]);
  assert.equal(why({}).keep, false);
  assert.equal(why({ revenue: true }).keep, true);
  assert.equal(kill(goal.loops[0], { sessions: 500, paid: 0 }).kill, true);
  assert.equal(kill(goal.loops[0], { sessions: 10, paid: 1 }).kill, false);
});
