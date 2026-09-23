// scripts/b2b-cold-outreach.ts
// Autonomous B2B cold outreach for 3 high-priority segments:
//   1. Defense contractors (GovChain — CMMC Nov 2026 deadline)
//   2. Cannabis compliance managers (StrainChain — $499/mo Theater 1)
//   3. Print shops / brand agencies (QRON — $29-99 quick wins)
// Plus an opt-in channel-partner list (not folded into `all`):
//   DRY_RUN=true pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=partners
// Live partner sends also need ALLOW_PARTNER_SENDS=true (or --allow-partner-sends)
// and stay under MAX_LIVE_SENDS. Do not mix partners into govchain/strainchain/qron.
// Existo + ICS are on PARTNER_ALREADY_SENT after two live Resend sends 2026-09-20.
//
// Usage:
//   DRY_RUN=true pnpm exec tsx scripts/b2b-cold-outreach.ts
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=govchain
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=strainchain
//   pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=qron
//   DRY_RUN=true pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=partners
//   DRY_RUN=true pnpm exec tsx scripts/b2b-cold-outreach.ts --segment=high_leverage
// high_leverage is dry-run only (Tier 1 buyer emails already in Supabase).

import { createClient } from "@supabase/supabase-js";
import { guardrailCheck, guardrailRecord } from "./lib/guardrail-client";
import {
  existingLeadBlocksLiveSend,
  nextLeadWriteStatus,
  normalizeLeadEmail,
  shouldNotLiveResend,
} from "./lib/b2b-send-policy";
import {
  checkSender,
  reportSenderFailure,
  CREDENTIAL_ENV_VARS,
} from "./lib/resend-preflight";
import {
  countsAsLiveSendAttempt,
  guardedSend,
  type VerificationSource,
} from "../server/outreach/send-guard";
import {
  describeSkipReason,
  loadCrmRowsForCompanies,
  loadHubSpotContactsForCompany,
  resolveLeadEmail,
} from "./lib/lead-email-resolver";
import { ensureLiveB2bChannel } from "../shared/guardrail-store";
import {
  CHANNEL_PARTNER_LEAD_SOURCE,
  CHANNEL_PARTNER_TARGETS,
  allowPartnerLiveSends,
  assertPartnerRunAllowed,
  orderPartnerTargetsForSend,
  shouldLoadPartnerTargets,
  type ChannelPartnerTarget,
} from "./lib/channel-partners";
import {
  HIGH_LEVERAGE_LEAD_SOURCE,
  HIGH_LEVERAGE_TARGETS,
  assertHighLeverageRunAllowed,
  shouldLoadHighLeverageTargets,
  type HighLeverageTarget,
} from "./lib/high-leverage";
import {
  govchainEmail,
  partnerEmail,
  qronEmail,
  strainchainEmail,
  type EmailDraft,
} from "./lib/b2b-templates";
import { priorContact, recordContact } from "./lib/send-history";

export {
  CHANNEL_PARTNER_LEAD_SOURCE,
  CHANNEL_PARTNER_TARGETS,
} from "./lib/channel-partners";
export {
  HIGH_LEVERAGE_LEAD_SOURCE,
  HIGH_LEVERAGE_TARGETS,
} from "./lib/high-leverage";

const GUARDRAIL_CHANNEL = "email.b2b-cold";

// Fail-closed: unset / any value other than "false" is dry-run. Live send
// requires DRY_RUN=false from the workflow resolve-mode step.
const isDryRun = process.env.DRY_RUN !== "false";
const segment =
  process.argv.find(a => a.startsWith("--segment="))?.split("=")[1] ?? "all";

// Send-failure tracking. A live run where every send fails (bad key, unverified
// domain, provider outage) previously exited 0 and showed a green check — the
// pipeline looked healthy while delivering nothing. These are aggregated and
// surfaced as a non-zero exit + GitHub Actions annotations at the end.
const sendFailures: string[] = [];
let totalAttempted = 0;
let totalSent = 0;
// Counts only real Resend attempts (sent or resend_http_*), not policy
// refuses such as role_inbox / no_mx — those must not burn MAX_LIVE_SENDS.
let liveDispatchAttempts = 0;
// Live runs default to a tiny batch so OWNER_LIVE_SEND cannot blast the
// whole list. Dry-run is uncapped (it never calls Resend).
const maxLiveSends = isDryRun
  ? Number.POSITIVE_INFINITY
  : Math.max(1, Number(process.env.MAX_LIVE_SENDS ?? "2") || 2);

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Any configured Resend credential is enough to attempt sending; which one is
// used for a given sender is resolved per-address by the preflight.
const hasResendKey = CREDENTIAL_ENV_VARS.some(name => !!process.env[name]);

