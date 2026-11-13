#!/usr/bin/env node
/**
 * Dry compliance pass over a campaign JSON package.
 * Prefer: pnpm exec tsx scripts/autonomy/campaign-compliance.mjs <campaign.json>
 * Drives shipped classifySend / selectNextSendCandidate. Never sends mail.
 */
import { readFileSync } from "node:fs";

const campaignPath = process.argv[2];
if (!campaignPath) {
  console.error(
    "usage: pnpm exec tsx scripts/autonomy/campaign-compliance.mjs <campaign.json>"
  );
  process.exit(2);
}

const { classifySend, selectNextSendCandidate, decideOperatorAction } =
  await import("../revenue-operator.ts");

const campaign = JSON.parse(readFileSync(campaignPath, "utf8"));
const VALID = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
  "pattern_guess",
  "scraped",
  "unknown",
]);

const rows = [];
for (const p of campaign.prospects || []) {
  const email = (p.contact_channel || "").trim();
  let source = p.verification_source || "unknown";
  if (!VALID.has(source)) source = "unknown";
  const isPriority = (campaign.priority10 || []).includes(p.id);
  let send = { allowed: false, reason: "no_contact" };
  if (email) {
    send = classifySend({
      namedInboxThisTurn: null,
      operatorSelectedInbox: email,
      source,
      allowRoleInbox: Boolean(p.allow_role_inbox),
    });
  }
  rows.push({
    id: p.id,
    company: p.company,
    email: email || null,
    source,
    qualification: p.qualification,
    priority: isPriority,
    classify_allowed: send.allowed,
    classify_reason: send.reason,
    campaign_status: p.campaign_status,
  });
}

const priorityCandidates = rows
  .filter((r) => r.priority && r.email)
  .map((r) => ({ email: r.email, source: r.source }));

const selected = selectNextSendCandidate(priorityCandidates);
const decision = decideOperatorAction({
  rails: { ok: true, reason: "skipped", results: [] },
  snapshot: { subscriptions: [], payouts: [], charges: [] },
  candidates: priorityCandidates,
});

const report = {
  campaign_id: campaign.campaign_id,
  prospects: rows.length,
  priority: (campaign.priority10 || []).length,
  sendable_priority: rows.filter((r) => r.priority && r.classify_allowed).length,
  selected,
  decide_action: decision.action,
  decide_to: decision.to || null,
  revenue_qualifying: decision.revenue?.qualifying === true,
  rows,
};

console.log(JSON.stringify(report, null, 2));
if (rows.length < 1) process.exit(1);
process.exit(0);
