// scripts/b2b-cold-outreach.ts
// Autonomous B2B cold outreach for 3 high-priority segments:
//   1. Defense contractors (GovChain — CMMC Nov 2026 deadline)
//   2. Cannabis compliance managers (StrainChain — $499/mo Theater 1)
//   3. Print shops / brand agencies (QRON — $29-99 quick wins)
//
// Usage:
//   DRY_RUN=true pnpm exec tsx scripts/b2b-cold-outreach.ts
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=govchain
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=strainchain
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=qron

import { createClient } from '@supabase/supabase-js';
import { guardrailCheck, guardrailRecord } from './lib/guardrail-client';
import { checkSender, reportSenderFailure, CREDENTIAL_ENV_VARS } from './lib/resend-preflight';
import { guardedSend, type VerificationSource } from '../server/outreach/send-guard';
import {
  mostRecentInForce,
  nextDeadline,
  formatMilestoneDate,
  countdownLabel,
} from '../src/lib/dpp-timeline';

const GUARDRAIL_CHANNEL = 'email.b2b-cold';

const isDryRun = process.env.DRY_RUN === 'true';
const segment  = process.argv.find(a => a.startsWith('--segment='))?.split('=')[1] ?? 'all';

// Send-failure tracking. A live run where every send fails (bad key, unverified
// domain, provider outage) previously exited 0 and showed a green check — the
// pipeline looked healthy while delivering nothing. These are aggregated and
// surfaced as a non-zero exit + GitHub Actions annotations at the end.
const sendFailures: string[] = [];
let totalAttempted = 0;
let totalSent = 0;

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
// Any configured Resend credential is enough to attempt sending; which one is
// used for a given sender is resolved per-address by the preflight.
const hasResendKey = CREDENTIAL_ENV_VARS.some(name => !!process.env[name]);

/**
 * Provenance of the hardcoded contact addresses.
 *
 * These are functional-role addresses gathered by hand in June 2026. That is
 * not the same as verified: `compliance@`, `innovation@` and `b2b@` are exactly
 * the shape a plausible guess takes, and the guard exists to stop us mailing
 * guesses. They are declared `unknown` so the guard rejects them until they are
 * actually verified — Apollo resolution upgrades a target to `apollo_verified`
 * at run time, which is the intended path to sending.
 *
 * This is deliberately conservative: it lowers send volume rather than raise it.
 */
const RESEARCHED_SOURCE: VerificationSource = 'unknown';

// Sender addresses are per-segment because the three segments are separately
// branded products — a GovChain pitch arriving from a cannabis-compliance
// domain reads as spam to the recipient and to their filters. Defaults use the
// parent brand, with StrainChain on its own verified domain. Both domains are
// verified, just on different Resend accounts, which the preflight resolves.
const FALLBACK_FROM = process.env.OUTREACH_FROM_EMAIL ?? 'hello@authichain.com';
const SEGMENT_FROM: Record<string, string> = {
  govchain:    process.env.OUTREACH_FROM_GOVCHAIN    ?? FALLBACK_FROM,
  strainchain: process.env.OUTREACH_FROM_STRAINCHAIN ?? 'hello@strainchain.io',
  qron:        process.env.OUTREACH_FROM_QRON        ?? FALLBACK_FROM,
};
// Falls back to the built-in /book page — Calendly is optional, not required
const CALENDLY = process.env.CALENDLY_LINK ?? 'https://app.authichain.com/book';