/**
 * Default provenance for a target that does not declare one.
 *
 * `unknown` means the send guard refuses it. Each target carries an explicit
 * `source` where research established one — see the notes beside each address.
 * Researched 2026-08-16: of the seven addresses originally hand-written here,
 * none was published by its owner; two were replaced with the address the
 * company actually publishes, three were blanked for Apollo to resolve, and one
 * company no longer exists.
 */
const RESEARCHED_SOURCE: VerificationSource = "unknown";

// Sender addresses are per-segment because the three segments are separately
// branded products — a GovChain pitch arriving from a cannabis-compliance
// domain reads as spam to the recipient and to their filters. Defaults use the
// parent brand, with StrainChain on its own verified domain. Both domains are
// verified, just on different Resend accounts, which the preflight resolves.
const FALLBACK_FROM = process.env.OUTREACH_FROM_EMAIL ?? "hello@authichain.com";
const SEGMENT_FROM: Record<string, string> = {
  govchain: process.env.OUTREACH_FROM_GOVCHAIN ?? FALLBACK_FROM,
  strainchain: process.env.OUTREACH_FROM_STRAINCHAIN ?? "hello@strainchain.io",
  qron: process.env.OUTREACH_FROM_QRON ?? FALLBACK_FROM,
  // Partnership / high-leverage pitches use the parent brand — not a product cold blast.
  partners: FALLBACK_FROM,
  high_leverage: FALLBACK_FROM,
};
// Falls back to the built-in /book page — Calendly is optional, not required
const CALENDLY = process.env.CALENDLY_LINK ?? "https://app.authichain.com/book";

const hubspotToken =
  process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN;

// ── Verified real contacts from research (June 2026) ─────────────────────────

const GOVCHAIN_TARGETS = [
  {
    company: "Concurrent Technologies Corporation",
    name: "Danielle Bush Gerko",
    title: "Chief Information Security Officer",
    email: "", // find via Apollo: dbgerko@ctc.com pattern
    linkedin: "https://www.linkedin.com/in/dbgerko-cyber/",
    pain: "Perfect SPRS score 110 achieved — now needs supply-chain traceability layer for subcontractor CUI handling before next C3PAO review",
    contract_area: "AFRL, Navy, DoD Advanced Manufacturing",
    cmmc_status: "Level 2 certified July 2025",
    website: "https://www.ctc.com",
  },
  {
    company: "ITC Federal",
    name: "Dr. Imran Bashir",
    title: "Chief Technology Officer",
    email: "", // find via Apollo: ibashir@itcfederal.com pattern
    linkedin: "https://www.linkedin.com/in/drimranbashir/",
    pain: "DevSecOps + cloud team needs blockchain provenance for CUI artifact supply chain — current gap before next DoD audit",
    contract_area: "DoD, DHS, ICE, Coast Guard DevSecOps",
    cmmc_status: "Level 2 certified 2025",
    website: "https://itcfederal.com",
  },
  {
    company: "Integrated Data Services",
    name: "Tammer Olibah",
    title: "President & CEO",
    email: "", // find via Apollo: tolibah@get-integrated.com pattern
    linkedin: "https://www.linkedin.com/in/tammer-olibah-050b285/",
    pain: "Financial management systems (CCaR™) for 30 DoD locations need immutable audit trail; CMMC Level 2 April 2026 — subcontractor supply chain gap",
    contract_area: "Air Force, Army, Navy, Space Force financial systems",
    cmmc_status: "Level 2 certified April 2026",
    website: "https://www.get-integrated.com",
  },
  {
    company: "RealmOne",
    name: "Jeff Little",
    title: "Director of Cybersecurity",
    email: "", // find via Apollo
    linkedin: "https://www.linkedin.com/company/realm-one",
    pain: "Perfect 110 SPRS score, 30+ active contracts — needs automated chain-of-custody proof for intelligence data artifacts",
    contract_area: "DoD Intelligence Community AI/Cybersecurity",
    cmmc_status: "Level 2 certified March 2026 (110/110)",
    website: "https://realmone.com",
  },
  {
    company: "Kampi Components",
    name: "Allan Goodman",
    title: "Owner",
    email: "", // find via Apollo: agoodman@kampi.com pattern
    linkedin: "https://www.linkedin.com/in/allan-goodman-5744656/",
    pain: "Navy/Army OEM supplier with 110 SPRS — next audit will require component-level counterfeit part detection and supplier provenance",
    contract_area: "Navy, Army supply chain OEM components",
    cmmc_status: "Level 2 certified 2025 (110/110)",
    website: "https://kampi.com",
  },
];

