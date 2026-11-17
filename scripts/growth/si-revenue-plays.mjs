#!/usr/bin/env node
// Offline, read-only research-to-revenue triage. No fetch, payment, sends or writes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { OFFERS } from './buyer-signals.mjs';

export const PLAYS = Object.freeze({
  passport: { base: 90, url: OFFERS.dpp_readiness.url, label: 'Free DPP check -> existing $299 workspace; not certification' },
  agent: { base: 60, url: 'https://signal.authichain.com/offer', label: 'Public x402 offer; no payment without approval' },
  qron: { base: 45, url: 'https://authichain.com/verify', label: 'Free evidence lookup; not physical authentication' },
});
const KINDS = new Set(['official', 'repository', 'ai_generated', 'industry']);
const REVIEWS = new Set(['unreviewed', 'source_checked', 'independently_reproduced']);
const BUYERS = new Set(['inbound_opt_in', 'published_tender', 'public_interest']);
const RE_HTTPS = /^https:\/\//;
function text(v, name, max = 600) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Invalid ' + name);
  return v.trim();
}
export function url(v) {
  const s = text(v, 'public URL', 2000); let p;
  try { p = new URL(s); } catch { throw Error('Invalid public URL'); }
  if (!RE_HTTPS.test(s) || p.username || p.password || p.hash || !p.hostname.includes('.') ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(p.hostname) ||
      /token|secret|passw|key|authorization|session/i.test([...p.searchParams.keys()].join(','))) {
    throw Error('Unsafe public URL');
  }
  return p.href;
}
export function evaluate(signal, now = new Date()) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) throw Error('Invalid signal');
  const id = text(signal.id, 'id', 72);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) throw Error('Invalid id');
  const lane = text(signal.lane, 'lane');
  if (!Object.hasOwn(PLAYS, lane)) throw Error('Unknown play');
  const kind = text(signal.kind, 'kind');
  if (!KINDS.has(kind)) throw Error('Unknown source kind');
  const review = text(signal.review, 'review');
  if (!REVIEWS.has(review)) throw Error('Unknown review');
  const claim = text(signal.claim, 'claim', 800);
  const source = url(signal.source);
  const date = text(signal.observed, 'observed', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date || Date.parse(date) > now.getTime() + 86400000) {
    throw Error('Invalid observed date');
  }
  if (!Array.isArray(signal.support) || signal.support.length > 8) throw Error('Invalid support');
  const support = [...new Set(signal.support.map(url))].sort();
  const buyer = signal.buyer || null;
  if (buyer && (!BUYERS.has(buyer.type) || typeof buyer.opt_in !== 'boolean' || !buyer.url)) throw Error('Invalid buyer');
  if (buyer && buyer.opt_in && buyer.type !== 'inbound_opt_in') throw Error('Public interest cannot imply consent');
  const buyerUrl = buyer ? url(buyer.url) : null;
  const stale = (now.getTime() - Date.parse(date)) > 90 * 86400000;
  const hasOtherEvidence = support.some(x => x !== source);
  const reviewed = review !== 'unreviewed' && !stale;
  // An AI claim never becomes evidence merely because an AI published it.
  const eligible = reviewed && (kind === 'official' || (kind === 'repository' && hasOtherEvidence) ||
    (hasOtherEvidence && review === 'independently_reproduced'));
  const next = !eligible ? 'fact_check_only' : buyer?.opt_in ? 'draft_consent_based_reply' :
    buyer?.type === 'published_tender' ? 'review_public_tender_no_contact' :
    lane === 'passport' ? 'draft_source_cited_DPP_guide' :
    lane === 'agent' ? 'draft_free_agent_integration' : 'draft_opt_in_evidence_share';
  const cta = new URL(PLAYS[lane].url);
  for (const [k, v] of Object.entries({ utm_source: 'si-knowledge', utm_medium: 'organic', utm_campaign: lane, utm_content: id })) cta.searchParams.set(k, v);
  const sha256 = createHash('sha256').update(JSON.stringify({ id, lane, claim, source, kind, review, date, support })).digest('hex');
  return { id, lane, claim, source, support, observed: date, kind, review,
    review_is_self_attested: true, evidence_gate: eligible ? 'source_review_attested_not_certified' : 'research_only',
    score: PLAYS[lane].base + (eligible ? 20 : -30) + (eligible && buyer?.opt_in ? 25 : 0),
    buyer_signal: buyer ? { type: buyer.type, url: buyerUrl, opt_in: buyer.opt_in } : null,
    next, cta: cta.href, boundary: PLAYS[lane].label, sha256,
    sent: 0, paid_calls: 0, verified_customers: 0 };
}
export function run(manifest, now = new Date()) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.signals) || manifest.signals.length > 50) throw Error('Invalid manifest v1');
  const actions = manifest.signals.map(x => evaluate(x, now));
  if (new Set(actions.map(x => x.id)).size !== actions.length) throw Error('Duplicate ID');
  actions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { generated_at: now.toISOString(), actions,
    totals: { reviewed_drafts: actions.filter(x => x.evidence_gate !== 'research_only').length,
      research_holds: actions.filter(x => x.evidence_gate === 'research_only').length,
      paid_customers: 0, sends: 0, charges: 0 },
    disclosure: 'Offline triage; reviewer assertions and source URLs were not independently verified by this program.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/growth/si-revenue-plays.mjs manifest.json');
    process.stdout.write(JSON.stringify(run(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2) + '\n');
  } catch (e) { console.error('SI_REVENUE_HOLD: ' + e.message); process.exitCode = 1; }
}
