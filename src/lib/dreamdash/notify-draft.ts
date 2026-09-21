// Founder-only DreamDash draft alert. Never emails the lead.
// ntfy is always attempted; Resend is optional when a key is present.
// Does not thaw outbound AgentZ / outreach workflows.

import { draftFor, mailtoFor } from "./metrics";
import type { Lead } from "./types";

const NTFY_URL = "https://ntfy.sh/zk_live_alerts_99";
const RESEND_URL = "https://api.resend.com/emails";
const RESEND_FROM = "AuthiChain <hello@authichain.com>";
export const FOUNDER_INBOXES = ["authichain@gmail.com", "undone.k@gmail.com"] as const;

export type DraftNotifyReason = "cycle" | "capture" | "followup" | "digest";

export type DraftNotifyEnv = {
  RESEND_API_KEY?: string;
  RESEND_API_KEY2?: string;
};

export function newlyDrafted(prev: Lead[], next: Lead[]): Lead[] {
  return next.filter((lead) => {
    if (!lead.draftPending || lead.lost) return false;
    const before = prev.find((p) => p.id === lead.id);
    return !before || !before.draftPending;
  });
}

export function formatDraftAlert(lead: Lead, reason: DraftNotifyReason): {
  title: string;
  text: string;
  subject: string;
} {
  const draft = draftFor(lead);
  const mailto = mailtoFor(lead);
  const title = `DreamDash draft · ${lead.company}`;
  const subject = `[dreamdash] draft ready — ${lead.company}`;
  const text = [
    `reason: ${reason}`,
    `company: ${lead.company}`,
    `name: ${lead.name}`,
    `email: ${lead.email}`,
    `domain: ${lead.domain}`,
    `stage: ${lead.stage}`,
    `score: ${lead.score}`,
    `mailto: ${mailto}`,
    "",
    draft,
    "",
    "Founder-only. Do not send from AgentZ. Open the mailto from your inbox.",
  ].join("\n");
  return { title, text, subject };
}

export function formatDigestAlert(digest: string): {
  title: string;
  text: string;
  subject: string;
} {
  return {
    title: "DreamDash digest",
    subject: "[dreamdash] founders digest",
    text: `${digest}\n\nFounder-only. Local copy + this alert. No Slack webhook.`,
  };
}

async function deliver(alert: { title: string; text: string; subject: string }, env?: DraftNotifyEnv) {
  const jobs: Promise<unknown>[] = [
    fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: alert.title,
        "Content-Type": "text/plain",
      },
      body: alert.text,
    }),
  ];
  const apiKey = (env?.RESEND_API_KEY2 || env?.RESEND_API_KEY || process.env.RESEND_API_KEY2 || process.env.RESEND_API_KEY || "").trim();
  if (apiKey) {
    jobs.push(
      fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [...FOUNDER_INBOXES],
          subject: alert.subject,
          text: alert.text,
        }),
      }),
    );
  }
  await Promise.allSettled(jobs);
}

export async function notifyDraft(lead: Lead, reason: DraftNotifyReason, env?: DraftNotifyEnv): Promise<void> {
  if (!lead.draftPending || lead.lost) return;
  try {
    await deliver(formatDraftAlert(lead, reason), env);
  } catch {
    // Swallow — cycle / capture must not depend on alert delivery.
  }
}

export async function notifyDrafts(leads: Lead[], reason: DraftNotifyReason, env?: DraftNotifyEnv): Promise<number> {
  const pending = leads.filter((l) => l.draftPending && !l.lost);
  for (const lead of pending) {
    await notifyDraft(lead, reason, env);
  }
  return pending.length;
}

export async function notifyDigest(digest: string, env?: DraftNotifyEnv): Promise<void> {
  try {
    await deliver(formatDigestAlert(digest), env);
  } catch {
    // Swallow — digest UI still renders locally.
  }
}