// Addresses researched 2026-08-16 against what each company actually publishes.
// None of the original hand-written addresses survived: every one was a
// plausible-shaped guess, which is precisely what the send guard exists to
// refuse. They are blanked so Apollo resolves a real contact at run time —
// shipping a guess is what produced a 37% bounce rate on the July batch.
const STRAINCHAIN_TARGETS = [
  {
    company: "Trulieve Cannabis",
    name: "Head of Compliance",
    title: "VP Compliance / Director of Operations",
    // Was compliance@trulieve.com — not published anywhere. Trulieve publishes
    // ir@ and media@ only, and staff mail is first.last@ (78% of addresses).
    // ir@/media@ are the wrong desk for a compliance product, so resolve a
    // named contact rather than pitch investor relations.
    email: "",
    source: "unknown" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/trulieve/",
    pain: "Multi-state operator with 130+ dispensaries; METRC across FL, PA, AZ, GA — COA integrity + custody reconciliation today, DPP-ready export for EU entry",
    states: "FL, PA, AZ, GA, WV",
    website: "https://trulieve.com",
  },
  {
    company: "Curaleaf",
    name: "Compliance Team",
    title: "SVP Compliance",
    // Was compliance@curaleaf.com — not published. Curaleaf publishes IR@ and
    // media@ only. Same reasoning as Trulieve.
    email: "",
    source: "unknown" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/curaleaf/",
    pain: "Largest MSO by revenue (40+ states) — METRC reconciliation across 40 state systems; blockchain COA hashing; DPP-ready before cannabis is scheduled",
    states: "40+ states",
    website: "https://curaleaf.com",
  },
  // Harvest Health & Recreation removed: Trulieve completed its acquisition on
  // 2021-10-01, so it has not been an independent operator for nearly five
  // years. The entry described it as a "mid-market MSO in 5 states" and would
  // have duplicated the Trulieve pitch into a dead domain.
];

const QRON_TARGETS = [
  {
    company: "FASTSIGNS",
    name: "Innovation Lead",
    title: "VP Product / Innovation",
    // Was innovation@fastsigns.com — not published. FASTSIGNS publishes
    // franchiseinfo@fastsigns.com for exactly this kind of approach, which is
    // both a real address and the right desk for a franchise-network pitch.
    email: "franchiseinfo@fastsigns.com",
    source: "published_contact" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/fastsigns/",
    pain: 'Franchise network looking for premium "smart label" upsell — AI QR codes with brand aesthetics at commercial print margins',
    demo_prompt:
      "bold industrial signage, glowing neon, sharp commercial aesthetic",
    website: "https://fastsigns.com",
  },
  {
    company: "MOO",
    name: "Product Manager",
    title: "Head of Product",
    // Was product@moo.com — not published. MOO publishes inquiries@moo.com for
    // business and partnership enquiries.
    email: "inquiries@moo.com",
    source: "published_contact" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/moo/",
    pain: "Premium print brand targeting luxury clients — QR codes on business cards / packaging need to match visual standards; current QR tools produce ugly codes",
    demo_prompt:
      "premium textured business card, gold foil embossing, luxury paper texture, minimalist",
    website: "https://moo.com",
  },
  {
    company: "4imprint",
    name: "B2B Sales Head",
    title: "VP B2B Sales",
    // Was b2b@4imprint.com — no published b2b@ found, and 4imprint.com is
    // unreachable from CI so it could not be confirmed either way. Blanked
    // rather than shipped on an assumption.
    email: "",
    source: "unknown" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/4imprint/",
    pain: "Corporate promotional merchandise clients want branded QR codes on swag — current QR tools cannot match brand guidelines; white-label API needed",
    demo_prompt:
      "corporate promotional merchandise, high quality product photography, clean studio",
    website: "https://4imprint.com",
  },
  {
    company: "Signarama",
    name: "Franchise Director",
    title: "VP Franchise Development",
    // Was franchise@signarama.com — not published. Signarama staff mail is
    // first@signarama.com and franchise intake runs through a web form, so
    // there is no role address to send to.
    email: "",
    source: "unknown" as VerificationSource,
    linkedin: "https://www.linkedin.com/company/signarama/",
    pain: "Franchise chain with 900 locations — needs white-label QR API for branded retail signage; clients want scannable QRs that match storefront aesthetics",
    demo_prompt:
      "vibrant commercial storefront sign, glowing neon colors, sharp vector art",
    website: "https://signarama.com",
  },
];

