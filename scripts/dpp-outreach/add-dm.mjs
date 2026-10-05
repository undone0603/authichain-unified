#!/usr/bin/env node
/**
 * Add a researched decision-maker into pipeline/researched.csv and re-score.
 *
 * Usage:
 *   node scripts/dpp-outreach/add-dm.mjs \
 *     --company "Asket" --domain asket.com \
 *     --name "Jane Doe" --role "Head of Sustainability" \
 *     --email jane.doe@asket.com \
 *     --source published_contact \
 *     --angle "EU textile DPP readiness" \
 *     --notes "Email listed on sustainability page 2026-09"
 *
 * Trusted sources: apollo_verified | published_contact | manual_verified |
 *                  reacher_verified | inbound_optin | confirmed_reply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assessDecisionMaker, TRUSTED_SOURCES } from './lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'pipeline', 'researched.csv');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return '';
  return process.argv[i + 1] || '';
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { cols: [], rows: [] };
  const cols = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    // simple split — add-dm writes escaped fields without embedded commas in critical fields
    const parts = line.match(/("([^"]|"")*"|[^,]*)/g)?.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
    // fallback naive
    const naive = line.split(',');
    const use = parts.length >= cols.length ? parts : naive;
    return Object.fromEntries(cols.map((c, i) => [c, (use[i] || '').trim()]));
  });
  return { cols, rows };
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const lead = {
  company: arg('company'),
  domain: arg('domain'),
  contact_name: arg('name'),
  role: arg('role'),
  email: arg('email'),
  linkedin_url: arg('linkedin'),
  industry: arg('industry') || 'apparel',
  angle: arg('angle') || 'EU DPP readiness audit',
  verification_source: arg('source') || 'manual_verified',
  research_notes: arg('notes'),
  linkedin_query: '',
  updated_at: new Date().toISOString(),
};

if (!lead.company || !lead.contact_name || !lead.email || !lead.role) {
  console.error('Required: --company --name --role --email [--source] [--domain] [--notes]');
  process.exit(1);
}
if (!TRUSTED_SOURCES.has(lead.verification_source)) {
  console.error('Invalid --source. Trusted:', [...TRUSTED_SOURCES].join(', '));
  process.exit(1);
}

const gate = await assessDecisionMaker(lead, { checkMx: true });
lead.status = gate.status === 'allow' ? 'verified' : 'rejected';
lead.gate_reasons = gate.reasons.join('|');

const header = [
  'company', 'domain', 'contact_name', 'role', 'email', 'linkedin_url', 'industry',
  'angle', 'verification_source', 'status', 'gate_reasons', 'linkedin_query',
  'research_notes', 'updated_at',
];

let rows = [];
if (fs.existsSync(OUT)) {
  rows = parseCsv(fs.readFileSync(OUT, 'utf8')).rows;
}
rows = rows.filter(r => String(r.email || '').toLowerCase() !== lead.email.toLowerCase());
rows.push(lead);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  [header.join(','), ...rows.map(r => header.map(h => csvEscape(r[h] ?? '')).join(','))].join('\n') + '\n'
);

console.log(JSON.stringify({ ok: true, lead, gate }, null, 2));

// Re-run research scorer to normalize file
spawnSync(process.execPath, [path.join(__dirname, 'research-dms.mjs')], {
  stdio: 'inherit',
  env: process.env,
});
