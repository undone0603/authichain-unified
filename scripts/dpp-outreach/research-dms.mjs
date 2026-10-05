#!/usr/bin/env node
/**
 * Daily decision-maker research tick.
 *
 * - Loads targets.csv (companies to research)
 * - Merges/updates pipeline/researched.csv
 * - Optional Apollo people search when APOLLO_API_KEY is set
 * - Runs quality gate + MX on any candidate with an email
 * - Never invents personal emails
 *
 * Usage:
 *   node scripts/dpp-outreach/research-dms.mjs
 *   APOLLO_API_KEY=... node scripts/dpp-outreach/research-dms.mjs --apollo
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  assessDecisionMaker,
  linkedinPeopleQuery,
  normalizeEmail,
} from './lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const TARGETS = path.join(ROOT, 'targets.csv');
const OUT = path.join(ROOT, 'pipeline', 'researched.csv');
const useApollo = process.argv.includes('--apollo') || process.env.APOLLO_API_KEY;

const RESEARCHED_HEADER = [
  'company',
  'domain',
  'contact_name',
  'role',
  'email',
  'linkedin_url',
  'industry',
  'angle',
  'verification_source',
  'status',
  'gate_reasons',
  'linkedin_query',
  'research_notes',
  'updated_at',
];

/** Use Python csv module — hand-rolled JS CSV previously shifted columns. */
function readCsvFile(file) {
  if (!fs.existsSync(file)) return [];
  const py = `
import csv, json, sys
with open(sys.argv[1], newline='') as f:
    print(json.dumps(list(csv.DictReader(f))))
`;
  const r = spawnSync('python3', ['-c', py, file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`csv read failed: ${r.stderr}`);
  return JSON.parse(r.stdout || '[]');
}

function writeCsv(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify({ header: RESEARCHED_HEADER, rows });
  const py = `
import csv, json, sys
data=json.load(sys.stdin)
with open(sys.argv[1], 'w', newline='') as f:
    w=csv.DictWriter(f, fieldnames=data['header'], extrasaction='ignore')
    w.writeheader()
    for r in data['rows']:
        w.writerow({h: r.get(h, '') for h in data['header']})
`;
  const r = spawnSync('python3', ['-c', py, file], { input: payload, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`csv write failed: ${r.stderr}`);
}

function parseCsv(text) {
  // Kept for targets.csv small files; prefer readCsvFile for researched.csv
  const tmp = path.join(ROOT, 'pipeline', '.tmp-parse.csv');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, text);
  try {
    return readCsvFile(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function loadResearched() {
  return readCsvFile(OUT);
}

function rowKey(r) {
  const email = normalizeEmail(r.email);
  if (email) return `e:${email}`;
  const company = String(r.company || '').toLowerCase();
  const domain = String(r.domain || '').toLowerCase();
  const name = String(r.contact_name || '').toLowerCase().trim();
  // Named DM stubs must not collide with company-only stubs
  if (name) return `n:${company}|${domain}|${name}`;
  return `c:${company}|${domain}`;
}

async function apolloSearchCompany(domain, titles) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return [];
  const titleList = String(titles || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  const body = {
    q_organization_domains: domain ? [domain] : undefined,
    person_titles: titleList.length ? titleList : [
      'founder',
      'head of sustainability',
      'compliance director',
      'vp operations',
      'product director',
    ],
    person_seniorities: ['founder', 'c_suite', 'vp', 'director', 'head', 'owner'],
    per_page: 5,
    page: 1,
  };
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.warn(`[apollo] ${domain} HTTP ${res.status}: ${t.slice(0, 160)}`);
    return [];
  }
  const data = await res.json();
  const people = data.people || data.contacts || [];
  return people.map(p => {
    const email = (p.email || '').trim();
    const locked = /^email_not_unlocked@/i.test(email);
    const status = p.email_status;
    let verification_source = 'unknown';
    if (!locked && status === 'verified' && email) verification_source = 'apollo_verified';
    else if (!locked && email) verification_source = 'unknown';
    return {
      contact_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '',
      role: p.title || '',
      email: locked ? '' : email,
      linkedin_url: p.linkedin_url || '',
      verification_source,
      research_notes: `apollo status=${status || 'n/a'}`,
    };
  });
}

async function main() {
  const targets = parseCsv(fs.readFileSync(TARGETS, 'utf8'));
  const existing = loadResearched();
  const byKey = new Map(existing.map(r => [rowKey(r), r]));
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let apolloHits = 0;

  for (const t of targets) {
    if (!t.company) continue;
    const titles = String(t.icp_titles || '');
    const base = {
      company: t.company,
      domain: t.domain,
      industry: t.industry,
      angle: t.angle,
      linkedin_query: linkedinPeopleQuery(t.company, titles.split(';').map(s => s.trim())),
      research_notes: t.research_notes || '',
      updated_at: now,
    };

    // Ensure a company-level research stub exists only if we have no rows for this company yet
    const hasCompanyRow = [...byKey.values()].some(
      r => String(r.company || '').toLowerCase() === t.company.toLowerCase()
    );
    if (!hasCompanyRow) {
      const stubKey = `c:${t.company.toLowerCase()}|${String(t.domain || '').toLowerCase()}`;
      byKey.set(stubKey, {
        ...base,
        contact_name: '',
        role: titles.split(';')[0]?.trim() || '',
        email: '',
        linkedin_url: '',
        verification_source: '',
        status: 'needs_research',
        gate_reasons: 'awaiting_named_dm',
      });
      created++;
    }

    if (useApollo && t.domain) {
      const people = await apolloSearchCompany(t.domain, titles);
      for (const p of people) {
        if (!p.contact_name) continue;
        apolloHits++;
        const row = {
          ...base,
          contact_name: p.contact_name,
          role: p.role,
          email: p.email,
          linkedin_url: p.linkedin_url,
          verification_source: p.verification_source || 'unknown',
          research_notes: [base.research_notes, p.research_notes].filter(Boolean).join(' | '),
          status: p.email ? 'candidate' : 'needs_research',
          gate_reasons: p.email ? '' : 'apollo_no_email_unlocked',
          updated_at: now,
        };
        if (row.email) {
          const gate = await assessDecisionMaker(row, { checkMx: true });
          row.status = gate.status === 'allow' ? 'verified' : 'rejected';
          row.gate_reasons = gate.reasons.join('|');
        }
        byKey.set(rowKey(row), row);
        updated++;
      }
    }
  }

  // Re-score every row that has an email
  for (const [k, row] of byKey) {
    if (!row.email) {
      if (row.status !== 'needs_research' && row.status !== 'verified') {
        row.status = 'needs_research';
        row.gate_reasons = row.gate_reasons || 'missing_email';
      }
      continue;
    }
    const gate = await assessDecisionMaker(row, { checkMx: true });
    const next = gate.status === 'allow' ? 'verified' : 'rejected';
    if (row.status !== next || row.gate_reasons !== gate.reasons.join('|')) {
      row.status = next;
      row.gate_reasons = gate.reasons.join('|');
      row.updated_at = now;
      updated++;
    }
    byKey.set(k, row);
  }

  const rows = [...byKey.values()].sort((a, b) =>
    String(a.company).localeCompare(String(b.company)) ||
    String(a.email).localeCompare(String(b.email))
  );
  writeCsv(OUT, rows);

  const counts = rows.reduce((acc, r) => {
    acc[r.status || 'unknown'] = (acc[r.status || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    ok: true,
    targets: targets.length,
    rows: rows.length,
    created,
    updated,
    apollo: Boolean(useApollo && process.env.APOLLO_API_KEY),
    apolloHits,
    counts,
    out: OUT,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