// ── Email templates ───────────────────────────────────────────────────────────
// Copy lives in scripts/lib/b2b-templates.ts so it can be tested against the
// claim checker; see that file for what the previous copy got wrong.

/** Dry-run only (see assertHighLeverageRunAllowed). Research notes stay out of the body. */
function highLeverageEmail(t: HighLeverageTarget): EmailDraft {
  const product =
    t.segment === "qron"
      ? "QRON"
      : t.segment === "govchain"
        ? "GovChain"
        : "StrainChain";
  return {
    subject: `${product} and ${t.company}`,
    html: `<p>Draft only: high-leverage shortlist (${HIGH_LEVERAGE_LEAD_SOURCE}), never sent live.</p>`,
  };
}

/** Rebuilds a stored draft's email from its target, keyed by the segment it was written for. */
const BUILDERS: Record<string, (t: any) => EmailDraft> = {
  govchain: govchainEmail,
  strainchain: strainchainEmail,
  qron: qronEmail,
};

function escapeIlikeExact(email: string): string {
  return normalizeLeadEmail(email)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function loadLeadRowsByEmail(
  email: string
): Promise<Array<{ email?: string | null; status?: string | null }>> {
  const { data, error } = await supabase
    .from("leads")
    .select("email,status")
    .ilike("email", escapeIlikeExact(email));
  if (error) {
    console.warn(
      `  ⚠️  Lead lookup failed for ${email}: ${error.message} — treating as already contacted`
    );
    return [{ email, status: "contacted" }];
  }
  return data ?? [];
}

// ── Save drafts to Supabase + optionally send ─────────────────────────────────

async function processTargets<
  T extends { company: string; email: string; name?: string; website?: string },
>(
  targets: T[],
  buildEmail: (t: T) => { subject: string; html: string },
  segmentName: string,
  opts: {
    leadSource?: string;
    trustListedEmail?: boolean;
    allowRoleInbox?: boolean;
  } = {}
) {
  let sent = 0;
  let saved = 0;
  let queued = 0;
  totalAttempted += targets.length;

  const from = SEGMENT_FROM[segmentName] ?? FALLBACK_FROM;

  if (!hasResendKey && !isDryRun) {
    console.warn(
      `  ⚠️  No Resend credential set (${CREDENTIAL_ENV_VARS.join(" / ")}) — emails will be queued in Supabase (status=queued) and sent on next run when a key is present`
    );
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
      console.warn(
        `  ⚠️  Skipping sends for [${segmentName}] — drafts will be queued instead`
      );
      sendFailures.push(`${segmentName} sender ${from}: ${check.reason}`);
    } else {
      credential = check.credential;
      console.log(`  ✅ Sender verified: ${from} (via ${check.credential})`);
    }
  }

  const crmRows = opts.trustListedEmail
    ? []
    : await loadCrmRowsForCompanies(
        supabase,
        targets.map(t => t.company)
      );

  for (const t of targets) {
    let email = t.email;
    let source: VerificationSource = (t as any).source ?? RESEARCHED_SOURCE;
    // How the address was found, for the skip message below. Declared here:
    // it used to be read outside the block that defined it, which threw a
    // ReferenceError on the first live target with no address.
    let via: Parameters<typeof describeSkipReason>[0] | undefined;
    // Partner rows already carry a published / inbound / connected address.
    // Do not run them through usableEmail() — that strips role inboxes
    // (contact@, info@, hello@) which are the desk these partners publish.
    if (!opts.trustListedEmail) {
      const resolved = await resolveLeadEmail(
        {
          company: t.company,
          name: (t as any).name ?? t.company,
          website: t.website,
          email: t.email,
          source: (t as any).source ?? RESEARCHED_SOURCE,
        },
        {
          crmRows,
          hubspotContacts: t.email
            ? undefined
            : await loadHubSpotContactsForCompany(t.company, hubspotToken),
        }
      );
      email = resolved.email;
      source = resolved.source;
      via = resolved.via;
      if (email && resolved.via !== "already_set") {
        (t as any).email = email;
        console.log(`  🔎 ${resolved.via}: ${t.company} → ${email}`);
      }
    }

    const { subject, html } = buildEmail(t);

    if (email && shouldNotLiveResend(email)) {
      console.log(`  ⏭️  Do-not-resend list — ${email}`);
      continue;
    }
    if (email) {
      const prior = await priorContact(supabase, email);
      if (prior.blocked) {
        console.log(`  ⏭️  Not sending to ${email} — ${prior.reason}`);
        continue;
      }
    }
    let existingStatus: string | null = null;
    if (email && !isDryRun) {
      const existingRows = await loadLeadRowsByEmail(email);
      if (existingLeadBlocksLiveSend(existingRows, email)) {
        console.log(`  ⏭️  Already contacted ${email} — not re-sending`);
        continue;
      }
      existingStatus =
        existingRows.find(
          row =>
            normalizeLeadEmail(String(row.email ?? "")) ===
            normalizeLeadEmail(email)
        )?.status ?? null;
    }

    // Determine initial status
    const dbStatus = nextLeadWriteStatus(
      existingStatus,
      isDryRun
        ? "draft"
        : !email
          ? "pending_email" // Apollo found nothing; manual lookup needed
          : !senderOk
            ? "queued" // No usable credential for this sender; drain later
            : "draft" // Ready to send
    );

    const { error: dbErr } = await supabase.from("leads").upsert(
      {
        email:
          email ||
          `[pending]@${t.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        name: (t as any).name ?? t.company,
        company: t.company,
        source: opts.leadSource ?? `b2b_outreach_${segmentName}`,
        status: dbStatus,
        // `source` is persisted so a later flush re-applies the same provenance
        // decision instead of silently downgrading an Apollo-verified address.
        metadata: {
          subject,
          html_preview: html.slice(0, 500),
          target: t,
          source,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (dbErr) {
      console.warn(`  ⚠️  DB save failed for ${t.company}: ${dbErr.message}`);
    } else {
      saved++;
      console.log(`  💾 [${dbStatus}] ${t.company} — "${subject}"`);
    }

    if (isDryRun) {
      console.log(`     [DRY RUN] Would send to: ${email || "(no email)"}`);
      queued++;
      continue;
    }

    if (!email) {
      console.log(`     ℹ️  ${t.company}: ${(via ? describeSkipReason(via) : "no address listed")}`);
      queued++;
      continue;
    }

    if (liveDispatchAttempts >= maxLiveSends) {
      console.log(
        `     ⏭️  Live cap reached (MAX_LIVE_SENDS=${maxLiveSends}) — leaving ${email} queued`
      );
      queued++;
      await supabase
        .from("leads")
        .update({ status: "queued", updatedAt: new Date().toISOString() })
        .eq("email", email);
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
      console.log(
        `     🚧 Blocked by guardrail (${GUARDRAIL_CHANNEL}): ${gate.reason} — ${email}`
      );
      queued++;
      if (gate.errored)
        sendFailures.push(
          `${t.company}: guardrail check failed — ${gate.reason}`
        );
      continue;
    }

    try {
      // Routed through the send guard rather than the Resend client directly,
      // so every cold send carries a reply-to, one-click List-Unsubscribe
      // headers and the CAN-SPAM postal address — and so unverified recipients
      // are refused before any network call.
      const allowRoleInbox =
        opts.allowRoleInbox === true || segmentName === "partners";
      const res = await guardedSend({
        to: email,
        source,
        subject,
        html,
        from,
        company: "AuthiChain",
        apiKey: credential ? process.env[credential] : undefined,
        allowRoleInbox,
      });
      // Policy refuses (role_inbox, untrusted, no MX) must not burn
      // MAX_LIVE_SENDS — only a real Resend attempt counts.
      if (countsAsLiveSendAttempt(res)) {
        liveDispatchAttempts += 1;
      }
      if (res.sent) {
        sent++;
        console.log(`  ✉️  Sent: ${email} — "${subject}"`);
        await recordContact(supabase, email, GUARDRAIL_CHANNEL);
        await supabase
          .from("leads")
          .update({ status: "contacted", updatedAt: new Date().toISOString() })
          .eq("email", email);
        await guardrailRecord({
          channel: GUARDRAIL_CHANNEL,
          action: "record",
          allowed: true,
          reason: "sent",
          metadata: { email, resendId: res.id },
        });
      } else if (res.assessment.status === "reject" || res.reason === "no_mx") {
        // A refused recipient is the guard doing its job, not a broken
        // pipeline: it must not turn the run red or it trains everyone to
        // ignore the signal. It stays queued so verifying the address later
        // is enough to send it.
        console.log(`     🛑 Refused by send guard: ${email} — ${res.reason}`);
        queued++;
        await guardrailRecord({
          channel: GUARDRAIL_CHANNEL,
          action: "record",
          allowed: false,
          reason: `guard:${res.reason}`,
          metadata: { email },
        });
      } else {
        console.warn(`  ⚠️  Send failed for ${t.company}: ${res.reason}`);
        sendFailures.push(
          `${t.company}: ${res.reason ?? "unknown send failure"}`
        );
        queued++;
        await guardrailRecord({
          channel: GUARDRAIL_CHANNEL,
          action: "record",
          allowed: false,
          reason: res.reason ?? "unknown send failure",
          metadata: { email },
        });
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Send failed for ${t.company}: ${err.message}`);
      sendFailures.push(`${t.company}: ${err.message}`);
      queued++;
      await guardrailRecord({
        channel: GUARDRAIL_CHANNEL,
        action: "record",
        allowed: false,
        reason: err.message,
        metadata: { email },
      });
    }
  }

  totalSent += sent;
  console.log(
    `\n[${segmentName}] Saved: ${saved} | Sent: ${sent} | Queued/Pending: ${queued}`
  );
}