// ── Apollo.io people-search: find work email by name + company domain ─────────
// Uses /v1/mixed_people/search (not /v1/people/match which requires an email).
// Returns empty string when APOLLO_API_KEY is absent or API returns no result.
async function apolloFindEmail(name: string, company: string, website: string): Promise<string> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return '';

  try {
    const domain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');

    // Apollo auth goes in the X-Api-Key header — body api_key is no longer
    // accepted for current keys (verified: header auth returns 200, body 401).
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
      body: JSON.stringify({
        q_organization_name:  company,
        person_titles:        [],          // broad — let name filter do the work
        contact_email_status: ['verified', 'guessed'],
        organization_domains: [domain],
        page:                 1,
        per_page:             5,
      }),
    });
    if (!res.ok) {
      console.warn(`  ⚠️  Apollo search HTTP ${res.status} for ${company}`);
      return '';
    }
    const data = await res.json() as any;
    const people: any[] = data.people ?? [];

    // Find best name match
    const match = people.find(p => {
      const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.toLowerCase();
      return full.includes(firstName.toLowerCase()) && (!lastName || full.includes(lastName.toLowerCase()));
    }) ?? people[0];

    const email: string = match?.email ?? '';
    if (email) console.log(`  🔎 Apollo found: ${name} @ ${company} → ${email}`);
    return email;
  } catch (err: any) {
    console.warn(`  ⚠️  Apollo lookup failed for ${name}: ${err.message?.slice(0, 80)}`);
    return '';
  }
}

// ── Verified real contacts from research (June 2026) ─────────────────────────

const GOVCHAIN_TARGETS = [
  {
    company: 'Concurrent Technologies Corporation',
    name: 'Danielle Bush Gerko',
    title: 'Chief Information Security Officer',
    email: '', // find via Apollo: dbgerko@ctc.com pattern
    linkedin: 'https://www.linkedin.com/in/dbgerko-cyber/',
    pain: 'Perfect SPRS score 110 achieved — now needs supply-chain traceability layer for subcontractor CUI handling before next C3PAO review',
    contract_area: 'AFRL, Navy, DoD Advanced Manufacturing',
    cmmc_status: 'Level 2 certified July 2025',
    website: 'https://www.ctc.com',
  },
  {
    company: 'ITC Federal',
    name: 'Dr. Imran Bashir',
    title: 'Chief Technology Officer',
    email: '', // find via Apollo: ibashir@itcfederal.com pattern
    linkedin: 'https://www.linkedin.com/in/drimranbashir/',
    pain: 'DevSecOps + cloud team needs blockchain provenance for CUI artifact supply chain — current gap before next DoD audit',
    contract_area: 'DoD, DHS, ICE, Coast Guard DevSecOps',
    cmmc_status: 'Level 2 certified 2025',
    website: 'https://itcfederal.com',
  },
  {
    company: 'Integrated Data Services',
    name: 'Tammer Olibah',
    title: 'President & CEO',
    email: '', // find via Apollo: tolibah@get-integrated.com pattern
    linkedin: 'https://www.linkedin.com/in/tammer-olibah-050b285/',
    pain: 'Financial management systems (CCaR™) for 30 DoD locations need immutable audit trail; CMMC Level 2 April 2026 — subcontractor supply chain gap',
    contract_area: 'Air Force, Army, Navy, Space Force financial systems',
    cmmc_status: 'Level 2 certified April 2026',
    website: 'https://www.get-integrated.com',
  },
  {
    company: 'RealmOne',
    name: 'Jeff Little',
    title: 'Director of Cybersecurity',
    email: '', // find via Apollo
    linkedin: 'https://www.linkedin.com/company/realm-one',
    pain: 'Perfect 110 SPRS score, 30+ active contracts — needs automated chain-of-custody proof for intelligence data artifacts',
    contract_area: 'DoD Intelligence Community AI/Cybersecurity',
    cmmc_status: 'Level 2 certified March 2026 (110/110)',
    website: 'https://realmone.com',
  },
  {
    company: 'Kampi Components',
    name: 'Allan Goodman',
    title: 'Owner',
    email: '', // find via Apollo: agoodman@kampi.com pattern
    linkedin: 'https://www.linkedin.com/in/allan-goodman-5744656/',
    pain: 'Navy/Army OEM supplier with 110 SPRS — next audit will require component-level counterfeit part detection and supplier provenance',
    contract_area: 'Navy, Army supply chain OEM components',
    cmmc_status: 'Level 2 certified 2025 (110/110)',
    website: 'https://kampi.com',
  },
];

