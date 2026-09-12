/**
 * Revenue Cycle — warm-lead checkout links, dunning ping, revenue health report.
 *
 * Converts *qualified / interested* leads into Stripe payment CTAs and surfaces
 * MRR health. Does NOT cold-email guessed addresses (see
 * docs/outreach-deliverability-runbook.md and the manual-outreach-playbook).
 *
 * Safety:
 *   - DRY_RUN defaults to true when unset. Live requires DRY_RUN=false.
 *   - Never invents contact emails.
 *
 * Usage:
 *   DRY_RUN=true  pnpm exec tsx scripts/revenue-cycle.ts --phase=report
 *   DRY_RUN=true  pnpm exec tsx scripts/revenue-cycle.ts --phase=fix-provenance
 *   DRY_RUN=true  pnpm exec tsx scripts/revenue-cycle.ts --phase=all
 *   DRY_RUN=false pnpm exec tsx scripts/revenue-cycle.ts --phase=checkout-links
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_LINKS } from "../server/payment-links";
import { PLANS } from "../src/lib/plans";

type Phase =
  | "all"
  | "proposals"
  | "dunning"
  | "report"
  | "checkout-links"
  | "fix-provenance";

const PHASES: Phase[] = [
  "all",
  "proposals",
  "dunning",
  "report",
  "checkout-links",
  "fix-provenance",
];

const PHASE_ARG =
  process.argv.find(a => a.startsWith("--phase="))?.split("=")[1] ?? "all";
const PHASE = (
  PHASES.includes(PHASE_ARG as Phase) ? PHASE_ARG : "all"
) as Phase;

/** Missing DRY_RUN ⇒ dry-run (fail-safe). Only DRY_RUN=false is live. */
const isDryRun = process.env.DRY_RUN !== "false";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  "";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const APP_URL = (process.env.APP_URL ?? "https://authichain.com").replace(
  /\/$/,
  ""
);
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const WARM_STATUSES = new Set([
  "qualified",
  "interested",
  "proposal",
  "proposal_sent",
  "demo",
  "negotiating",
  "contacted",
]);

/** Matches guardedSend / send-guard TRUSTED_SOURCES — never attach pay links for guessed emails. */
const VERIFIED_PROVENANCE = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
]);

const INBOUND_COLUMN_SOURCES = new Set([
  "website",
  "website_form",
  "inbound",
  "inbound_optin",
  "roi_calculator",
  "sales_funnel",
  "try_for_free",
  "chatbot",
]);

type LeadProvenanceInput = {
  emailReplied?: boolean | null;
  repliesReceived?: number | null;
  source?: string | null;
  metadata?: unknown;
};

/** Read provenance already stamped in metadata (no column inference). */
function metadataProvenance(meta: Record<string, unknown>): string | null {
  for (const key of [
    "verification_source",
    "emailProvenance",
    "provenance",
    "verificationSource",
  ]) {
    const v = meta[key];
    if (typeof v === "string" && v) return v;
  }
  // metadata.source only counts when already a trusted VerificationSource
  // (campaign names like b2b_outreach_* must not masquerade as provenance).
  if (
    typeof meta.source === "string" &&
    meta.source &&
    VERIFIED_PROVENANCE.has(meta.source)
  ) {
    return meta.source;
  }
  return null;
}

/** Never invent trust for these lead.source column values. */
function isUntrustedColumnSource(col: string): boolean {
  const lower = col.toLowerCase();
  return (
    lower.startsWith("mi_cra") ||
    lower === "pattern_guess" ||
    lower === "scraped" ||
    lower === "unknown" ||
    lower.startsWith("b2b_outreach") ||
    lower === "seed"
  );
}

/**
 * Infer trusted provenance from reply signals or the leads.source column.
 * Returns null when there is no safe signal (does not invent MI/guess trust).
 */
