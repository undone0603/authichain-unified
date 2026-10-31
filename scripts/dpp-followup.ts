/**
 * One follow-up email to people who asked, on /dpp-check, to have their result
 * emailed to them. See src/lib/dpp-followup.ts for what the rows mean and why
 * the template is fixed. Runbook: docs/growth/DPP_FOLLOWUP.md.
 *
 *   pnpm exec tsx scripts/dpp-followup.ts            # dry run (default)
 *   DRY_RUN=false OWNER_LIVE_SEND=true \
 *     pnpm exec tsx scripts/dpp-followup.ts          # live
 *
 * Fail-closed, the same way as scripts/b2b-cold-outreach.ts:
 * - Anything but DRY_RUN=false is a dry run.
 * - A live run additionally needs OWNER_LIVE_SEND=true, and sends at most
 *   MAX_LIVE_SENDS (default 3) per run.
 * - Every message goes through guardedSend: provenance (inbound_optin), MX,
 *   postal address, recordable opt-out, claims filter. A dry run goes through
 *   the same gates and stops just before the network, so "would_send" in the
 *   report means every gate passed.
 * - priorContact() skips anyone who is suppressed or already emailed by any
 *   script, and fails closed if the history cannot be read. So does the
 *   past-checkout lookup below.
 * - Anyone who has started checkout or paid is skipped: a buyer must never be
 *   pitched what they bought, and an abandoned checkout has its own email.
 *
 * Output never contains a full address: Actions logs and step summaries are
 * visible to everyone with repository access.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { withDryRunEmail } from "../server/email-service";
import { guardedSend } from "../server/outreach/send-guard";
import {
  buildDppFollowup,
  DPP_FOLLOWUP_WORKFLOW,
  DPP_OPTIN_INTEREST,
  DPP_OPTIN_SOURCE,
  DPP_PAST_CHECKOUT_EVENT_TYPES,
  emailsPastCheckout,
  selectDueFollowups,
  type OptInRow,
} from "../src/lib/dpp-followup";
import { checkSender, reportSenderFailure } from "./lib/resend-preflight";
import { priorContact, recordContact } from "./lib/send-history";

const CHANNEL = "dpp-followup";
const FROM = process.env.RESEND_FROM ?? "AuthiChain <hello@authichain.com>";
/** Opt-ins older than this are never emailed (selectDueFollowups' maxAgeDays is 14). */
const LOOKBACK_DAYS = 15;