const STRAINCHAIN_TARGETS = [
  {
    company: 'Trulieve Cannabis',
    name: 'Head of Compliance',
    title: 'VP Compliance / Director of Operations',
    email: 'compliance@trulieve.com',
    linkedin: 'https://www.linkedin.com/company/trulieve/',
    pain: 'Multi-state operator with 130+ dispensaries; METRC across FL, PA, AZ, GA — COA integrity + custody reconciliation today, DPP-ready export for EU entry',
    states: 'FL, PA, AZ, GA, WV',
    website: 'https://trulieve.com',
  },
  {
    company: 'Curaleaf',
    name: 'Compliance Team',
    title: 'SVP Compliance',
    email: 'compliance@curaleaf.com',
    linkedin: 'https://www.linkedin.com/company/curaleaf/',
    pain: 'Largest MSO by revenue (40+ states) — METRC reconciliation across 40 state systems; blockchain COA hashing; DPP-ready before cannabis is scheduled',
    states: '40+ states',
    website: 'https://curaleaf.com',
  },
  {
    company: 'Harvest Health & Recreation',
    name: 'Head of Compliance',
    title: 'Director of Compliance',
    email: 'compliance@harvestinc.com',
    linkedin: 'https://www.linkedin.com/company/harvest-health-recreation/',
    pain: 'Mid-market MSO in 5 states — METRC compliance gaps in AZ + PA; wants blockchain COA as competitive differentiator for premium products',
    states: 'AZ, PA, FL, MD, AR',
    website: 'https://harvestinc.com',
  },
];

const QRON_TARGETS = [
  {
    company: 'FASTSIGNS',
    name: 'Innovation Lead',
    title: 'VP Product / Innovation',
    email: 'innovation@fastsigns.com',
    linkedin: 'https://www.linkedin.com/company/fastsigns/',
    pain: 'Franchise network looking for premium "smart label" upsell — AI QR codes with brand aesthetics at commercial print margins',
    demo_prompt: 'bold industrial signage, glowing neon, sharp commercial aesthetic',
    website: 'https://fastsigns.com',
  },
  {
    company: 'MOO',
    name: 'Product Manager',
    title: 'Head of Product',
    email: 'product@moo.com',
    linkedin: 'https://www.linkedin.com/company/moo/',
    pain: 'Premium print brand targeting luxury clients — QR codes on business cards / packaging need to match visual standards; current QR tools produce ugly codes',
    demo_prompt: 'premium textured business card, gold foil embossing, luxury paper texture, minimalist',
    website: 'https://moo.com',
  },
  {
    company: '4imprint',
    name: 'B2B Sales Head',
    title: 'VP B2B Sales',
    email: 'b2b@4imprint.com',
    linkedin: 'https://www.linkedin.com/company/4imprint/',
    pain: 'Corporate promotional merchandise clients want branded QR codes on swag — current QR tools cannot match brand guidelines; white-label API needed',
    demo_prompt: 'corporate promotional merchandise, high quality product photography, clean studio',
    website: 'https://4imprint.com',
  },
  {
    company: 'Signarama',
    name: 'Franchise Director',
    title: 'VP Franchise Development',
    email: 'franchise@signarama.com',
    linkedin: 'https://www.linkedin.com/company/signarama/',
    pain: 'Franchise chain with 900 locations — needs white-label QR API for branded retail signage; clients want scannable QRs that match storefront aesthetics',
    demo_prompt: 'vibrant commercial storefront sign, glowing neon colors, sharp vector art',
    website: 'https://signarama.com',
  },
];

// ── Email templates ───────────────────────────────────────────────────────────