function inferProvenanceFromSignals(lead: LeadProvenanceInput): {
  provenance: string;
  signal: string;
} | null {
  if (lead.emailReplied) {
    return { provenance: "confirmed_reply", signal: "emailReplied" };
  }
  if (typeof lead.repliesReceived === "number" && lead.repliesReceived > 0) {
    return { provenance: "confirmed_reply", signal: "repliesReceived" };
  }

  const col = String(lead.source ?? "").trim();
  if (!col || isUntrustedColumnSource(col)) return null;

  if (col.startsWith("agentz_apollo") || col === "apollo") {
    return { provenance: "apollo_verified", signal: `source=${col}` };
  }
  if (INBOUND_COLUMN_SOURCES.has(col)) {
    return { provenance: "inbound_optin", signal: `source=${col}` };
  }
  if (col === "gov_engine") {
    return { provenance: "published_contact", signal: `source=${col}` };
  }
  return null;
}

function leadProvenance(lead: LeadProvenanceInput): string | null {
  const meta = (lead.metadata ?? {}) as Record<string, unknown>;
  const fromMeta = metadataProvenance(meta);
  if (fromMeta) return fromMeta;
  return inferProvenanceFromSignals(lead)?.provenance ?? null;
}

function hasVerifiedProvenance(lead: LeadProvenanceInput): boolean {
  const p = leadProvenance(lead);
  return !!p && VERIFIED_PROVENANCE.has(p);
}

function segmentPaymentCta(segment?: string | null): {
  name: string;
  price: string;
  url: string;
} | null {
  const s = (segment ?? "").toLowerCase();
  if (s.includes("qron")) {
    const p = PLANS.find(x => x.id === "creator" && x.stripe_payment_link);
    if (p?.stripe_payment_link) {
      return {
        name: p.name,
        price: `$${p.price}`,
        url: p.stripe_payment_link,
      };
    }
    return {
      name: PAYMENT_LINKS.qron.brandPack.name,
      price: PAYMENT_LINKS.qron.brandPack.price,
      url: PAYMENT_LINKS.qron.brandPack.url,
    };
  }
  if (s.includes("strain")) {
    return {
      name: PAYMENT_LINKS.strainchain.basic.name,
      price: PAYMENT_LINKS.strainchain.basic.price,
      url: PAYMENT_LINKS.strainchain.basic.url,
    };
  }
  if (s.includes("gov")) {
    const dpp = PLANS.find(
      x => x.id === "dpp_readiness" && x.stripe_payment_link
    );
    if (dpp?.stripe_payment_link) {
      return {
        name: dpp.name,
        price: `$${dpp.price}`,
        url: dpp.stripe_payment_link,
      };
    }
  }
  return {
    name: PAYMENT_LINKS.authichain.starter.name,
    price: PAYMENT_LINKS.authichain.starter.price,
    url: PAYMENT_LINKS.authichain.starter.url,
  };
}