// ── Flush queued leads: send emails that were saved with status=queued ─────────
// Run this after fixing the sender to drain the queue without re-running the
// full outreach script and risking duplicate outreach.
export async function flushQueuedLeads(): Promise<number> {
  if (isDryRun) {
    console.log("[DRY RUN] Skipping flushQueuedLeads — no live send");
    return 0;
  }
  if (!hasResendKey) {
    console.warn(
      `No Resend credential set (${CREDENTIAL_ENV_VARS.join(" / ")}) — nothing to flush`
    );
    return 0;
  }

  const sourceFilter =
    segment && segment !== "all" ? `b2b_outreach_${segment}` : "b2b_outreach_%";
  // Only `queued`. Every dry run writes its targets as `draft`, so draining
  // drafts meant a live flush sent whatever the last dry run had rendered.
  let query = supabase
    .from("leads")
    .select("*")
    .eq("status", "queued")
    .order("createdAt", { ascending: false });
  query = sourceFilter.endsWith("%")
    ? query.like("source", sourceFilter)
    : query.eq("source", sourceFilter);

  const { data: leads } = await query;

  if (!leads?.length) {
    console.log(`No queued leads to flush (${sourceFilter}).`);
    return 0;
  }

  let flushed = 0;
  for (const lead of leads) {
    if (flushed >= maxLiveSends) {
      console.log(
        `     ⏭️  Live cap reached (MAX_LIVE_SENDS=${maxLiveSends}) — leaving ${lead.email} queued`
      );
      continue;
    }
    const meta = lead.metadata as any;
    const leadEmail = String(lead.email ?? "").toLowerCase();
    if (!leadEmail || leadEmail.startsWith("[pending]@")) continue;
    if (shouldNotLiveResend(leadEmail)) {
      console.log(`  ⏭️  Skipping already-sent ${lead.email}`);
      continue;
    }
    const prior = await priorContact(supabase, leadEmail);
    if (prior.blocked) {
      console.log(`  ⏭️  Not sending to ${lead.email} — ${prior.reason}`);
      continue;
    }

    // Recover the segment the draft was written for so the flush sends under
    // the same brand the copy was written in. checkSender caches per address,
    // so this costs one probe per distinct sender across the whole flush.
    const leadSegment = String(lead.source ?? "").replace("b2b_outreach_", "");
    // Partner drafts use a different source and are not part of the cold
    // drain. Extra fail-closed if a row was ever tagged b2b_outreach_partners.
    if (
      lead.source === CHANNEL_PARTNER_LEAD_SOURCE ||
      lead.source === HIGH_LEVERAGE_LEAD_SOURCE ||
      leadSegment === "partners" ||
      leadSegment === "high_leverage"
    ) {
      console.log(
        `  ⏭️  Skipping partner lead ${lead.email} — partner sends are not flushed with cold queue`
      );
      continue;
    }
    const from = SEGMENT_FROM[leadSegment] ?? FALLBACK_FROM;

    // Re-render from the stored target with today's copy. The stored
    // html_preview is the first 500 characters of the old copy, and flushing
    // it sent recipients a cut-off email.
    const build = BUILDERS[leadSegment];
    if (!build || !meta?.target) {
      console.log(
        `  ⏭️  Skipping ${lead.email} — no stored target to rebuild the email from`
      );
      continue;
    }
    const draft = build({ ...meta.target, email: leadEmail });

    const senderCheck = await checkSender(from);
    if (!senderCheck.ok) {
      reportSenderFailure(senderCheck, `b2b-flush:${leadSegment}`);
      console.warn(`  ⚠️  Leaving ${lead.email} queued — ${from} cannot send`);
      continue;
    }

    const gate = await guardrailCheck(GUARDRAIL_CHANNEL, {
      recipient: lead.email,
    });
    if (!gate.allowed) {
      // An errored check (guardrail unreachable) vs. a policy denial (cap/
      // disabled/suppressed) look identical to the caller otherwise — flag
      // the former more loudly since it means the pipeline is broken, not
      // just correctly capped.
      const log = gate.errored ? console.error : console.log;
      log(
        `  🚧 Blocked by guardrail (${GUARDRAIL_CHANNEL}): ${gate.reason} — ${lead.email}`
      );
      continue;
    }

    try {
      const res = await guardedSend({
        to: lead.email,
        source: (meta.source as VerificationSource) ?? RESEARCHED_SOURCE,
        subject: draft.subject,
        html: draft.html,
        from,
        company: "AuthiChain",
        apiKey: process.env[senderCheck.credential!],
      });
      if (res.sent) {
        await supabase
          .from("leads")
          .update({ status: "contacted", updatedAt: new Date().toISOString() })
          .eq("email", lead.email);
        flushed++;
        console.log(`  ✉️  Flushed: ${lead.email}`);
        await recordContact(supabase, leadEmail, GUARDRAIL_CHANNEL);
        await guardrailRecord({
          channel: GUARDRAIL_CHANNEL,
          action: "record",
          allowed: true,
          reason: "sent",
          metadata: { email: lead.email, resendId: res.id },
        });
      } else {
        console.log(`  🛑 Left queued: ${lead.email} — ${res.reason}`);
        await guardrailRecord({
          channel: GUARDRAIL_CHANNEL,
          action: "record",
          allowed: false,
          reason: res.reason ?? "unknown send failure",
          metadata: { email: lead.email },
        });
      }
    } catch (err: any) {
      console.warn(
        `  ⚠️  Flush failed for ${lead.email}: ${err.message?.slice(0, 80)}`
      );
      await guardrailRecord({
        channel: GUARDRAIL_CHANNEL,
        action: "record",
        allowed: false,
        reason: err.message,
        metadata: { email: lead.email },
      });
    }
  }
  return flushed;
}

