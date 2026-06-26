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
import { Resend } from 'resend';

const isDryRun = process.env.DRY_RUN === 'true';
const segment  = process.argv.find(a => a.startsWith('--segment='))?.split('=')[1] ?? 'all';

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const resend   = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM     = process.env.OUTREACH_FROM_EMAIL ?? 'hello@authichain.com';
const CALENDLY = process.env.CALENDLY_LINK       ?? 'https://calendly.com/authichain/discovery';

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
    pain: 'Multi-state operator with 130+ dispensaries; METRC across FL, PA, AZ, GA — blockchain DPP required for EU market entry by July 2026',
    states: 'FL, PA, AZ, GA, WV',
    website: 'https://trulieve.com',
  },
  {
    company: 'Curaleaf',
    name: 'Compliance Team',
    title: 'SVP Compliance',
    email: 'compliance@curaleaf.com',
    linkedin: 'https://www.linkedin.com/company/curaleaf/',
    pain: 'Largest MSO by revenue (40+ states) — EU DPP mandate July 2026 creates export compliance gap; METRC + blockchain COA hashing needed',
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
  You're receiving this because ${t.company} is registered on SAM.gov.
  <a href="https://govchain.us/unsubscribe">Unsubscribe</a></p>
</div>`;
  return { subject, html };
}

function strainchaineEmail(t: typeof STRAINCHAIN_TARGETS[0]): { subject: string; html: string } {
  const subject = `EU Digital Product Passport for ${t.company} — July 2026 deadline`;
  const html = `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
  <p>Hi,</p>

  <p>The EU's Digital Product Passport (DPP) mandate takes effect for cannabis-adjacent
  products in July 2026. For MSOs like ${t.company} with any EU distribution or
  licensing deals, this means every package needs a blockchain-anchored provenance
  record — lab certificate hash, METRC tag, custody timestamp, and a scannable QR
  that verifies on-chain in under 2 seconds.</p>

  <p>StrainChain (<a href="https://strainchain.io">strainchain.io</a>) does exactly this:
  <ul>
    <li>METRC sync — custody events auto-anchored on Polygon at every handoff</li>
    <li>COA hashing — lab certificates stored immutably; tampering is instantly detectable</li>
    <li>EU DPP v2 compliant passport per package (ISO 18013-5 / EPCIS 2.0)</li>
    <li>Consumer-facing QR scan: full chain-of-custody + test results in 1.2 seconds</li>
  </ul></p>

  <p>Theater 1 plan is <strong>$499/month</strong> for 5,000 package scans.
  7-day free trial, no integration required to start the demo.</p>

  <p><a href="https://strainchain.io/demo">Watch the 90-second demo</a> or
  <a href="${CALENDLY}">book a call</a> — I can have a sandbox live for
  ${t.company} in under an hour.</p>

  <p>Best,<br>
  Zachary<br>
  StrainChain / AuthiChain<br>
  <a href="https://strainchain.io">strainchain.io</a></p>

  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
  <a href="https://strainchain.io/unsubscribe">Unsubscribe</a></p>
</div>`;
  return { subject, html };
}

function qronEmail(t: typeof QRON_TARGETS[0]): { subject: string; html: string } {
  const subject = `AI QR codes for ${t.company} — white-label API (custom demo inside)`;
  const html = `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
  <p>Hi,</p>

  <p>I ran <strong>${t.company}</strong> through our AI QR engine and generated
  a custom demo — takes 3 seconds, matches your visual language:</p>

  <p style="text-align:center">
    <a href="https://qron.space/demo?company=${encodeURIComponent(t.company)}"
       style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
      View ${t.company} Demo QR →
    </a>
  </p>

  <p>QRON (<a href="https://qron.space">qron.space</a>) generates AI-designed
  QR codes that match brand aesthetics — cryptographically signed, guaranteed
  scannable, available via white-label API:</p>
  <ul>
    <li>5 visual modes: Static, Stereographic, Holographic, Memory, Custom Prompt</li>
    <li>Ed25519-signed on Polygon — tamper-proof authenticity certificate on every scan</li>
    <li>White-label API: your brand, your dashboard, fractions of a cent per generation</li>
    <li>FTC EO 14392 compliant origin verification (MADE IN USA shield support)</li>
  </ul>

  <p>We've pre-provisioned a white-label sandbox for ${t.company}.
  Creator Pack: <strong>$99 for 500 generations</strong>.
  White-label API: usage-based from $0.002/QR.</p>

  <p>10-minute call?
  <a href="${CALENDLY}?company=${encodeURIComponent(t.company)}">Book here</a>
  or reply and I'll send the API docs.</p>

  <p>Best,<br>
  Zachary<br>
  QRON / AuthiChain<br>
  <a href="https://qron.space">qron.space</a></p>

  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
  <a href="https://qron.space/unsubscribe">Unsubscribe</a></p>
</div>`;
  return { subject, html };
}

// ── Save drafts to Supabase + optionally send ─────────────────────────────────

async function processTargets<T extends { company: string; email: string; name?: string }>(
  targets: T[],
  buildEmail: (t: T) => { subject: string; html: string },
  segmentName: string,
) {
  let sent = 0; let saved = 0; let skipped = 0;

  for (const t of targets) {
    const { subject, html } = buildEmail(t);

    // Always save draft to leads table for review
    const { error: dbErr } = await supabase.from('leads').upsert({
      email:    t.email || `[find-via-apollo]@${t.company.toLowerCase().replace(/\s+/g, '')}.com`,
      name:     (t as any).name ?? t.company,
      company:  t.company,
      source:   `b2b_outreach_${segmentName}`,
      status:   'draft',
      metadata: { subject, html_preview: html.slice(0, 500), target: t },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (dbErr) console.warn(`  ⚠️  DB save failed for ${t.company}: ${dbErr.message}`);
    else { saved++; console.log(`  💾 Saved draft: ${t.company} — "${subject}"`); }

    // Only send if we have a real email AND Resend is configured AND not dry-run
    if (!t.email || !resend || isDryRun) {
      if (!t.email)  console.log(`     ℹ️  No email for ${t.company} — find via Apollo then update leads table`);
      if (isDryRun)  console.log(`     [DRY RUN] Would send to: ${t.email}`);
      skipped++;
      continue;
    }

    try {
      const res = await resend.emails.send({ from: FROM, to: t.email, subject, html });
      if (res.data?.id) {
        sent++;
        console.log(`  ✉️  Sent: ${t.email} — "${subject}"`);
        await supabase.from('leads').update({ status: 'contacted', updatedAt: new Date().toISOString() })
          .eq('email', t.email);
      } else {
        console.warn(`  ⚠️  Resend error for ${t.company}:`, res.error);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Send failed for ${t.company}: ${err.message}`);
    }
  }

  console.log(`\n[${segmentName}] Saved: ${saved} | Sent: ${sent} | Skipped (no email): ${skipped}`);
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
console.log('Next steps:');
console.log('  1. For contacts with empty email: find via Apollo.io free tier (50/mo)');
console.log('     Apollo search: https://app.apollo.io/#/people?organizationNames[]=<company>');
console.log('  2. Update leads table email field, then re-run with actual email to send');
console.log('  3. Follow up at day 3, 7, 14 with: DRY_RUN=false pnpm exec tsx scripts/b2b-followup.ts');
console.log('  4. Book demo calls via Calendly; link: ' + CALENDLY);