function withAttribution(
  url: string,
  leadId: string | number,
  campaign: string
): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}prospect_id=${encodeURIComponent(String(leadId))}&utm_source=revenue_cycle&utm_medium=checkout&utm_campaign=${encodeURIComponent(campaign)}`;
}

function supabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stripe ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function createCheckoutSession(opts: {
  leadEmail: string;
  leadId: number;
  segment: string;
  amountCents: number;
  productName: string;
}): Promise<string | null> {
  if (!STRIPE_KEY) return null;
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set(
    "success_url",
    `${APP_URL}/thanks?session_id={CHECKOUT_SESSION_ID}`
  );
  params.set("cancel_url", `${APP_URL}/pricing`);
  params.set("customer_email", opts.leadEmail);
  params.set(
    // Stripe Checkout Session expiry must be ≤ 24h from creation for payment mode.
    "expires_at",
    String(Math.floor(Date.now() / 1000) + 23 * 3600)
  );
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(opts.amountCents)
  );
  params.set("line_items[0][price_data][product_data][name]", opts.productName);
  params.set("metadata[leadEmail]", opts.leadEmail);
  params.set("metadata[leadId]", String(opts.leadId));
  params.set("metadata[segment]", opts.segment);
  params.set("metadata[source]", "revenue_cycle");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Checkout session failed (${res.status}): ${body.slice(0, 240)}`
    );
  }
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseFixProvenance(db: SupabaseClient | null): Promise<number> {
  console.log("\n=== PHASE: fix-provenance ===");
  if (!db) {
    console.warn("  ⚠️  Supabase not configured — skipping");
    return 0;
  }

  const { data: leads, error } = await db
    .from("leads")
    .select(
      "id,email,status,score,leadScore,metadata,emailReplied,repliesReceived,source"
    )
    .order("leadScore", { ascending: false })
    .limit(100);

  if (error) {
    console.warn(`  ⚠️  leads query failed: ${error.message}`);
    return 0;
  }

  let fixed = 0;
  let skippedNoSignal = 0;
  let skippedAlready = 0;
  let skippedNotWarm = 0;

  for (const lead of leads ?? []) {
    const status = String(lead.status ?? "").toLowerCase();
    const score = Number(lead.leadScore ?? lead.score ?? 0);
    if (
      !lead.email ||
      !String(lead.email).includes("@") ||
      String(lead.email).startsWith("[pending]")
    ) {
      continue;
    }
    if (!(WARM_STATUSES.has(status) || score >= 70)) {
      skippedNotWarm++;
      continue;
    }

    const meta = (lead.metadata ?? {}) as Record<string, unknown>;
    const existing = metadataProvenance(meta);
    if (existing && VERIFIED_PROVENANCE.has(existing)) {
      skippedAlready++;
      continue;
    }

    const inferred = inferProvenanceFromSignals(lead);
    if (!inferred || !VERIFIED_PROVENANCE.has(inferred.provenance)) {
      skippedNoSignal++;
      continue;
    }

    console.log(
      `  • lead#${lead.id} ${lead.email} → ${inferred.provenance} (from ${inferred.signal})`
    );

    if (isDryRun) {
      console.log(`    WOULD stamp verification_source=${inferred.provenance}`);
      fixed++;
      continue;
    }

    const nextMeta = {
      ...meta,
      verification_source: inferred.provenance,
      provenance: inferred.provenance,
      provenanceSetAt: new Date().toISOString(),
      provenanceNote: `revenue-cycle backfill from ${inferred.signal}`,
    };
    const { error: updErr } = await db
      .from("leads")
      .update({ metadata: nextMeta, updatedAt: new Date().toISOString() })
      .eq("id", lead.id);
    if (updErr) {
      console.warn(`    ⚠️  update failed: ${updErr.message}`);
      continue;
    }
    fixed++;
    console.log(`    ✅ stamped ${inferred.provenance}`);
  }

  console.log(
    `  Done. Fixed/planned: ${fixed}` +
      ` (already verified=${skippedAlready}, no signal=${skippedNoSignal}, not warm=${skippedNotWarm})`
  );
  return fixed;
}

