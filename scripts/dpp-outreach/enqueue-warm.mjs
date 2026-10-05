#!/usr/bin/env node
/**
 * Enqueue warm-10.csv leads into the Worker outreach queue.
 * Prefer: promote-and-enqueue.mjs (quality-gated). This script still gates locally.
 * Usage: CRON_SECRET=... node scripts/dpp-outreach/enqueue-warm.mjs
 */
import fs from 'node:fs';
import { assessDecisionMaker } from './lib/quality-gate.mjs';

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET required');
  process.exit(1);
}
const base = process.env.OUTREACH_WORKER_URL || 'https://authichain.undone-k.workers.dev';
const csv = fs.readFileSync(new URL('./warm-10.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const [header, ...rows] = csv;
const cols = header.split(',');
const leads = [];
const rejected = [];
for (const line of rows) {
  if (!line.trim() || line.startsWith('EXAMPLE') || line.startsWith(',')) continue;
  const parts = line.split(',');
  const row = Object.fromEntries(cols.map((c, i) => [c, (parts[i] || '').trim()]));
  if (!row.email || !row.email.includes('@')) continue;
  const gate = await assessDecisionMaker(
    {
      email: row.email,
      contact_name: row.contact_name,
      role: row.role || 'Founder',
      verification_source: row.verification_source || 'manual_verified',
    },
    { checkMx: true }
  );
  if (gate.status !== 'allow') {
    rejected.push({ email: row.email, reasons: gate.reasons });
    continue;
  }
  leads.push({
    email: row.email,
    name: row.contact_name,
    company: row.company || undefined,
    industry: row.industry || 'apparel',
    source: `warm_${row.verification_source || 'manual_verified'}`,
  });
}
if (leads.length === 0) {
  console.log(JSON.stringify({ ok: true, queued: 0, rejected, hint: 'Use add-dm.mjs then promote-and-enqueue.mjs' }, null, 2));
  process.exit(0);
}
const res = await fetch(`${base}/admin/outreach/enqueue`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ leads }),
});
console.log(await res.text());
if (rejected.length) console.error(JSON.stringify({ rejected }, null, 2));
