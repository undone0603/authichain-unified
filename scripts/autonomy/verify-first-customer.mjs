#!/usr/bin/env node
/**
 * Verify first independently paying customer evidence.
 * Prefer: pnpm exec tsx scripts/autonomy/verify-first-customer.mjs \
 *   --snapshot=path.json --fulfillment=path.json
 *
 * Passes only when classifyRevenue qualifies a non-founder livemode charge/sub
 * AND fulfillment evidence documents webhook + granted entitlement for a
 * non-founder buyer. Never creates Stripe objects. Never sends mail.
 */
import { readFileSync, existsSync } from "node:fs";
import {
  classifyRevenue,
  DEFAULT_FOUNDER_EMAILS,
  snapshotFromStripeLike,
} from "../revenue-operator.ts";

function flag(name) {
  const eq = process.argv.find(a => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function fulfillmentEvidenceOk(f, founderEmails = DEFAULT_FOUNDER_EMAILS) {
  if (!f || typeof f !== "object") return { ok: false, reason: "missing_fulfillment_object" };
  const required = ["webhook_event_id", "session_id", "buyer_email"];
  const missing = required.filter(k => !f[k]);
  if (missing.length) {
    return { ok: false, reason: `missing_fields:${missing.join(",")}` };
  }
  if (f.entitlement !== "granted" && f.entitlement_granted !== true) {
    return { ok: false, reason: "entitlement_not_granted" };
  }
  const email = String(f.buyer_email).toLowerCase();
  const founders = founderEmails.map(e => e.toLowerCase());
  if (founders.includes(email) || email.endsWith("@authichain.com")) {
    return { ok: false, reason: "founder_buyer" };
  }
  return {
    ok: true,
    webhook_event_id: f.webhook_event_id,
    session_id: f.session_id,
    buyer_domain: email.split("@")[1] || "",
  };
}

const snapshotPath = flag("--snapshot");
const fulfillmentPath = flag("--fulfillment");
const out = {
  ok: false,
  qualifying: false,
  fulfillment_ok: false,
  reasons: [],
};

if (!snapshotPath || !existsSync(snapshotPath)) {
  out.reasons.push("missing --snapshot=path.json with Stripe-like payload");
  console.log(JSON.stringify(out, null, 2));
  process.exit(2);
}

const raw = JSON.parse(readFileSync(snapshotPath, "utf8"));
const snapshot = snapshotFromStripeLike(raw);
const verdict = classifyRevenue(snapshot, DEFAULT_FOUNDER_EMAILS);
out.qualifying = verdict.qualifying === true;
out.revenue_reason = verdict.reason;
if (!out.qualifying) {
  out.reasons.push(`classifyRevenue not qualifying: ${verdict.reason}`);
}

if (!fulfillmentPath || !existsSync(fulfillmentPath)) {
  out.reasons.push(
    "missing --fulfillment=path.json with webhook_event_id, session_id, entitlement, buyer_email"
  );
} else {
  const f = JSON.parse(readFileSync(fulfillmentPath, "utf8"));
  const fe = fulfillmentEvidenceOk(f);
  out.fulfillment_ok = fe.ok === true;
  if (!fe.ok) out.reasons.push(`fulfillment: ${fe.reason}`);
  else out.fulfillment = fe;
}

out.ok = out.qualifying && out.fulfillment_ok;
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