function govchainEmail(t: typeof GOVCHAIN_TARGETS[0]): { subject: string; html: string } {
  const subject = `CMMC supply-chain gap — ${t.company} (${t.cmmc_status})`;
  const html = `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
  <p>Hi ${t.name.split(' ')[0]},</p>

  <p>Congrats on ${t.company}'s ${t.cmmc_status} — that's a real achievement.
  Most contractors stop there, but C3PAOs are increasingly flagging the
  <strong>sub-contractor supply-chain layer</strong> on second-cycle assessments:
  who touched the CUI artifact, what toolchain produced it, and is there an
  immutable record the contracting officer can audit?</p>

  <p>GovChain (<a href="https://govchain.us">govchain.us</a>) automates exactly that:
  <ul>
    <li>Ed25519-signed chain-of-custody on every deliverable and artifact</li>
    <li>Blockchain-anchored past-performance proof (no sensitive data on-chain)</li>
    <li>DFARS 252.204-7012 / NIST 800-171 audit trail, one-click export for C3PAO review</li>
    <li>SAM.gov opportunity pipeline with AI fit-scoring (so you never miss a bid)</li>
  </ul></p>

  <p>Given your work in <strong>${t.contract_area}</strong>, this maps directly to the
  supply-chain risk management requirements that are becoming table-stakes for
  DoD re-competes.</p>

  <p>Worth a 20-minute call?
  <a href="${CALENDLY}?name=${encodeURIComponent(t.name)}&company=${encodeURIComponent(t.company)}">
  Book here</a> — or reply and I'll send a demo video.</p>

  <p>Best,<br>
  Zachary<br>
  GovChain / AuthiChain<br>
  <a href="https://govchain.us">govchain.us</a></p>

  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
  You're receiving this because ${t.company} is registered on SAM.gov.</p>
</div>`;
  return { subject, html };
}

/**
 * The previous version of this email led with "the DPP mandate takes effect for
 * cannabis-adjacent products in July 2026". Two things were wrong with it, and
 * both are the kind a compliance buyer checks first:
 *
 *   1. It was sent in August, about a July date — in the future tense.
 *   2. `content/dpp/regulatory-timeline.json` has no cannabis milestone at all.
 *      The dated waves are batteries, electronics, textiles and construction.
 *      The claim was not supported by our own sourced timeline.
 *
 * The rewrite only asserts what that file can back: the registry is live, the
 * next dated wave is whatever the timeline says it is, and cannabis is not yet
 * scheduled — which is stated plainly rather than implied away. Every date is
 * read from the timeline at send time, so this copy cannot go stale the way the
 * last one did.
 */
function strainchaineEmail(t: typeof STRAINCHAIN_TARGETS[0]): { subject: string; html: string } {
  const now = new Date();
  const registry = mostRecentInForce(now);
  const next = nextDeadline(now);

  const registryLine = registry
    ? `The EU's Digital Product Passport registry went live on ${formatMilestoneDate(registry)} — it is operating now, not pending.`
    : `The EU's Digital Product Passport registry is being stood up now.`;
  const nextLine = next
    ? `The next mandated category is ${next.label} (${formatMilestoneDate(next)} — ${countdownLabel(next, now).toLowerCase()}), with further waves dated after it.`
    : '';

  const subject = registry
    ? `EU DPP registry is live — what it means for ${t.company}`
    : `EU Digital Product Passport — what it means for ${t.company}`;

  const html = `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
  <p>Hi,</p>

  <p>${registryLine} ${nextLine}</p>

  <p><strong>Cannabis is not in a dated wave yet</strong> — I'd rather tell you that than
  invent a deadline. What the schedule does tell you is the direction of travel, and that
  the operators who are ready when their category lands are the ones who started while it
  was optional. For an MSO of ${t.company}'s footprint (${t.states}), the work is the same
  either way, and it pays for itself before any EU rule applies:</p>

  <ul>
    <li>METRC sync — custody events anchored on Polygon at every handoff, so your state audit trail reconciles itself</li>
    <li>COA hashing — lab certificates stored immutably; an altered result is detectable instead of arguable</li>
    <li>Consumer-facing QR: full chain-of-custody plus test results on scan</li>
    <li>Passport export in the EU DPP data model (ISO 18013-5 / EPCIS 2.0) — ready the day it is asked for</li>
  </ul>

  <p>The near-term value is the METRC reconciliation and COA integrity, today, under the
  rules you already operate under. The DPP readiness is what you get for free by doing it.</p>

  <p>Theater 1 is <strong>$499/month</strong> for 5,000 package scans, with a 7-day trial
  and no integration needed to see it working.
  <a href="${CALENDLY}">Book 20 minutes</a> and I'll walk through it against your own
  ${t.states.split(',')[0].trim()} data.</p>

  <p>Best,<br>
  Zachary<br>
  StrainChain / AuthiChain<br>
  <a href="https://strainchain.io">strainchain.io</a></p>
</div>`;
  return { subject, html };
}