async function phaseCheckoutLinks(db: SupabaseClient | null): Promise<number> {
  console.log("\n=== PHASE: checkout-links ===");
  if (!db) {
    console.warn("  ⚠️  Supabase not configured — skipping");
    return 0;
  }

  const { data: leads, error } = await db
    .from("leads")
    .select(
      "id,email,name,company,status,segment,score,leadScore,metadata,proposalsSent,emailReplied,repliesReceived,source"
    )
    .order("leadScore", { ascending: false })
    .limit(80);

  if (error) {
    console.warn(`  ⚠️  leads query failed: ${error.message}`);
    return 0;
  }

  let skippedUnverified = 0;
  const candidates = (leads ?? []).filter(l => {
    const status = String(l.status ?? "").toLowerCase();
    const score = Number(l.leadScore ?? l.score ?? 0);
    const meta = (l.metadata ?? {}) as Record<string, unknown>;
    if (meta.paymentLink || meta.checkoutUrl) return false;
    if (
      !l.email ||
      !String(l.email).includes("@") ||
      String(l.email).startsWith("[pending]")
    ) {
      return false;
    }
    if (!(WARM_STATUSES.has(status) || score >= 70)) return false;
    if (!hasVerifiedProvenance(l)) {
      skippedUnverified++;
      return false;
    }
    return true;
  });

  console.log(
    `  Candidates needing a payment CTA: ${candidates.length}` +
      (skippedUnverified
        ? ` (skipped ${skippedUnverified} without verified provenance)`
        : "")
  );
  let attached = 0;

  for (const lead of candidates.slice(0, 20)) {
    const cta = segmentPaymentCta(lead.segment);
    if (!cta) continue;
    const attributed = withAttribution(cta.url, lead.id, "warm_checkout");
    const amountHint =
      cta.price.replace(/[^0-9.]/g, "") === ""
        ? 49900
        : Math.round(parseFloat(cta.price.replace(/[^0-9.]/g, "")) * 100);

    console.log(
      `  • lead#${lead.id} ${lead.email} [${lead.segment ?? "n/a"}] → ${cta.name} ${cta.price}`
    );

    if (isDryRun) {
      console.log(`    WOULD attach: ${attributed}`);
      attached++;
      continue;
    }

    let checkoutUrl = attributed;
    if (STRIPE_KEY) {
      try {
        const sessionUrl = await createCheckoutSession({
          leadEmail: lead.email,
          leadId: lead.id,
          segment: String(lead.segment ?? "default"),
          amountCents:
            Number.isFinite(amountHint) && amountHint > 0 ? amountHint : 49900,
          productName: cta.name,
        });
        if (sessionUrl) checkoutUrl = sessionUrl;
      } catch (err: any) {
        console.warn(
          `    ⚠️  Checkout session failed, using static link: ${err.message?.slice(0, 120)}`
        );
      }
    }

    const nextMeta = {
      ...((lead.metadata ?? {}) as object),
      paymentLink: checkoutUrl,
      paymentLinkAttachedAt: new Date().toISOString(),
      paymentProduct: cta.name,
      paymentPriceLabel: cta.price,
    };
    const { error: updErr } = await db
      .from("leads")
      .update({ metadata: nextMeta, updatedAt: new Date().toISOString() })
      .eq("id", lead.id);
    if (updErr) {
      console.warn(`    ⚠️  update failed: ${updErr.message}`);
      continue;
    }
    attached++;
    console.log(`    ✅ attached ${checkoutUrl}`);
  }

  console.log(`  Done. Attached/planned: ${attached}`);
  return attached;
}