/** `jo***@example.com`: enough to recognise in a log, not enough to contact. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export type Outcome = {
  who: string;
  status: "would_send" | "sent" | "skipped" | "failed";
  detail: string;
};

export function renderReport(
  mode: "dry-run" | "live",
  considered: number,
  outcomes: readonly Outcome[]
): string {
  const lines = [
    `## DPP follow-up (${mode})`,
    "",
    `Opt-ins in the window: ${considered}. Due: ${outcomes.length}.`,
    "",
  ];
  if (outcomes.length === 0) lines.push("Nothing due.");
  else {
    lines.push("| Recipient | Result | Detail |", "|---|---|---|");
    for (const o of outcomes) {
      lines.push(`| ${o.who} | ${o.status} | ${o.detail} |`);
    }
  }
  return lines.join("\n") + "\n";
}

/** The slice of the Supabase client this script uses; tests pass a fake. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Admin = { from: (table: string) => any };

export interface RunResult {
  code: number;
  report: string;
  outcomes: Outcome[];
}

export async function run(
  admin: Admin,
  env: Record<string, string | undefined> = process.env
): Promise<RunResult> {
  const requestedLive = env.DRY_RUN === "false";
  const ownerLive = env.OWNER_LIVE_SEND === "true";
  const live = requestedLive && ownerLive;
  if (requestedLive && !ownerLive) {
    console.warn(
      "::warning::DRY_RUN=false but OWNER_LIVE_SEND is not true: staying in dry run."
    );
  }
  const maxLive = Math.max(1, Number(env.MAX_LIVE_SENDS ?? "3") || 3);
  const failure = (message: string): RunResult => {
    console.error(`::error::${message}`);
    return { code: 1, report: "", outcomes: [] };
  };

  const cutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 86_400_000
  ).toISOString();
  const optIns = await admin
    .from("lead_captures")
    .select("id,email,source,product_interest,message,created_at")
    .eq("source", DPP_OPTIN_SOURCE)
    .eq("product_interest", DPP_OPTIN_INTEREST)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(500);
  if (optIns.error) {
    return failure(`Could not read opt-ins: ${optIns.error.message}`);
  }
  const rows = (optIns.data ?? []) as OptInRow[];

  // Fail closed: if we cannot tell who has reached checkout, send nobody.
  const pastCheckout = await admin
    .from("funnel_events")
    .select("metadata")
    .in("event_type", [...DPP_PAST_CHECKOUT_EVENT_TYPES])
    .limit(5000);
  if (pastCheckout.error) {
    return failure(
      `Could not read checkout history: ${pastCheckout.error.message}`
    );
  }

  const due = selectDueFollowups(
    rows,
    emailsPastCheckout(pastCheckout.data ?? []),
    {
      limit: 50,
    }
  );

  const outcomes: Outcome[] = [];
  let liveAttempts = 0;
  let sender: Awaited<ReturnType<typeof checkSender>> | null = null;

  for (const lead of due) {
    const who = maskEmail(lead.email);

    const prior = await priorContact(admin, lead.email);
    if (prior.blocked) {
      outcomes.push({
        who,
        status: "skipped",
        detail: prior.reason ?? "blocked",
      });
      continue;
    }

    const draft = buildDppFollowup(lead.result);

    if (!live) {
      // Same gates as a live send; guardedSend stops just before the network
      // and reports "dry_run" only when every gate passed.
      const { result } = await withDryRunEmail(() =>
        guardedSend({
          to: lead.email,
          source: "inbound_optin",
          subject: draft.subject,
          body: draft.body,
          from: FROM,
        })
      );
      outcomes.push(
        result.reason === "dry_run"
          ? { who, status: "would_send", detail: draft.subject }
          : {
              who,
              status: "skipped",
              detail: `blocked: ${result.reason ?? "unknown"}`,
            }
      );
      continue;
    }

    if (liveAttempts >= maxLive) {
      outcomes.push({
        who,
        status: "skipped",
        detail: "MAX_LIVE_SENDS reached",
      });
      continue;
    }
    sender ??= await checkSender(FROM);
    if (!sender.ok) {
      reportSenderFailure(sender, CHANNEL);
      outcomes.push({ who, status: "failed", detail: "sender cannot send" });
      continue;
    }

    liveAttempts += 1;
    const res = await guardedSend({
      to: lead.email,
      source: "inbound_optin",
      subject: draft.subject,
      body: draft.body,
      from: FROM,
      apiKey: sender.credential ? env[sender.credential] : undefined,
    });
    if (res.sent) {
      await recordContact(admin, lead.email, CHANNEL);
      await admin.from("automation_logs").insert({
        workflow_name: DPP_FOLLOWUP_WORKFLOW,
        trigger_type: "event",
        status: "success",
        payload: JSON.stringify({
          resend_id: res.id ?? null,
          opted_in_at: lead.createdAt,
          category: lead.result.category,
        }),
      });
      outcomes.push({ who, status: "sent", detail: draft.subject });
    } else if (res.reason === "dry_run") {
      // Cannot happen outside withDryRunEmail; never report it as sent.
      outcomes.push({ who, status: "skipped", detail: "dry_run" });
    } else {
      outcomes.push({
        who,
        status: "failed",
        detail: res.reason ?? "not sent",
      });
    }
  }

  const report = renderReport(live ? "live" : "dry-run", rows.length, outcomes);
  const failed = outcomes.filter(o => o.status === "failed").length;
  if (failed > 0) {
    console.error(`::error::${failed} follow-up(s) failed to send.`);
  }
  return { code: failed > 0 ? 1 : 0, report, outcomes };
}

async function main(): Promise<number> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("::error::Supabase credentials are not configured.");
    return 1;
  }
  const { code, report } = await run(createClient(url, key));
  if (report) {
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    }
  }
  return code;
}

// Only run when invoked directly, so the helpers above can be imported by tests.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().then(
    code => process.exit(code),
    err => {
      console.error(
        `::error::dpp-followup crashed: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  );
}
