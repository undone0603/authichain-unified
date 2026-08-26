/* Real-contact verification dry-run — NO sends.
 * Sources: HubSpot CRM (real cannabis decision-makers) + web research. Apollo is
 * free-plan API-locked, so it's excluded. Runs LIVE DNS/MX verification (the
 * send-guard's real check) to confirm each domain actually accepts mail, then the
 * provenance guard. Run: tsx scripts/dry-run-outreach.ts
 */
import { inferEmailCandidates } from '../server/outreach/email-verify';
import { assessRecipient, canSend, domainAcceptsMail } from '../server/outreach/send-guard';

interface Contact { name: string; title: string; company: string; email?: string; first: string; last: string; domain: string; src: string; }

// Real, ICP-fit contacts. `email` = stored in HubSpot; otherwise inferred from name+domain.
const CONTACTS: Contact[] = [
  { name: 'Kathryn Long',       title: 'Dir. Retail Marketing', company: 'C3 Industries',     email: 'klong@c3industries.com',          first: 'Kathryn', last: 'Long',       domain: 'c3industries.com',      src: 'HubSpot (deal contact, had phone)' },
  { name: 'Wendy Linscott',     title: 'Chief Compliance Officer', company: 'Curaleaf',       email: 'wendy.linscott@curaleaf.com',     first: 'Wendy',   last: 'Linscott',   domain: 'curaleaf.com',          src: 'HubSpot' },
  { name: 'Jeremy Kacuba',      title: 'EVP Operations',        company: 'Curaleaf',          email: 'jeremy.kacuba@curaleaf.com',      first: 'Jeremy',  last: 'Kacuba',     domain: 'curaleaf.com',          src: 'HubSpot' },
  { name: 'Christopher Kwilasz',title: 'CEO',                   company: 'Lume Cannabis',     email: 'christopher.kwilasz@lume.com',    first: 'Christopher', last: 'Kwilasz', domain: 'lume.com',            src: 'HubSpot' },
  { name: 'Karan Wadhera',      title: 'Managing Partner',      company: 'Casa Verde Capital', email: 'karan.wadhera@casaverdecapital.com', first: 'Karan', last: 'Wadhera', domain: 'casaverdecapital.com', src: 'HubSpot' },
  { name: 'Kalee Zeanah',       title: 'Brand/Marketing',       company: 'Trulieve',          email: 'kalee.zeanah@trulieve.com',       first: 'Kalee',   last: 'Zeanah',     domain: 'trulieve.com',          src: 'HubSpot' },
  { name: 'Cory Rothschild',    title: 'VP Brand Marketing',    company: 'Cresco Labs',                                                  first: 'Cory',    last: 'Rothschild', domain: 'crescolabs.com',        src: 'Web research' },
  { name: 'Eli Aguilera',       title: 'CMO',                   company: 'Trulieve',                                                     first: 'Eli',     last: 'Aguilera',   domain: 'trulieve.com',          src: 'Web research' },
];

async function run() {
  console.log('=== REAL CONTACT VERIFICATION (no sends) ===');
  console.log('Sources: HubSpot CRM + web research (Apollo excluded — free-plan API-locked)\n');
  const live: string[] = [];

  for (const c of CONTACTS) {
    const email = c.email ?? inferEmailCandidates(c.first, c.last, c.domain)[0];
    const mxLive = await domainAcceptsMail(email);            // LIVE DNS check
    const g = assessRecipient(email, 'pattern_guess');         // provenance guard
    const flag = mxLive ? 'MX-LIVE' : 'NO-MX(dead/typo)';
    console.log(`${c.name.padEnd(20)} ${c.title.padEnd(26)} ${c.company}`);
    console.log(`   email: ${email}  [${c.email ? 'HubSpot' : 'inferred'}]`);
    console.log(`   domain mail-accepting: ${flag}  |  guard: ${g.status.toUpperCase()} (${g.reasons.join(',') || 'ok'}) -> ${canSend(g) ? 'SEND' : 'BLOCKED until verified'}`);
    console.log(`   source: ${c.src}\n`);
    if (mxLive) live.push(`${c.name} <${email}>`);
  }

  console.log('=== LIVE (domain accepts mail), real ICP contacts ===');
  live.forEach((l) => console.log('  ✓', l));
  console.log(`\n${live.length}/${CONTACTS.length} on mail-accepting domains.`);
  console.log('Note: MX confirms the DOMAIN is live; mailbox-level proof needs Reacher (SMTP) or a paid verifier.');
  console.log('Guard still BLOCKS all (source=pattern_guess) until verified — no sends occurred.');
}

run().catch((e) => { console.error('error:', e); process.exit(1); });