async function phaseProposals(db: SupabaseClient | null): Promise<number> {
  console.log("\n=== PHASE: proposals ===");
  if (!db) {
    console.warn("  ⚠️  Supabase not configured — skipping");
    return 0;
  }

  // High-fit unsent gov proposals (if table exists)
  let planned = 0;
  try {
    const { data: govProps, error } = await db
      .from("gov_proposals")
      .select("notice_id,title,agency,fit_score,email_status,contact_email")
      .eq("email_status", "unsent")
      .gte("fit_score", 70)
      .limit(25);

    if (error) {
      console.warn(`  ⚠️  gov_proposals: ${error.message}`);
    } else {
      const withEmail = (govProps ?? []).filter(p => !!p.contact_email);
      console.log(
        `  Gov proposals ready (fit≥70, unsent, has contact): ${withEmail.length}/${(govProps ?? []).length}`
      );
      for (const p of withEmail.slice(0, 10)) {
        const cta = segmentPaymentCta("govchain");
        const url = cta
          ? withAttribution(cta.url, p.notice_id, "gov_proposal")
          : "";
        console.log(
          `  • ${p.notice_id} ${p.agency} fit=${p.fit_score} → CTA ${cta?.name ?? "n/a"}`
        );
        if (isDryRun) {
          console.log(
            `    WOULD stamp payment CTA on draft / enqueue closer: ${url}`
          );
          planned++;
          continue;
        }
        // Persist CTA into a notes-style column if present; otherwise leave for email-proposals.
        await db
          .from("gov_proposals")
          .update({
            payment_link: url,
            updated_at: new Date().toISOString(),
          })
          .eq("notice_id", p.notice_id);
        planned++;
      }
    }
  } catch (err: any) {
    console.warn(`  ⚠️  gov proposals phase error: ${err.message}`);
  }

  // Warm leads with replies / high score but no proposalsSent
  const { data: warm, error: warmErr } = await db
    .from("leads")
    .select(
      "id,email,segment,status,proposalsSent,emailReplied,leadScore,score,metadata"
    )
    .or("emailReplied.eq.true,leadScore.gte.70,score.gte.70")
    .limit(30);

  if (warmErr) {
    console.warn(`  ⚠️  warm leads: ${warmErr.message}`);
  } else {
    const needProposal = (warm ?? []).filter(
      l => (l.proposalsSent ?? 0) === 0 && !!l.email
    );
    console.log(`  Warm leads with 0 proposalsSent: ${needProposal.length}`);
    for (const l of needProposal.slice(0, 10)) {
      const cta = segmentPaymentCta(l.segment);
      console.log(
        `  • lead#${l.id} ${l.email} status=${l.status} → propose ${cta?.name ?? "?"}`
      );
      if (isDryRun) {
        planned++;
        continue;
      }
      const meta = {
        ...((l.metadata ?? {}) as object),
        needsProposal: true,
        suggestedPaymentLink: cta?.url ?? null,
        revenueCycleFlaggedAt: new Date().toISOString(),
      };
      await db.from("leads").update({ metadata: meta }).eq("id", l.id);
      planned++;
    }
  }

  console.log(`  Done. Planned/updated: ${planned}`);
  return planned;
}

async function phaseDunning(): Promise<boolean> {
  console.log("\n=== PHASE: dunning ===");
  // APP_URL/api/cron/dunning 404s: authichain.com is the marketing worker and
  // does not host Next cron routes (Vercel app deleted 2026-09-08). Run the
  // job inline the same way pipeline-tick does — no HTTP hop.
  if (isDryRun) {
    console.log(
      "  WOULD run server/jobs/dunning.runDunningEscalation() " +
        `(DUNNING_ENABLED=${process.env.DUNNING_ENABLED ?? "unset"})`
    );
    return true;
  }

  if (process.env.DUNNING_ENABLED !== "true") {
    console.warn(
      '  ⚠️  DUNNING_ENABLED is not "true" — skipping (set repo var to enable sends)'
    );
    return false;
  }

  try {
    const { runDunningEscalation } = await import("../server/jobs/dunning");
    const result = await runDunningEscalation();
    console.log(`  Result: ${JSON.stringify(result)}`);
    return !result.skipped;
  } catch (err: any) {
    console.warn(`  ⚠️  Inline dunning failed (non-fatal): ${err.message}`);
    return false;
  }
}