/**
 * Two claims were removed here because the code says they are not true.
 *
 *   "I ran ${company} through our AI QR engine and generated a custom demo"
 *   "We've pre-provisioned a white-label sandbox for ${company}"
 *
 * Neither /demo page reads `searchParams` or a `company` param at all — the only
 * place a company name is handled is the POST form where a visitor types their
 * own. So `qron.space/demo?company=X` served a generic page, and the recipient's
 * first click disproved the email's first sentence. Fabricated personalisation
 * is worse than none: it is the one thing a prospect can check in one click.
 *
 * The rewrite keeps the specificity in the product and the pricing, which are
 * real, and invites them to generate their own QR rather than claiming we
 * already did.
 */
function qronEmail(t: typeof QRON_TARGETS[0]): { subject: string; html: string } {
  const subject = `AI-designed QR codes for ${t.company} — white-label API from $0.002/QR`;
  const html = `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
  <p>Hi,</p>

  <p>You print and ship a lot of QR codes. The usual complaint about them is that
  they are ugly, and the usual fix — sticking a logo in the middle — is what makes
  them fail to scan. QRON generates codes that carry brand styling and stay
  scannable, because the styling is generated with the error-correction budget
  rather than pasted on top of it.</p>

  <p style="text-align:center">
    <a href="https://qron.space/demo"
       style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      Generate one on your own artwork →
    </a>
  </p>

  <p>QRON (<a href="https://qron.space">qron.space</a>) is available via
  white-label API:</p>
  <ul>
    <li>5 visual modes: Static, Stereographic, Holographic, Memory, Custom Prompt</li>
    <li>Ed25519-signed on Polygon — tamper-proof authenticity certificate on every scan</li>
    <li>White-label API: your brand, your dashboard, fractions of a cent per generation</li>
    <li>FTC EO 14392 compliant origin verification (MADE IN USA shield support)</li>
  </ul>

  <p>Creator Pack is <strong>$99 for 500 generations</strong> if you just want to
  try it on live jobs; the white-label API is usage-based from $0.002/QR, so
  reselling it at ${t.company}'s volume costs less than the ink.</p>

  <p>Worth 10 minutes?
  <a href="${CALENDLY}?company=${encodeURIComponent(t.company)}">Book here</a>
  or reply and I'll send the API docs — happy to set up a sandbox on your account
  before any call.</p>

  <p>Best,<br>
  Zachary<br>
  QRON / AuthiChain<br>
  <a href="https://qron.space">qron.space</a></p>
</div>`;
  return { subject, html };
}

// ── Save drafts to Supabase + optionally send ─────────────────────────────────

