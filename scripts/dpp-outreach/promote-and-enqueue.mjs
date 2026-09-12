#!/usr/bin/env node
/**
 * Promote verified decision-makers into the Worker outreach queue.
 * Only rows with status=verified pass. Respects Worker daily remaining capacity.
 *
 * Usage:
 *   CRON_SECRET=... node scripts/dpp-outreach/promote-and-enqueue.mjs
 *   CRON_SECRET=... MAX_ENQUEUE=5 node scripts/dpp-outreach/promote-and-enqueue.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessDecisionMaker } from './lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESEARCHED = path.join(__dirname, 'pipeline', 'researched.csv');
const WARM = path.join(__dirname, 'warm-10.csv');
const secret = process.env.CRON_SECRET;
const base = process.env.OUTREACH_WORKER_URL || 'https://authichain.undone-k.workers.dev';
const maxEnqueue = Math.max(1, Math.min(25, Number(process.env.MAX_ENQUEUE || '10')));

if (!secret) {
  console.error('CRON_SECRET required');
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const cols = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const parts = splitCsvLine(line);
    return Object.fromEntries(cols.map((c, i) => [c, (parts[i] || '').trim()]));
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function workerGet(pathName) {
  const res = await fetch(`${base}${pathName}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function workerPost(pathName, payload) {
  const res = await fetch(`${base}${pathName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  if (!fs.existsSync(RESEARCHED)) {
    console.log(JSON.stringify({ ok: true, queued: 0, reason: 'no_researched_csv' }));
    return;
  }

  const statusRes = await workerGet('/admin/outreach/status');
  if (!statusRes.ok) {
    console.error('status failed', statusRes.status, statusRes.body);
    process.exit(1);
  }
  const remaining = Number(statusRes.body?.status?.remainingToday ?? 0);
  const take = Math.min(maxEnqueue, Math.max(0, remaining));

  const rows = parseCsv(fs.readFileSync(RESEARCHED, 'utf8'));
  const verified = [];
  for (const r of rows) {
    if (r.status !== 'verified') continue;
    const gate = await assessDecisionMaker(r, { checkMx: true });
    if (gate.status !== 'allow') continue;
    verified.push(r);
  }

  // Sync warm-10.csv to verified snapshot (human-readable working set)
  const warmHeader = 'company,contact_name,email,role,angle,utm_campaign,status,verification_source';
  const warmLines = [warmHeader];
  for (const r of verified.slice(0, 50)) {
    warmLines.push([
      r.company,
      r.contact_name,
      r.email,
      r.role,
      r.angle || 'EU DPP readiness',
      'dpp_warm_continuous',
      'verified',
      r.verification_source,
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(WARM, warmLines.join('\n') + '\n');

  if (take === 0) {
    console.log(JSON.stringify({
      ok: true,
      queued: 0,
      reason: 'daily_cap_full_or_zero',
      verified: verified.length,
      remaining,
      warmUpdated: true,
    }, null, 2));
    return;
  }

  const batch = verified.slice(0, take).map(r => ({
    email: r.email,
    name: r.contact_name,
    company: r.company,
    industry: r.industry || 'apparel',
    source: `verified_${r.verification_source || 'manual'}`,
  }));

  if (batch.length === 0) {
    console.log(JSON.stringify({
      ok: true,
      queued: 0,
      reason: 'no_verified_decision_makers',
      verified: 0,
      remaining,
      hint: 'Fill pipeline/researched.csv with named DMs + trusted verification_source, then re-run research-dms.mjs',
    }, null, 2));
    return;
  }

  const enq = await workerPost('/admin/outreach/enqueue', { leads: batch });
  console.log(JSON.stringify({
    ok: enq.ok,
    http: enq.status,
    requested: batch.length,
    verified: verified.length,
    remainingBefore: remaining,
    result: enq.body,
    emails: batch.map(b => b.email),
  }, null, 2));

  if (!enq.ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