async function phaseReport(db: SupabaseClient | null): Promise<void> {
  console.log("\n=== PHASE: report ===");
  const lines: string[] = [
    "💰 REVENUE CYCLE HEALTH REPORT",
    `mode=${isDryRun ? "DRY_RUN" : "LIVE"}`,
  ];

  if (db) {
    try {
      const { data: leads } = await db
        .from("leads")
        .select("status,metadata")
        .limit(2000);
      const byStatus: Record<string, number> = {};
      let withPay = 0;
      for (const l of leads ?? []) {
        const st = String(l.status ?? "unknown");
        byStatus[st] = (byStatus[st] ?? 0) + 1;
        const meta = (l.metadata ?? {}) as Record<string, unknown>;
        if (meta.paymentLink || meta.checkoutUrl) withPay++;
      }
      lines.push(`Leads sampled: ${(leads ?? []).length}`);
      lines.push(
        `  by status: ${Object.entries(byStatus)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      );
      lines.push(`  with paymentLink in metadata: ${withPay}`);
    } catch (err: any) {
      lines.push(`Leads: failed (${err.message})`);
    }

    try {
      const { data: props } = await db
        .from("gov_proposals")
        .select("email_status,fit_score,payment_link")
        .limit(500);
      const unsent = (props ?? []).filter(
        p => p.email_status === "unsent"
      ).length;
      const withLink = (props ?? []).filter(p => !!p.payment_link).length;
      lines.push(
        `Gov proposals sampled: ${(props ?? []).length} (unsent=${unsent}, with payment_link=${withLink})`
      );
    } catch {
      lines.push("Gov proposals: table unavailable or query failed");
    }

    try {
      const { data: rev } = await db
        .from("revenue_records")
        .select("amount,createdAt,created_at")
        .order("createdAt", { ascending: false })
        .limit(100);
      const total = (rev ?? []).reduce(
        (sum, r: any) => sum + Number(r.amount ?? 0),
        0
      );
      lines.push(
        `revenue_records (last ≤100): count=${(rev ?? []).length} sum_amount=${total}`
      );
    } catch {
      lines.push("revenue_records: unavailable");
    }
  } else {
    lines.push("Supabase: not configured");
  }

  if (STRIPE_KEY) {
    try {
      const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
      const charges = await stripeGet(
        `/charges?created[gte]=${since}&limit=100`
      );
      const paid = (charges.data ?? []).filter(
        (c: any) => c.paid && !c.refunded
      );
      const total = paid.reduce((s: number, c: any) => s + c.amount, 0) / 100;
      lines.push(
        `Stripe charges (30d, ≤100): $${total.toFixed(2)} (${paid.length} paid)`
      );
    } catch (err: any) {
      lines.push(`Stripe: ${err.message?.slice(0, 160)}`);
    }
  } else {
    lines.push("Stripe: STRIPE_SECRET_KEY not set");
  }

  lines.push(`Catalog CTAs ready:`);
  lines.push(
    `  QRON Creator: ${PLANS.find(p => p.id === "creator")?.stripe_payment_link ?? PAYMENT_LINKS.qron.brandPack.url}`
  );
  lines.push(`  AuthiChain Starter: ${PAYMENT_LINKS.authichain.starter.url}`);
  lines.push(`  StrainChain Basic: ${PAYMENT_LINKS.strainchain.basic.url}`);
  lines.push(`Generated: ${new Date().toISOString()}`);

  console.log(lines.join("\n"));
}

async function main() {
  console.log(`Revenue Cycle starting — phase=${PHASE} dry_run=${isDryRun}`);
  const db = supabase();

  try {
    if (PHASE === "all" || PHASE === "report") {
      await phaseReport(db);
    }
    if (PHASE === "all" || PHASE === "fix-provenance") {
      await phaseFixProvenance(db);
    }
    if (PHASE === "all" || PHASE === "checkout-links") {
      await phaseCheckoutLinks(db);
    }
    if (PHASE === "all" || PHASE === "proposals") {
      await phaseProposals(db);
    }
    if (PHASE === "all" || PHASE === "dunning") {
      try {
        await phaseDunning();
      } catch (err: any) {
        console.warn(`  ⚠️  dunning failed (non-fatal): ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Revenue cycle failed: ${err.message}`);
    if (!isDryRun) process.exit(1);
    process.exit(0);
  }

  console.log("\n✅ Revenue cycle complete");
}

main().catch(err => {
  console.error(err);
  process.exit(isDryRun ? 0 : 1);
});