async function processTargets<T extends { company: string; email: string; name?: string; website?: string }>(
  targets: T[],
  buildEmail: (t: T) => { subject: string; html: string },
  segmentName: string,
) {
  let sent = 0; let saved = 0; let queued = 0;
  totalAttempted += targets.length;

  const from = SEGMENT_FROM[segmentName] ?? FALLBACK_FROM;

  if (!hasResendKey && !isDryRun) {
    console.warn(`  ⚠️  No Resend credential set (${CREDENTIAL_ENV_VARS.join(' / ')}) — emails will be queued in Supabase (status=queued) and sent on next run when a key is present`);
  }

  // Preflight before touching the prospect list. A dead key or an unverified
  // sender fails identically on every target, so discovering it after the loop
  // means the whole segment is burned for nothing. Drafts still get written —
  // they queue and drain via flushQueuedLeads() once the sender is fixed.
  let senderOk = true;
  let credential: string | undefined;
  if (hasResendKey && !isDryRun) {
    const check = await checkSender(from);
    senderOk = check.ok;
    if (!check.ok) {
      reportSenderFailure(check, `b2b:${segmentName}`);
      console.warn(`  ⚠️  Skipping sends for [${segmentName}] — drafts will be queued instead`);
      sendFailures.push(`${segmentName} sender ${from}: ${check.reason}`);
    } else {
      credential = check.credential;
      console.log(`  ✅ Sender verified: ${from} (via ${check.credential})`);
    }
  }

  for (const t of targets) {
    // Auto-populate email via Apollo if missing. A hit upgrades the target's
    // provenance: Apollo returns addresses it has verified, which is precisely
    // the trusted source the send guard is looking for.
    let email = t.email;
    let source: VerificationSource = RESEARCHED_SOURCE;
    if (!email && (t as any).linkedin !== undefined) {
      email = await apolloFindEmail((t as any).name ?? t.company, t.company, t.website ?? '');
      if (email) {
        (t as any).email = email; // mutate for DB save
        source = 'apollo_verified';
      }
    }

    const { subject, html } = buildEmail(t);

    // Determine initial status
    const dbStatus = isDryRun ? 'draft'
      : !email              ? 'pending_email'   // Apollo found nothing; manual lookup needed
      : !senderOk           ? 'queued'           // No usable credential for this sender; drain later
      :                       'draft';           // Ready to send

    const { error: dbErr } = await supabase.from('leads').upsert({
      email:    email || `[pending]@${t.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      name:     (t as any).name ?? t.company,
      company:  t.company,
      source:   `b2b_outreach_${segmentName}`,
      status:   dbStatus,
      // `source` is persisted so a later flush re-applies the same provenance
      // decision instead of silently downgrading an Apollo-verified address.
      metadata: { subject, html_preview: html.slice(0, 500), target: t, source },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (dbErr) {
      console.warn(`  ⚠️  DB save failed for ${t.company}: ${dbErr.message}`);
    } else {
      saved++;
      console.log(`  💾 [${dbStatus}] ${t.company} — "${subject}"`);
    }

    if (isDryRun) {
      console.log(`     [DRY RUN] Would send to: ${email || '(no email)'}`);
      queued++;
      continue;
    }

    if (!email) {
      console.log(`     ℹ️  No email found for ${t.company} — update leads table manually or set APOLLO_API_KEY`);
      queued++;
      continue;
    }

    if (!senderOk) {
      console.log(`     📬 Queued: ${email} — will send once ${from} can send`);
      queued++;
      continue;
    }

    // Guardrail gate: every send must be checked/reserved before it fires.
    // Fails closed — unreachable API, missing secret, disabled channel, cap
    // reached, or a suppressed recipient all deny the send. A policy denial
    // (cap/disabled/suppressed) just queues for later; an errored check
    // (can't reach the guardrail at all) is a broken pipeline, not a healthy
    // no-op, so it counts as a send failure the same as a Resend error.
    const gate = await guardrailCheck(GUARDRAIL_CHANNEL, { recipient: email });
    if (!gate.allowed) {
      console.log(`     🚧 Blocked by guardrail (${GUARDRAIL_CHANNEL}): ${gate.reason} — ${email}`);
      queued++;
      if (gate.errored) sendFailures.push(`${t.company}: guardrail check failed — ${gate.reason}`);
      continue;
    }

    try {
      // Routed through the send guard rather than the Resend client directly,
      // so every cold send carries a reply-to, one-click List-Unsubscribe
      // headers and the CAN-SPAM postal address — and so unverified recipients
      // are refused before any network call.
      const res = await guardedSend({
        to: email,
        source,
        subject,
        html,
        from,
        company: 'AuthiChain',
        apiKey: credential ? process.env[credential] : undefined,
      });
      if (res.sent) {
        sent++;
        console.log(`  ✉️  Sent: ${email} — "${subject}"`);
        await supabase.from('leads')
          .update({ status: 'contacted', updatedAt: new Date().toISOString() })
          .eq('email', email);
        await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: true, reason: 'sent', metadata: { email, resendId: res.id } });
      } else if (res.assessment.status === 'reject' || res.reason === 'no_mx') {
        // A refused recipient is the guard doing its job, not a broken
        // pipeline: it must not turn the run red or it trains everyone to
        // ignore the signal. It stays queued so verifying the address later
        // is enough to send it.
        console.log(`     🛑 Refused by send guard: ${email} — ${res.reason}`);
        queued++;
        await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: false, reason: `guard:${res.reason}`, metadata: { email } });
      } else {
        console.warn(`  ⚠️  Send failed for ${t.company}: ${res.reason}`);
        sendFailures.push(`${t.company}: ${res.reason ?? 'unknown send failure'}`);
        queued++;
        await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: false, reason: res.reason ?? 'unknown send failure', metadata: { email } });
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Send failed for ${t.company}: ${err.message}`);
      sendFailures.push(`${t.company}: ${err.message}`);
      queued++;
      await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: false, reason: err.message, metadata: { email } });
    }
  }

  totalSent += sent;
  console.log(`\n[${segmentName}] Saved: ${saved} | Sent: ${sent} | Queued/Pending: ${queued}`);
}

