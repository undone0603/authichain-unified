#!/usr/bin/env node
// scripts/autonomy/deliverability-breaker.mjs
//
// Circuit breaker for cold outreach. Reads recent sends from Resend and trips
// (forces dry-run) when the bounce or complaint rate over the window breaches
// the limits in .github/autonomy.json -> cold_outreach.breaker.
//
// Fails CLOSED: if Resend cannot be read, the breaker trips. Protecting the
// sending domain matters more than one day of sends.
//
// Env: RESEND_API_KEY and/or RESEND_API_KEY2 (both are read and pooled),
//      OUTREACH_SENDERS (optional, comma-separated from-addresses to count).
//      When OUTREACH_SENDERS is unset, the per-segment outreach from-addresses
//      (OUTREACH_FROM_GOVCHAIN / _STRAINCHAIN / _QRON, the same secrets
//      b2b-cold-outreach.ts sends from) are used, so only outreach is counted.
//      Sender addresses are never printed.
// Output: prints a verdict; writes tripped=true|false and reason=... to
//         $GITHUB_OUTPUT when present. Exit code is always 0 unless the
//         script itself crashes; callers act on the output.

import { appendFileSync } from "node:fs";
import { loadManifest } from "./reconcile.mjs";

const BAD_EVENTS = { bounced: "bounce", complained: "complaint" };

/**
 * Both Resend keys can belong to the same account, so the pooled list can hold
 * the same email twice. Count each Resend email id once (CFD-251 follow-up);
 * rows without an id are kept as-is.
 */
export function dedupeById(emails) {
  const seen = new Set();
  return emails.filter(e => {
    const id = e?.id;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Sender list: OUTREACH_SENDERS, else the per-segment outreach from-secrets.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function outreachSenders(env = process.env) {
  const explicit = String(env.OUTREACH_SENDERS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;
  return [
    env.OUTREACH_FROM_GOVCHAIN,
    env.OUTREACH_FROM_STRAINCHAIN,
    env.OUTREACH_FROM_QRON,
  ]
    .map(s => String(s ?? "").trim())
    .filter(Boolean);
}

/** Pure: compute the verdict from a list of {id, created_at, last_event, from}. */
export function evaluate(emails, cfg, { now = Date.now(), senders = [] } = {}) {
  const windowMs = (cfg.window_days ?? 7) * 86_400_000;
  const want = senders.map(s => s.toLowerCase().trim()).filter(Boolean);
  const inWindow = dedupeById(emails).filter(e => {
    const t = Date.parse(e.created_at);
    if (!Number.isFinite(t) || now - t > windowMs) return false;
    if (!want.length) return true;
    const from = String(e.from ?? "").toLowerCase();
    return want.some(s => from.includes(s));
  });
  const n = inWindow.length;
  const bounces = inWindow.filter(
    e => BAD_EVENTS[e.last_event] === "bounce"
  ).length;
  const complaints = inWindow.filter(
    e => BAD_EVENTS[e.last_event] === "complaint"
  ).length;
  const rate = n ? bounces / n : 0;
  const stats = {
    sent: n,
    bounces,
    complaints,
    bounce_rate: Number(rate.toFixed(4)),
  };
  if (complaints > (cfg.max_complaints ?? 0)) {
    return {
      tripped: true,
      reason: `${complaints} spam complaint(s) in ${cfg.window_days}d`,
      stats,
    };
  }
  if (n >= (cfg.min_sample ?? 10) && rate > cfg.max_bounce_rate) {
    return {
      tripped: true,
      reason: `bounce rate ${(rate * 100).toFixed(1)}% > ${(cfg.max_bounce_rate * 100).toFixed(1)}% over ${n} sends`,
      stats,
    };
  }
  return {
    tripped: false,
    reason: `ok: ${n} sends, ${bounces} bounces, ${complaints} complaints`,
    stats,
  };
}

export async function fetchResendEmails(
  key,
  { fetchImpl = fetch, maxPages = 5 } = {}
) {
  const out = [];
  let after;
  for (let i = 0; i < maxPages; i++) {
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Resend list emails -> ${res.status}`);
    const body = await res.json();
    const data = body.data ?? [];
    out.push(...data);
    if (!body.has_more || !data.length) break;
    after = data[data.length - 1].id;
  }
  return out;
}

function emit(verdict) {
  const line = `Deliverability breaker: ${verdict.tripped ? "TRIPPED" : "clear"} - ${verdict.reason}`;
  console.log(line);
  console.log(JSON.stringify(verdict.stats ?? {}));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tripped=${verdict.tripped}\nreason=${verdict.reason.replace(/\n/g, " ")}\n`
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${line}\n`);
}

async function main() {
  const cfg = loadManifest().cold_outreach?.breaker ?? {};
  const keys = [process.env.RESEND_API_KEY, process.env.RESEND_API_KEY2].filter(
    Boolean
  );
  if (!keys.length)
    return emit({
      tripped: true,
      reason: "no Resend key available - failing closed",
    });
  let emails = [];
  try {
    for (const k of [...new Set(keys)])
      emails.push(...(await fetchResendEmails(k)));
  } catch (e) {
    return emit({
      tripped: true,
      reason: `cannot read Resend (${e.message}) - failing closed`,
    });
  }
  const senders = outreachSenders();
  const verdict = evaluate(emails, cfg, { senders });
  verdict.stats = { ...verdict.stats, sender_filters: senders.length };
  emit(verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