const flushQueuedOnly = process.env.FLUSH_QUEUED_ONLY === "true";

if (flushQueuedOnly) {
  console.log(
    `\n🚀 B2B FLUSH QUEUED — segment: ${segment} | dry-run: ${isDryRun}`
  );
  if (!isDryRun) {
    console.log(`Live send cap this run: ${maxLiveSends} (MAX_LIVE_SENDS)`);
    try {
      await ensureLiveB2bChannel(supabase);
      console.log("  ✅ Guardrail channel email.b2b-cold enabled (cap 25/day)");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠️  Could not enable email.b2b-cold channel: ${message}`);
    }
  }
  const n = await flushQueuedLeads();
  console.log(`Flushed ${n} leads`);
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(
  `\n🚀 B2B COLD OUTREACH — segment: ${segment} | dry-run: ${isDryRun}`
);
if (!isDryRun) {
  console.log(`Live send cap this run: ${maxLiveSends} (MAX_LIVE_SENDS)`);
  try {
    await ensureLiveB2bChannel(supabase);
    console.log("  ✅ Guardrail channel email.b2b-cold enabled (cap 25/day)");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️  Could not enable email.b2b-cold channel: ${message}`);
  }
}
console.log("─".repeat(60));

if (segment === "all" || segment === "govchain") {
  console.log("\n📡 GOVCHAIN — Defense Contractors (CMMC Nov 2026 deadline)");
  await processTargets(GOVCHAIN_TARGETS, govchainEmail, "govchain");
}

