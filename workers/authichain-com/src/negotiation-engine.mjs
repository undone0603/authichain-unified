import {assessInboundSupplierContract} from "./inbound-contract-gate.mjs";

/**
 * AuthiChain negotiate v0.1: deterministic, general-purpose multi-issue proposals.
 * BATNA, reservation values, MESO-style tradeoffs, no external side effects.
 * Neither a purchasing agent nor a contract/approval instrument.
 */
export class NegotiationInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "NegotiationInputError";
  }
}
const error = (m) => { throw new NegotiationInputError(m); };
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const num = v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e12;
const round = n => Math.round((n + Number.EPSILON) * 10000) / 10000;
const slug = v => typeof v === "string" && /^[a-z][a-z0-9_]{0,47}$/.test(v);
const clamp = n => Math.max(0, Math.min(1, n));
function readIssues(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) error("issues must contain 1–8 dimensions");
  const keys = new Set();
  return raw.map((v, i) => {
    if (!record(v) || !slug(v.key) || keys.has(v.key)) error("invalid or duplicate issue key at index " + i);
    keys.add(v.key);
    if (!["minimize", "maximize"].includes(v.direction)) error("invalid issue direction");
    if (!num(v.target) || !num(v.walkAway)) error("issue target and walkAway must be finite numbers");
    if (v.direction === "minimize" && v.target > v.walkAway) error("minimize target exceeds walkAway");
    if (v.direction === "maximize" && v.target < v.walkAway) error("maximize target below walkAway");
    if (!num(v.weight) || v.weight < 1 || v.weight > 10) error("weight must be between 1 and 10");
    if (v.unit !== undefined && (typeof v.unit !== "string" || !/^[a-zA-Z0-9_\/$% -]{1,16}$/.test(v.unit))) error("invalid unit");
    return {key:v.key,direction:v.direction,target:v.target,walkAway:v.walkAway,weight:v.weight,unit:v.unit ?? null};
  });
}
function score(issue, value) {
  const span = Math.abs(issue.walkAway - issue.target);
  const inside = issue.direction === "minimize" ? value <= issue.walkAway : value >= issue.walkAway;
  if (!inside) return {within:false,utility:0};
  if (span === 0) return {within:true,utility:1};
  const raw = issue.direction === "minimize"
    ? (issue.walkAway - value) / span
    : (value - issue.walkAway) / span;
  return {within:true,utility:round(clamp(raw))};
}
function evaluateTerms(issues, raw, ref) {
  if (!record(raw) || Object.keys(raw).length !== issues.length) error(ref + " must contain exactly the listed issue keys");
  const byIssue = [];
  for (const issue of issues) {
    const value = raw[issue.key];
    if (!num(value)) error(ref + "." + issue.key + " must be a finite numeric term");
    byIssue.push({key:issue.key,value, ...score(issue,value)});
  }
  const weightSum = issues.reduce((s,i) => s+i.weight, 0);
  return {
    withinWalkAway:byIssue.every(x=>x.within),
    weightedUtility:round(byIssue.reduce((s,x,j)=>s+x.utility*issues[j].weight,0)/weightSum),
    issues:byIssue
  };
}
function termsFromUtility(issues, utilities) {
  return Object.fromEntries(issues.map((issue,i) => {
    const u=clamp(utilities[i]);
    const raw=round(issue.walkAway + (issue.target-issue.walkAway)*u);
    const bounded=Math.max(Math.min(issue.target,issue.walkAway),Math.min(Math.max(issue.target,issue.walkAway),raw));
    return [issue.key,bounded];
  }));
}
function makeProposals(issues) {
  const opening = Object.fromEntries(issues.map(i=>[i.key,i.target]));
  const proposals = [{id:"opening_target",strategy:"evidence_based_anchor",terms:opening,score:evaluateTerms(issues,opening)}];
  if (issues.length === 1) return proposals;
  const base = 0.75;
  const w=issues.reduce((s,i)=>s+i.weight,0);
  const balanced = termsFromUtility(issues,issues.map(()=>base));
  proposals.push({id:"balanced_trade",strategy:"multi_issue_tradeoff",terms:balanced,score:evaluateTerms(issues,balanced)});
  const priority=[...issues.keys()].sort((a,b)=>issues[b].weight-issues[a].weight);
  for (const j of priority.slice(0,1)) {
    const otherWeight=w-issues[j].weight;
    const delta=Math.min(0.15,0.20*otherWeight/Math.max(issues[j].weight,1));
    if (delta<=0) continue;
    const lower=issues[j].weight*delta/otherWeight;
    const u=issues.map((v,i)=>i===j?base+delta:base-lower);
    const terms=termsFromUtility(issues,u);
    const candidate={id:"prioritize_"+issues[j].key,strategy:"conditional_tradeoff",terms,score:evaluateTerms(issues,terms)};
    if (candidate.score.withinWalkAway && !proposals.some(p=>JSON.stringify(p.terms)===JSON.stringify(terms))) proposals.push(candidate);
  }
  return proposals;
}
export function evaluateNegotiation(input) {
  if (!record(input)) error("input must be an object");
  if (typeof input.objective !== "string" || input.objective.trim().length < 3 || input.objective.length > 240)
    error("objective must be a short description (3–240 characters)");
  const issues=readIssues(input.issues);
  const offers=input.counterpartOffers ?? [];
  if (!Array.isArray(offers) || offers.length>8) error("counterpartOffers must contain at most eight offers");
  const seen=new Set();
  const assessed=offers.map((o,i)=>{
    if (!record(o) || !slug(o.id) || seen.has(o.id)) error("invalid or duplicate offer id");
    seen.add(o.id);
    const check=evaluateTerms(issues,o.terms,"counterpartOffers["+i+"].terms");
    return {id:o.id, status:check.withinWalkAway?"WITHIN_DECLARED_LIMITS":"OUTSIDE_DECLARED_LIMITS",...check,source:"caller_supplied_unverified"};
  }).sort((a,b)=>Number(b.withinWalkAway)-Number(a.withinWalkAway)||b.weightedUtility-a.weightedUtility);
  if (input.outsideOption !== undefined &&
      (!record(input.outsideOption) || !record(input.outsideOption.terms)))
    error("outsideOption must provide an object of numeric terms");
  const batna=input.outsideOption === undefined ? null:evaluateTerms(issues,input.outsideOption.terms,"outsideOption.terms");
  const proposals=makeProposals(issues);
  return {
    schema:"authichain-negotiate/0.1",
    status:"PROPOSALS_ONLY",
    decision:"NO_AGREEMENT_OR_AUTHORIZATION",
    issuePreferences:issues,
    batna:{
      declared:batna!==null, verifiedByIndependentSource:false,
      ...(batna?{weightedUtility:batna.weightedUtility,withinWalkAway:batna.withinWalkAway}:{}),
      note:"An outside option is caller-supplied and not independently verified."
    },
    zopa:{status:"UNKNOWN",reason:"Counterparty reservation values are unverified; overlap cannot be established."},
    counterpartOffers:assessed,
    proposals,
    ...(input.inboundContract!==undefined?{inboundContractReadiness:assessInboundSupplierContract(input.inboundContract)}:{}),
    strategicNotes:[
      "Use the target proposal as an evidence-based opening, not a factual market price.",
      "Trade concessions only for reciprocal value, such as price for delivery or warranty.",
      "Clarify the other party's interests; do not disclose private reservation values to the counterparty.",
      "Present multi-issue alternatives as proposals, not accepted terms."
    ],
    nextChecks:["verify competing quotes and compatibility independently","confirm decision-maker and counterparty authority","obtain written acceptance of exact terms before committing"],
    allowedActions:{draft:true,score:true,counterpropose:false,sendMessage:false,acceptOffer:false,purchase:false,issuePayment:false,sign:false,createAccount:false},
    humanApprovalRequired:true,
    sideEffectsPerformed:0,
    caution:"No live seller contacted, no order placed, no offer accepted, no financial or legal commitment."
  };
}
