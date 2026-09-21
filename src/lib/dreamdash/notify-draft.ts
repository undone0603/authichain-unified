// Founder-only DreamDash draft alert. Never emails the lead.
// ntfy topic + SMS gateways + optional Resend. Does not thaw outreach.

import { FOUNDER_INBOXES, publishFounderAlert, type FounderAlertEnv } from "@/lib/founder-alerts";
import { draftFor, mailtoFor } from "./metrics";
import type { Lead } from "./types";

export { FOUNDER_INBOXES };

export type DraftNotifyReason = "cycle" | "capture" | "followup" | "digest";
export type DraftNotifyEnv = FounderAlertEnv;

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

export async function notifyDraft(lead: Lead, reason: DraftNotifyReason, env?: DraftNotifyEnv): Promise<void> {
  if (!lead.draftPending || lead.lost) return;
  try {
    await publishFounderAlert(formatDraftAlert(lead, reason), env);
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
    await publishFounderAlert(formatDigestAlert(digest), env);
  } catch {
    // Swallow — digest UI still renders locally.
  }
}