if (segment === "all" || segment === "strainchain") {
  console.log("\n🌿 STRAINCHAIN — Cannabis MSO Compliance ($499/mo Theater 1)");
  await processTargets(STRAINCHAIN_TARGETS, strainchainEmail, "strainchain");
}

if (segment === "all" || segment === "qron") {
  console.log("\n🎨 QRON — Print Shops & Brand Agencies ($29-99 quick wins)");
  await processTargets(QRON_TARGETS, qronEmail, "qron");
}

if (shouldLoadPartnerTargets(segment)) {
  const partnerGate = assertPartnerRunAllowed({
    isDryRun,
    allowLive: allowPartnerLiveSends(),
  });
  if (!partnerGate.ok) {
    console.error(`\n::error::${partnerGate.message}`);
    process.exit(1);
  }
  console.log(
    `\n🤝 CHANNEL PARTNERS — ${CHANNEL_PARTNER_LEAD_SOURCE} (not a cold end-buyer blast)`
  );
  if (!isDryRun) {
    console.log(
      `  Live partner send is explicit (ALLOW_PARTNER_SENDS) and still capped by MAX_LIVE_SENDS=${maxLiveSends}`
    );
  }
  await processTargets(
    orderPartnerTargetsForSend(CHANNEL_PARTNER_TARGETS),
    partnerEmail,
    "partners",
    {
      leadSource: CHANNEL_PARTNER_LEAD_SOURCE,
      trustListedEmail: true,
      allowRoleInbox: true,
    }
  );
}