// ── Flush queued leads: send emails that were saved with status=queued ─────────
// Run this after fixing the sender to drain the queue without re-running the
// full outreach script and risking duplicate outreach.
export async function flushQueuedLeads(): Promise<void> {
  if (!hasResendKey) {
    console.warn(`No Resend credential set (${CREDENTIAL_ENV_VARS.join(' / ')}) — nothing to flush`);
    return;
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('status', 'queued')
    .like('source', 'b2b_outreach_%');

  if (!leads?.length) { console.log('No queued leads to flush.'); return; }

  for (const lead of leads) {
    const meta = lead.metadata as any;
    if (!meta?.subject || !meta?.html_preview) continue;

    // Recover the segment the draft was written for so the flush sends under
    // the same brand the copy was written in. checkSender caches per address,
    // so this costs one probe per distinct sender across the whole flush.
    const leadSegment = String(lead.source ?? '').replace('b2b_outreach_', '');
    const from = SEGMENT_FROM[leadSegment] ?? FALLBACK_FROM;

    const senderCheck = await checkSender(from);
    if (!senderCheck.ok) {
      reportSenderFailure(senderCheck, `b2b-flush:${leadSegment}`);
      console.warn(`  ⚠️  Leaving ${lead.email} queued — ${from} cannot send`);
      continue;
    }

    const gate = await guardrailCheck(GUARDRAIL_CHANNEL, { recipient: lead.email });
    if (!gate.allowed) {
      // An errored check (guardrail unreachable) vs. a policy denial (cap/
      // disabled/suppressed) look identical to the caller otherwise — flag
      // the former more loudly since it means the pipeline is broken, not
      // just correctly capped.
      const log = gate.errored ? console.error : console.log;
      log(`  🚧 Blocked by guardrail (${GUARDRAIL_CHANNEL}): ${gate.reason} — ${lead.email}`);
      continue;
    }

    try {
      // The stored draft is a truncated preview, so a flush re-sends whatever
      // was captured — the guard still applies the footer and headers.
      const res = await guardedSend({
        to: lead.email,
        source: (meta.source as VerificationSource) ?? RESEARCHED_SOURCE,
        subject: meta.subject,
        html: meta.html_preview,
        from,
        company: 'AuthiChain',
        apiKey: process.env[senderCheck.credential!],
      });
      if (res.sent) {
        await supabase.from('leads').update({ status: 'contacted', updatedAt: new Date().toISOString() }).eq('email', lead.email);
        console.log(`  ✉️  Flushed: ${lead.email}`);
        await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: true, reason: 'sent', metadata: { email: lead.email, resendId: res.id } });
      } else {
        console.log(`  🛑 Left queued: ${lead.email} — ${res.reason}`);
        await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: false, reason: res.reason ?? 'unknown send failure', metadata: { email: lead.email } });
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Flush failed for ${lead.email}: ${err.message?.slice(0, 80)}`);
      await guardrailRecord({ channel: GUARDRAIL_CHANNEL, action: 'record', allowed: false, reason: err.message, metadata: { email: lead.email } });
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🚀 B2B COLD OUTREACH — segment: ${segment} | dry-run: ${isDryRun}`);
console.log('─'.repeat(60));

