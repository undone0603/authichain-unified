// scripts/email-proposals.ts
// Daily digest of high-fit government opportunities, emailed to the owner.
//
// This script used to email the solicitation's point of contact directly: an
// AI-written "proposal" under the subject "GovChain Proposal: <agency> —
// 87/100 Match", opening "We've identified a government opportunity that
// aligns exceptionally well with your agency's mission", with a fit reason
// claiming "our core expertise in NFT-based government contracts" and an
// unsubscribe link to govchain.us/unsubscribe, which does not exist.
//
// A contracting officer's address on SAM.gov is there for questions about that
// solicitation, not for marketing, and a proposal is submitted the way the
// solicitation says, not by cold email. guardedSend now refuses .gov and .mil
// recipients outright (server/outreach/recipient-rules.ts). What is useful is
// knowing which opportunities matched, so a person can read the solicitation
// and respond through it. That is what this sends, to one internal inbox.
//
// Proposals included in a digest move from email_status 'unsent' to
// 'owner_notified' so each appears once.

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  checkSender,
  reportSenderFailure,
  CREDENTIAL_ENV_VARS,
} from "./lib/resend-preflight";

// Fail-closed: unset / any value other than "false" is dry-run.
const isDryRun = process.env.DRY_RUN !== "false";
const GOVCHAIN = process.env.GOVCHAIN_URL ?? "https://govchain.us";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "proposals@authichain.com";
// Internal only: the digest goes to the people who will read the
// solicitations, never to an agency.
const OWNER_EMAIL =
  process.env.OWNER_NOTIFY_EMAIL ??
  process.env.RESEND_REPLY_TO ??
  "hello@authichain.com";

interface Proposal {
  notice_id: string;
  title: string;
  agency: string;
  fit_score: number;
  deadline?: string | null;
  sam_url?: string | null;
  contact_email?: string | null;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

function samUrl(p: Proposal): string {
  return p.sam_url || `https://sam.gov/opp/${encodeURIComponent(p.notice_id)}/view`;
}

export function digestHtml(proposals: Proposal[]): string {
  const rows = proposals
    .map(
      p => `<li>
  <strong>${esc(p.title)}</strong><br>
  ${esc(p.agency)} · fit ${esc(p.fit_score)}/100 (our internal score) · deadline ${esc(p.deadline || "not stated")}<br>
  <a href="${esc(samUrl(p))}">Solicitation on SAM.gov</a> ·
  <a href="${esc(`${GOVCHAIN}/${encodeURIComponent(p.notice_id)}`)}">Our draft notes</a>
</li>`
    )
    .join("\n");
  return `<div style="font-family:sans-serif;max-width:640px;line-height:1.5;color:#1f2937">
<p>${proposals.length} opportunit${proposals.length === 1 ? "y" : "ies"} scored 70 or higher and ${proposals.length === 1 ? "has" : "have"} not been reviewed yet.</p>
<p>Respond through each solicitation's own instructions. Nothing was emailed to any agency.</p>
<ol>
${rows}
</ol>
</div>`;
}

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from("gov_proposals")
    .select("notice_id,title,agency,fit_score,deadline,sam_url,contact_email")
    .eq("email_status", "unsent")
    .gte("fit_score", 70)
    .order("fit_score", { ascending: false })
    .limit(50);
  if (error) throw error;

  const proposals = (data ?? []) as Proposal[];
  if (!proposals.length) {
    console.log("No new high-fit proposals to report.");
    return;
  }

  const subject = `GovChain: ${proposals.length} new high-fit opportunit${proposals.length === 1 ? "y" : "ies"} to review`;
  const html = digestHtml(proposals);

  if (isDryRun) {
    console.log(`[DRY RUN] Would email ${OWNER_EMAIL}: ${subject}`);
    for (const p of proposals) {
      console.log(`  • ${p.notice_id} ${p.agency} fit=${p.fit_score} ${samUrl(p)}`);
    }
    return;
  }

  if (!CREDENTIAL_ENV_VARS.some(name => process.env[name])) {
    console.warn(
      `⚠️  No Resend credential configured (${CREDENTIAL_ENV_VARS.join(" / ")}) — digest not sent.`
    );
    return;
  }
  const check = await checkSender(FROM_EMAIL);
  if (!check.ok) {
    reportSenderFailure(check, "gov-proposals-digest");
    throw new Error(`Sender preflight failed for ${FROM_EMAIL}: ${check.reason}`);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env[check.credential!]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [OWNER_EMAIL], subject, html }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Digest send failed: HTTP ${res.status} ${body.message ?? ""}`);
  }
  console.log(`✉️  Digest of ${proposals.length} opportunities sent to ${OWNER_EMAIL}`);

  const { error: updateErr } = await supabase
    .from("gov_proposals")
    .update({ email_status: "owner_notified" })
    .in(
      "notice_id",
      proposals.map(p => p.notice_id)
    );
  if (updateErr) {
    console.error(
      `::warning::Digest sent but proposals not marked owner_notified (${updateErr.message}); they will appear in tomorrow's digest too.`
    );
  }
}

// Import-safe for tests: only run when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