if (shouldLoadHighLeverageTargets(segment)) {
  const hlGate = assertHighLeverageRunAllowed({ isDryRun });
  if (!hlGate.ok) {
    console.error(`\n::error::${hlGate.message}`);
    process.exit(1);
  }
  console.log(
    `\n🎯 HIGH LEVERAGE — ${HIGH_LEVERAGE_LEAD_SOURCE} (dry-run only; not a cold list dump)`
  );
  await processTargets(
    [...HIGH_LEVERAGE_TARGETS],
    highLeverageEmail,
    "high_leverage",
    {
      leadSource: HIGH_LEVERAGE_LEAD_SOURCE,
      trustListedEmail: true,
    }
  );
}

console.log("\n✅ OUTREACH COMPLETE");
console.log(
  `Totals — attempted: ${totalAttempted} | sent: ${totalSent} | send failures: ${sendFailures.length}`
);
console.log("Next steps:");
if (!hasResendKey) {
  console.log(
    `  ⚡ Set ${CREDENTIAL_ENV_VARS[0]} (and ${CREDENTIAL_ENV_VARS[1]} for its domains) then flush queued leads:`
  );
  console.log(
    "     pnpm exec tsx -e \"import { flushQueuedLeads } from './scripts/b2b-cold-outreach.ts'; await flushQueuedLeads()\""
  );
}
if (!process.env.APOLLO_API_KEY) {
  console.log(
    "  ⚡ APOLLO_API_KEY unset — pending contacts fill from CRM/HubSpot or published addresses only (no paid Apollo upgrade)"
  );
}
console.log("  📅 Demo booking page (no Calendly needed): " + CALENDLY);
console.log(
  "  📋 View all leads in Supabase: select * from leads where source like 'b2b_outreach_%' or source in ('channel_partner_web_scan_2026-09-19','high_leverage_scan_2026-09-19') order by created_at desc"
);

// ── Fail loudly on delivery problems ─────────────────────────────────────────
// A live run that reaches the provider and gets rejected every time is a broken
// pipeline, not a successful no-op. Emit Actions error annotations and exit
// non-zero so the scheduled run turns red instead of silently sending nothing.
if (!isDryRun && sendFailures.length > 0) {
  const unique = [
    ...new Set(sendFailures.map(f => f.split(": ").slice(1).join(": "))),
  ];
  console.error(
    `\n::error::Outreach delivered ${totalSent}/${totalAttempted} emails — ${sendFailures.length} send failure(s)`
  );
  for (const reason of unique.slice(0, 5))
    console.error(`::error::Send failure: ${reason}`);
  process.exit(1);
}
