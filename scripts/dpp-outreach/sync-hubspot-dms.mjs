#!/usr/bin/env node
/**
 * Pull HubSpot contacts → quality-gate → pipeline/researched.csv (+ optional Worker enqueue).
 *
 * Auth: HUBSPOT_SERVICE_KEY (pat-…) from env or ~/.config/authichain/integrations.env
 *
 * Usage:
 *   node scripts/dpp-outreach/sync-hubspot-dms.mjs
 *   ENQUEUE=1 CRON_SECRET=… MAX_ENQUEUE=10 node scripts/dpp-outreach/sync-hubspot-dms.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { assessDecisionMaker, isRoleInbox, isNamedHuman } from './lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'pipeline', 'researched.csv');
const HEADER = [
  'company', 'domain', 'contact_name', 'role', 'email', 'linkedin_url', 'industry',
  'angle', 'verification_source', 'status', 'gate_reasons', 'linkedin_query',
  'research_notes', 'updated_at',
];

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const integ = {
  ...loadEnvFile(path.join(homedir(), '.config/authichain/integrations.env')),
  ...loadEnvFile(path.join(__dirname, '../../.env.local')),
  ...process.env,
};
const token = integ.HUBSPOT_SERVICE_KEY || integ.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token || !String(token).startsWith('pat-')) {
  console.error('HUBSPOT_SERVICE_KEY (pat-…) required');
  process.exit(1);
}

function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  const py = `import csv,json,sys
with open(sys.argv[1], newline='') as f: print(json.dumps(list(csv.DictReader(f))))`;
  const r = spawnSync('python3', ['-c', py, file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout || '[]');
}

function writeCsv(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify({ header: HEADER, rows });
  const py = `import csv,json,sys
data=json.load(sys.stdin)
with open(sys.argv[1],'w',newline='') as f:
  w=csv.DictWriter(f, fieldnames=data['header'], extrasaction='ignore')
  w.writeheader()
  for r in data['rows']:
    w.writerow({h:r.get(h,'') for h in data['header']})`;
  const r = spawnSync('python3', ['-c', py, file], { input: payload, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}

/** Prefer Python urllib — Node fetch to HubSpot often ETIMEDOUT in this env. */
function fetchAllContacts() {
  const props = [
    'email', 'firstname', 'lastname', 'jobtitle', 'company',
    'lifecyclestage', 'hs_lead_status', 'website', 'city', 'state',
  ].join(',');
  const py = `
import json, urllib.request, urllib.parse, ssl, os
token=os.environ['HS_TOKEN']
props=${JSON.stringify(props)}
allc=[]; after=None; ctx=ssl.create_default_context()
for _ in range(30):
  q={'limit':'100','properties':props}
  if after: q['after']=after
  url='https://api.hubapi.com/crm/v3/objects/contacts?'+urllib.parse.urlencode(q)
  req=urllib.request.Request(url, headers={'Authorization':f'Bearer {token}'})
  with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
    data=json.load(r)
  allc.extend(data.get('results',[]))
  after=(data.get('paging') or {}).get('next',{}).get('after')
  if not after: break
print(json.dumps(allc))
`;
  const r = spawnSync('python3', ['-c', py], {
    encoding: 'utf8',
    env: { ...process.env, HS_TOKEN: token },
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`hubspot fetch failed: ${r.stderr}`);
  return JSON.parse(r.stdout || '[]');
}

function industryGuess(company, title) {
  const blob = `${company} ${title}`.toLowerCase();
  if (/cannabis|lume|c3|stiiizy|weed|thc/.test(blob)) return 'cannabis';
  if (/pharma|moderna|novartis|health/.test(blob)) return 'pharma';
  if (/lvmh|hermes|chanel|rolex|kering|richemont|vuitton|luxury|bulgari|sephora/.test(blob)) {
    return 'luxury';
  }
  if (/apparel|nike|patagonia|gymshark|asket|fashion/.test(blob)) return 'apparel';
  return 'general';
}

function angleFor(industry, company) {
  if (industry === 'luxury' || industry === 'apparel') {
    return `EU DPP / authenticity for ${company}`;
  }
  if (industry === 'cannabis') {
    return `Counterfeit / METRC-adjacent authenticity for ${company}`;
  }
  if (industry === 'pharma') {
    return `Lot provenance / authentication for ${company}`;
  }
  return `Product authentication for ${company}`;
}

async function main() {
  const contacts = fetchAllContacts();
  const now = new Date().toISOString();
  const existing = readCsv(OUT);
  const byEmail = new Map(
    existing.filter(r => r.email).map(r => [String(r.email).toLowerCase(), r])
  );

  let verified = 0;
  let rejected = 0;
  let skipped = 0;
  const verifiedLeads = [];

  for (const c of contacts) {
    const p = c.properties || {};
    const email = String(p.email || '').trim().toLowerCase();
    if (!email) { skipped++; continue; }
    if (email.endsWith('@hubspot.com') || email.endsWith('@authichain.com')) {
      skipped++;
      continue;
    }
    if (/sample contact/i.test(`${p.firstname} ${p.lastname}`)) { skipped++; continue; }

    const name = [p.firstname, p.lastname].filter(Boolean).join(' ').trim();
    const title = (p.jobtitle || '').trim();
    const company = (p.company || '').trim() || email.split('@')[1] || '';
    const domain = email.split('@')[1] || '';
    const industry = industryGuess(company, title);

    // Soft skip obvious department inboxes before gate
    if (isRoleInbox(email) || !isNamedHuman(name)) {
      rejected++;
      continue;
    }

    const lead = {
      company,
      domain,
      contact_name: name,
      role: title || 'Decision Maker',
      email,
      linkedin_url: '',
      industry,
      angle: angleFor(industry, company),
      verification_source: 'hubspot_crm',
      status: 'candidate',
      gate_reasons: '',
      linkedin_query: '',
      research_notes: `HubSpot contact ${c.id}; stage=${p.lifecyclestage || ''}; lead_status=${p.hs_lead_status || ''}`,
      updated_at: now,
    };

    const gate = await assessDecisionMaker(lead, { checkMx: true });
    if (gate.status !== 'allow') {
      lead.status = 'rejected';
      lead.gate_reasons = gate.reasons.join('|');
      rejected++;
      byEmail.set(email, lead);
      continue;
    }
    lead.status = 'verified';
    verified++;
    byEmail.set(email, lead);
    verifiedLeads.push(lead);
  }

  // Keep non-email research stubs from existing
  for (const r of existing) {
    if (!r.email) {
      const key = `n:${(r.company || '').toLowerCase()}|${(r.contact_name || '').toLowerCase()}`;
      if (![...byEmail.values()].some(
        x => !x.email && (x.company || '').toLowerCase() === (r.company || '').toLowerCase()
          && (x.contact_name || '').toLowerCase() === (r.contact_name || '').toLowerCase()
      )) {
        byEmail.set(key, r);
      }
    }
  }

  const rows = [...byEmail.values()].sort((a, b) =>
    String(a.company).localeCompare(String(b.company))
    || String(a.email).localeCompare(String(b.email))
  );
  writeCsv(OUT, rows);

  const summary = {
    ok: true,
    hubspotContacts: contacts.length,
    verified,
    rejected,
    skipped,
    pipelineRows: rows.length,
  };

  if (process.env.ENQUEUE === '1') {
    const secret = process.env.CRON_SECRET || integ.CRON_SECRET;
    if (!secret) throw new Error('CRON_SECRET required for ENQUEUE=1');
    const base = process.env.OUTREACH_WORKER_URL || 'https://authichain.undone-k.workers.dev';
    const max = Math.max(1, Math.min(25, Number(process.env.MAX_ENQUEUE || '10')));

    // Prefer cannabis + luxury digital/ops over random CEOs for day-1
    const priority = (l) => {
      let s = 0;
      if (l.industry === 'cannabis') s += 30;
      if (l.industry === 'luxury' || l.industry === 'apparel') s += 20;
      if (l.industry === 'pharma') s += 10;
      if (/digital|operations|compliance|product|founder|ceo|coo|cmo|retail/i.test(l.role)) s += 15;
      if (/chairman|chairperson/i.test(l.role)) s -= 5; // harder to reach
      return s;
    };
    const batch = [...verifiedLeads].sort((a, b) => priority(b) - priority(a)).slice(0, max);
    const res = await fetch(`${base}/admin/outreach/enqueue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leads: batch.map(l => ({
          email: l.email,
          name: l.contact_name,
          company: l.company,
          industry: l.industry,
          source: 'hubspot_crm',
        })),
      }),
    });
    summary.enqueue = { http: res.status, body: await res.json().catch(() => null), emails: batch.map(b => b.email) };
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