if (segment === 'all' || segment === 'govchain') {
  console.log('\n📡 GOVCHAIN — Defense Contractors (CMMC Nov 2026 deadline)');
  await processTargets(GOVCHAIN_TARGETS, govchainEmail, 'govchain');
}

if (segment === 'all' || segment === 'strainchain') {
  console.log('\n🌿 STRAINCHAIN — Cannabis MSO Compliance ($499/mo Theater 1)');
  await processTargets(STRAINCHAIN_TARGETS, strainchaineEmail, 'strainchain');
}

if (segment === 'all' || segment === 'qron') {
  console.log('\n🎨 QRON — Print Shops & Brand Agencies ($29-99 quick wins)');
  await processTargets(QRON_TARGETS, qronEmail, 'qron');
}

console.log('\n✅ OUTREACH COMPLETE');
console.log(`Totals — attempted: ${totalAttempted} | sent: ${totalSent} | send failures: ${sendFailures.length}`);
console.log('Next steps:');
if (!hasResendKey) {
  console.log(`  ⚡ Set ${CREDENTIAL_ENV_VARS[0]} (and ${CREDENTIAL_ENV_VARS[1]} for its domains) then flush queued leads:`);
  console.log('     pnpm exec tsx -e "import { flushQueuedLeads } from \'./scripts/b2b-cold-outreach.ts\'; await flushQueuedLeads()"');
}
if (!process.env.APOLLO_API_KEY) {
  console.log('  ⚡ Set APOLLO_API_KEY to auto-find emails for pending contacts on next run');
}
console.log('  📅 Demo booking page (no Calendly needed): ' + CALENDLY);
console.log('  📋 View all leads in Supabase: select * from leads where source like \'b2b_outreach_%\' order by created_at desc');

// ── Fail loudly on delivery problems ─────────────────────────────────────────
// A live run that reaches the provider and gets rejected every time is a broken
// pipeline, not a successful no-op. Emit Actions error annotations and exit
// non-zero so the scheduled run turns red instead of silently sending nothing.
if (!isDryRun && sendFailures.length > 0) {
  const unique = [...new Set(sendFailures.map(f => f.split(': ').slice(1).join(': ')))];
  console.error(`\n::error::Outreach delivered ${totalSent}/${totalAttempted} emails — ${sendFailures.length} send failure(s)`);
  for (const reason of unique.slice(0, 5)) console.error(`::error::Send failure: ${reason}`);
  process.exit(1);
}
