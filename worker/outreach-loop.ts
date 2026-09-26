/**
 * Autonomous outreach + reply loop for the authichain Worker.
 *
 * Uses Gmail OAuth secrets already on the Worker:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM_EMAIL
 *
 * Required to send:
 *   OUTREACH_AUTONOMOUS — must be "true"
 *   MAILING_ADDRESS — CAN-SPAM postal address; sends fail closed without it
 *
 * Optional:
 *   RESEND_API_KEY — founder alerts
 *   OUTREACH_REPLY_TO — defaults to GMAIL_FROM_EMAIL
 *   OUTREACH_DAILY_CAP — default 10 (hard max 25)
 *   OUTREACH_FOLLOWUP_DAYS — default 3
 *   OUTREACH_AUTO_NURTURE — "true" to auto-answer positive replies. Off by
 *     default: the founder is notified of every reply and answers in person.
 *
 * Not imported by worker/index.ts or deployed as of 2026-09-23 (the live
 * `authichain` bundle has no outreach code). It is kept to the same rules as
 * every other sender so wiring it up later cannot bring back what the
 * 2026-05-16 and September sends did:
 *   - recipients need trusted provenance (server/outreach/recipient-rules.ts);
 *     .gov/.mil and role inboxes are refused
 *   - every message passes the claim checker (server/outreach/claims.ts)
 *   - no "there" / "your company" fallbacks, no fake "Re:" on a first touch
 *   - a postal address and a working opt-out (reply "unsubscribe", which
 *     NEGATIVE_RE below handles) in every message, plus List-Unsubscribe
 *   - a failed send is not retried every run; an auth error stops the batch
 *
 * State lives in KV (SESSIONS binding) so we don't depend on D1 CLI access.
 *
 * Loop:
 *   1) send queued leads (daily cap)
 *   2) poll Gmail for real replies → founder notify + positive nurture / negative suppress
 *   3) follow up once on non-responders after N days
 */

import { checkClaims } from "../server/outreach/claims";
import {
  assessRecipient,
  type VerificationSource,
} from "../server/outreach/recipient-rules";

export interface OutreachEnv {
  SESSIONS: KVNamespace;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GMAIL_FROM_EMAIL?: string;
  OUTREACH_REPLY_TO?: string;
  OUTREACH_DAILY_CAP?: string;
  OUTREACH_AUTONOMOUS?: string;
  OUTREACH_FOLLOWUP_DAYS?: string;
  RESEND_API_KEY?: string;
  FOUNDER_NOTIFY_EMAIL?: string;
  CRON_SECRET?: string;
  MAILING_ADDRESS?: string;
  OUTREACH_AUTO_NURTURE?: string;
}

export type OutreachLead = {
  email: string;
  name?: string;
  company?: string;
  industry?: string;
  source?: string;
  /** Where the address came from. Must be a trusted VerificationSource to send. */
  verificationSource?: string;
  status?:
    | "queued"
    | "sent"
    | "followup_sent"
    | "replied"
    | "nurtured"
    | "failed"
    | "suppressed";
  threadId?: string;
  messageId?: string;
  rfcMessageId?: string;
  sentAt?: string;
  followUpAt?: string;
  lastReplyAt?: string;
  lastReplySnippet?: string;
  suppressReason?: string;
};

const QUEUE_KEY = "outreach:queue";
const LEAD_PREFIX = "outreach:lead:";
const SENT_TODAY_KEY = "outreach:sent_date";
const PROCESSED_PREFIX = "outreach:processed:";
const LABEL_NAME = "outreach-processed";
const LABEL_CACHE_KEY = "outreach:label_id";

const POSITIVE_RE =
  /yes|interested|schedule|call|demo|sounds good|let'?s talk|book|available|keen|absolutely|please send/i;
const NEGATIVE_RE =
  /unsubscribe|not interested|no thanks|stop emailing|remove me|don't contact|do not contact|wrong person|leave me alone/i;
const BOUNCE_FROM_RE = /mailer-daemon@|postmaster@/i;
/** "not available", "don't call", "no demo" etc. are not a yes. */
const NEGATED_RE =
  /\b(not|no|don'?t|do not|never|isn'?t|won'?t|can'?t|cannot)\b[^.!?\n]{0,25}\b(interested|call|demo|book|available|schedule|send)\b/i;

/**
 * Auto-answer a reply only when explicitly enabled and the reply reads as a
 * yes. A keyword match on "call" or "available" is not consent: "please
 * don't call" matched POSITIVE_RE before this.
 */
export function shouldAutoNurture(env: OutreachEnv, text: string): boolean {
  return (
    env.OUTREACH_AUTONOMOUS === "true" &&
    env.OUTREACH_AUTO_NURTURE === "true" &&
    POSITIVE_RE.test(text) &&
    !NEGATIVE_RE.test(text) &&
    !NEGATED_RE.test(text)
  );
}

/** Role / catch-all localparts — never treat as decision-makers. */
const ROLE_LOCALPARTS = new Set([
  "info",
  "support",
  "help",
  "contact",
  "sales",
  "admin",
  "hello",
  "billing",
  "noreply",
  "no-reply",
  "team",
  "office",
  "ops",
  "operations",
  "press",
  "media",
  "hr",
  "jobs",
  "careers",
]);

const TITLE_AS_NAME_RE =
  /^(operations?\s+director|director|manager|compliance|owner|founder|ceo|cto|coo|vp|head of|team|staff|admin)$/i;

function isRoleInbox(email: string): boolean {
  const local = email.trim().toLowerCase().split("@")[0] || "";
  return ROLE_LOCALPARTS.has(local);
}

function isNamedHuman(name?: string): boolean {
  const n = String(name || "").trim();
  if (!n || n.length < 2) return false;
  if (TITLE_AS_NAME_RE.test(n)) return false;
  if (!/[A-Za-z]/.test(n)) return false;
  if (/^(there|friend|team|sir|madam)$/i.test(n)) return false;
  return true;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function getQueue(env: OutreachEnv): Promise<string[]> {
  const raw = await env.SESSIONS.get(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function putQueue(env: OutreachEnv, emails: string[]) {
  await env.SESSIONS.put(
    QUEUE_KEY,
    JSON.stringify([...new Set(emails.map(e => e.toLowerCase()))])
  );
}

async function getLead(env: OutreachEnv, email: string): Promise<OutreachLead | null> {
  const raw = await env.SESSIONS.get(LEAD_PREFIX + email.toLowerCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OutreachLead;
  } catch {
    return null;
  }
}

async function putLead(env: OutreachEnv, lead: OutreachLead) {
  const email = lead.email.toLowerCase();
  await env.SESSIONS.put(LEAD_PREFIX + email, JSON.stringify({ ...lead, email }));
}

async function getGmailAccessToken(env: OutreachEnv): Promise<string | null> {
  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error(
      "[outreach] gmail token refresh failed",
      res.status,
      await res.text().catch(() => "")
    );
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token || null;
}

function toBase64Url(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Encode Subject for UTF-8 safety (ASCII path stays plain). */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const bytes = new TextEncoder().encode(subject);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

/**
 * First-touch copy. Every statement matches the "EU DPP Readiness Audit" entry
 * in src/lib/plans.ts. There is deliberately no fallback for a missing name or
 * company: gmailSend refuses a message with an unfilled placeholder.
 */
function renderTemplate(lead: OutreachLead): { subject: string; body: string } {
  const name = lead.name?.trim() || "{{name}}";
  const company = lead.company?.trim() || "{{company}}";
  const subject = `EU Digital Product Passport readiness for ${company}`;
  const body = [
    `Hi ${name.split(/\s+/)[0]},`,
    ``,
    `I'm Zac, founder of AuthiChain, a small company that builds product-authentication and Digital Product Passport tools.`,
    ``,
    `If ${company} sells into the EU, or sells to brands that do, we offer a one-time EU DPP Readiness Audit for $299: a written readiness assessment and a self-serve AuthiChain workspace to publish a first passport. The $299 is credited toward AuthiChain Basic if you continue.`,
    ``,
    `Details: https://authichain.com/dpp?utm_source=email&utm_medium=autonomous&utm_campaign=dpp_outreach`,
    ``,
    `If a 15-minute call would be easier, reply with a time that suits you. If this isn't relevant, a one-line reply is enough.`,
    ``,
    `Zac`,
    `AuthiChain`,
  ].join("\n");
  return { subject, body };
}

/** One follow-up in the same thread. Same subject as the original, not a manufactured "Re:". */
function renderFollowUp(lead: OutreachLead): { subject: string; body: string } {
  const { subject } = renderTemplate(lead);
  const name = lead.name?.trim() || "{{name}}";
  const body = [
    `Hi ${name.split(/\s+/)[0]},`,
    ``,
    `Following up once on my note about EU Digital Product Passport readiness. If it's not relevant, no reply is needed and I won't write again.`,
    ``,
    `https://authichain.com/dpp?utm_source=email&utm_medium=autonomous_followup&utm_campaign=dpp_outreach`,
    ``,
    `Zac`,
  ].join("\n");
  return { subject, body };
}

/** "Hi Dana," for a named person, "Hello," otherwise — never "Hi there,". */
function greet(name?: string): string {
  return isNamedHuman(name) ? `Hi ${name!.trim().split(/\s+/)[0]},` : "Hello,";
}

/** Why a lead may not be emailed, or [] when it may. */
export function leadSendBlockers(lead: OutreachLead): string[] {
  const reasons = assessRecipient(
    lead.email,
    (lead.verificationSource ?? "unknown") as VerificationSource
  ).reasons;
  if (!isNamedHuman(lead.name)) reasons.push("name_not_human");
  if (!lead.company?.trim()) reasons.push("missing_company");
  return reasons;
}

async function gmailSend(
  env: OutreachEnv,
  token: string,
  lead: OutreachLead,
  opts?: {
    subject?: string;
    body?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<{ ok: boolean; id?: string; threadId?: string; error?: string; auth?: boolean }> {
  const fromEmail = env.GMAIL_FROM_EMAIL;
  // Configuration problems fail every lead the same way, so they stop the
  // batch (`auth`) instead of marking each lead failed.
  if (!fromEmail) return { ok: false, error: "GMAIL_FROM_EMAIL unset", auth: true };
  const address = env.MAILING_ADDRESS?.trim();
  if (!address) return { ok: false, error: "mailing_address_not_configured", auth: true };
  const replyTo = env.OUTREACH_REPLY_TO || fromEmail;
  const rendered = renderTemplate(lead);
  const subject = opts?.subject || rendered.subject;
  // A reply inside the recipient's own thread legitimately carries "Re:", so
  // only the body is checked then; everything else is checked in full.
  const violations = checkClaims(opts?.inReplyTo ? "" : subject, opts?.body || rendered.body);
  if (violations.length) {
    return {
      ok: false,
      error: `claims:${violations.map(v => `${v.rule}:${v.match}`).join(",")}`,
    };
  }
  const body = [
    opts?.body || rendered.body,
    ``,
    `--`,
    `AuthiChain`,
    address,
    `To stop these emails, reply "unsubscribe".`,
  ].join("\n");

  const mimeLines = [
    `From: Zac at AuthiChain <${fromEmail}>`,
    `To: ${lead.email}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeSubject(subject)}`,
    `List-Unsubscribe: <mailto:${replyTo}?subject=unsubscribe>`,
  ];
  if (opts?.inReplyTo) mimeLines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts?.references) mimeLines.push(`References: ${opts.references}`);
  mimeLines.push(
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body
  );

  const payload: Record<string, string> = { raw: toBase64Url(mimeLines.join("\r\n")) };
  if (opts?.threadId) payload.threadId = opts.threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: `gmail_send_${res.status}:${(await res.text()).slice(0, 200)}`,
      auth: res.status === 401 || res.status === 403,
    };
  }
  const data = (await res.json()) as { id?: string; threadId?: string };
  return { ok: true, id: data.id, threadId: data.threadId };
}

async function notifyFounder(env: OutreachEnv, subject: string, text: string) {
  const key = env.RESEND_API_KEY;
  const to = env.FOUNDER_NOTIFY_EMAIL || "undone.k@gmail.com";
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AuthiChain Outreach <noreply@authichain.com>",
      to: [to],
      reply_to: to,
      subject,
      text,
    }),
  }).catch(() => undefined);
}

async function ensureProcessedLabelId(env: OutreachEnv, token: string): Promise<string | null> {
  const cached = await env.SESSIONS.get(LABEL_CACHE_KEY);
  if (cached) return cached;

  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return null;
  const list = (await listRes.json()) as {
    labels?: Array<{ id: string; name: string }>;
  };
  const existing = (list.labels || []).find(l => l.name === LABEL_NAME);
  if (existing) {
    await env.SESSIONS.put(LABEL_CACHE_KEY, existing.id);
    return existing.id;
  }

  const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  if (!createRes.ok) return null;
  const created = (await createRes.json()) as { id?: string };
  if (!created.id) return null;
  await env.SESSIONS.put(LABEL_CACHE_KEY, created.id);
  return created.id;
}

async function markProcessed(
  env: OutreachEnv,
  token: string,
  messageId: string
): Promise<void> {
  await env.SESSIONS.put(
    PROCESSED_PREFIX + messageId,
    new Date().toISOString(),
    { expirationTtl: 60 * 60 * 24 * 45 }
  );
  const labelId = await ensureProcessedLabelId(env, token);
  if (!labelId) return;
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds: [] }),
    }
  ).catch(() => undefined);
}

async function wasProcessed(env: OutreachEnv, messageId: string): Promise<boolean> {
  return (await env.SESSIONS.get(PROCESSED_PREFIX + messageId)) !== null;
}

/** Enqueue leads (idempotent). Rejects role inboxes and title-as-name placeholders. */
export async function enqueueLeads(
  env: OutreachEnv,
  leads: Array<Omit<OutreachLead, "status">>
): Promise<{ queued: number; skipped: number; rejected: Array<{ email: string; reasons: string[] }> }> {
  const queue = await getQueue(env);
  let queued = 0;
  let skipped = 0;
  const rejected: Array<{ email: string; reasons: string[] }> = [];
  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase();
    const reasons = leadSendBlockers({ ...lead, email });
    if (isRoleInbox(email) && !reasons.includes("role_inbox")) reasons.push("role_inbox");
    if (reasons.length) {
      rejected.push({ email, reasons });
      // Keep bad addresses out of the send queue permanently
      if (email.includes("@")) {
        await putLead(env, {
          ...lead,
          email,
          status: "suppressed",
          suppressReason: reasons.join("|"),
        });
        const qi = queue.indexOf(email);
        if (qi >= 0) queue.splice(qi, 1);
      }
      continue;
    }
    const existing = await getLead(env, email);
    if (
      existing?.status === "sent" ||
      existing?.status === "followup_sent" ||
      existing?.status === "replied" ||
      existing?.status === "nurtured" ||
      existing?.status === "suppressed"
    ) {
      skipped++;
      continue;
    }
    await putLead(env, { ...existing, ...lead, email, status: "queued" });
    if (!queue.includes(email)) {
      queue.push(email);
      queued++;
    } else {
      skipped++;
    }
  }
  await putQueue(env, queue);
  return { queued, skipped, rejected };
}

async function consumeSendBudget(
  env: OutreachEnv
): Promise<{ remaining: number; sentToday: number; cap: number; sentDate: string }> {
  const cap = Math.max(1, Math.min(25, Number(env.OUTREACH_DAILY_CAP || "10")));
  const sentMeta = await env.SESSIONS.get(SENT_TODAY_KEY);
  let sentToday = 0;
  const sentDate = todayUtc();
  if (sentMeta) {
    try {
      const parsed = JSON.parse(sentMeta) as { date?: string; count?: number };
      if (parsed.date === sentDate) sentToday = Number(parsed.count || 0);
    } catch {
      /* ignore */
    }
  }
  return { remaining: Math.max(0, cap - sentToday), sentToday, cap, sentDate };
}

async function bumpSentToday(env: OutreachEnv, sentDate: string, sentToday: number) {
  await env.SESSIONS.put(SENT_TODAY_KEY, JSON.stringify({ date: sentDate, count: sentToday }));
}

/** Send up to daily cap from queue. */
export async function runOutreachSend(env: OutreachEnv): Promise<Record<string, unknown>> {
  if (env.OUTREACH_AUTONOMOUS !== "true") {
    return { skipped: true, reason: "OUTREACH_AUTONOMOUS!=true" };
  }
  const token = await getGmailAccessToken(env);
  if (!token) return { skipped: true, reason: "gmail_token_unavailable" };

  const budget = await consumeSendBudget(env);
  if (budget.remaining === 0) {
    return {
      skipped: true,
      reason: "daily_cap_reached",
      sentToday: budget.sentToday,
      cap: budget.cap,
    };
  }

  const queue = await getQueue(env);
  const batch = queue.slice(0, budget.remaining);
  const outcomes: unknown[] = [];
  let sent = 0;
  let failed = 0;
  let sentToday = budget.sentToday;

  const doneEmails = new Set<string>();
  let aborted: string | null = null;
  for (const email of batch) {
    const lead = (await getLead(env, email)) || { email, status: "queued" as const };
    if (
      lead.status === "suppressed" ||
      lead.status === "replied" ||
      lead.status === "nurtured" ||
      lead.status === "sent" ||
      lead.status === "followup_sent"
    ) {
      doneEmails.add(email);
      continue;
    }
    // Hard gate at send time — the same rules as enqueueLeads, re-run in case
    // a lead was written to KV some other way.
    const blockers = leadSendBlockers(lead);
    if (isRoleInbox(email) && !blockers.includes("role_inbox")) blockers.push("role_inbox");
    if (blockers.length) {
      failed++;
      doneEmails.add(email);
      await putLead(env, {
        ...lead,
        status: "suppressed",
        suppressReason: blockers.join("|"),
      });
      outcomes.push({ email, status: "suppressed", reason: blockers });
      continue;
    }
    const res = await gmailSend(env, token, lead);
    if (!res.ok && res.auth) {
      // Bad or revoked credentials fail identically for every lead. Stop and
      // leave the queue as it is instead of marking leads failed.
      outcomes.push({ email, status: "not_attempted", error: res.error });
      aborted = res.error ?? "gmail_auth";
      break;
    }
    if (res.ok) {
      sent++;
      sentToday++;
      doneEmails.add(email);
      await putLead(env, {
        ...lead,
        status: "sent",
        threadId: res.threadId,
        messageId: res.id,
        sentAt: new Date().toISOString(),
      });
      outcomes.push({ email, status: "sent", threadId: res.threadId });
    } else {
      failed++;
      doneEmails.add(email);
      await putLead(env, { ...lead, status: "failed" });
      outcomes.push({ email, status: "failed", error: res.error });
    }
  }

  // Failed leads leave the queue for a person to look at. Re-queuing them
  // every run is how 2026-05-16 produced eleven attempts at the same batch.
  // Leads not reached (auth abort or batch end) stay queued.
  await putQueue(env, queue.filter(e => !doneEmails.has(e)));
  await bumpSentToday(env, budget.sentDate, sentToday);

  if (sent > 0) {
    await notifyFounder(
      env,
      `Outreach sent ${sent} (cap ${budget.cap})`,
      `Autonomous outreach batch\n\n${JSON.stringify(outcomes, null, 2)}\n`
    );
  }

  return { sent, failed, sentToday, cap: budget.cap, aborted, outcomes };
}

/** One follow-up to non-responders after OUTREACH_FOLLOWUP_DAYS (default 3). */
export async function runFollowUps(env: OutreachEnv): Promise<Record<string, unknown>> {
  if (env.OUTREACH_AUTONOMOUS !== "true") {
    return { skipped: true, reason: "OUTREACH_AUTONOMOUS!=true" };
  }
  const token = await getGmailAccessToken(env);
  if (!token) return { skipped: true, reason: "gmail_token_unavailable" };

  const days = Math.max(2, Math.min(14, Number(env.OUTREACH_FOLLOWUP_DAYS || "3")));
  const cutoff = daysAgoIso(days);
  const budget = await consumeSendBudget(env);
  if (budget.remaining === 0) {
    return { skipped: true, reason: "daily_cap_reached", sentToday: budget.sentToday };
  }

  // Scan queue + known sent leads via queue snapshot is incomplete; use list by prefix via status endpoint pattern.
  // Worker KV list is available on SESSIONS.
  const listed = await env.SESSIONS.list({ prefix: LEAD_PREFIX, limit: 200 });
  const candidates: OutreachLead[] = [];
  for (const key of listed.keys) {
    const raw = await env.SESSIONS.get(key.name);
    if (!raw) continue;
    try {
      const lead = JSON.parse(raw) as OutreachLead;
      if (lead.status !== "sent" || !lead.sentAt) continue;
      if (lead.sentAt > cutoff) continue;
      if (lead.followUpAt) continue;
      candidates.push(lead);
    } catch {
      /* ignore */
    }
  }

  const batch = candidates.slice(0, budget.remaining);
  const outcomes: unknown[] = [];
  let sent = 0;
  let failed = 0;
  let sentToday = budget.sentToday;

  for (const lead of batch) {
    if (leadSendBlockers(lead).length) continue;
    const tpl = renderFollowUp(lead);
    const res = await gmailSend(env, token, lead, {
      subject: tpl.subject,
      body: tpl.body,
      threadId: lead.threadId,
      inReplyTo: lead.rfcMessageId,
      references: lead.rfcMessageId,
    });
    if (res.ok) {
      sent++;
      sentToday++;
      await putLead(env, {
        ...lead,
        status: "followup_sent",
        followUpAt: new Date().toISOString(),
        threadId: res.threadId || lead.threadId,
      });
      outcomes.push({ email: lead.email, status: "followup_sent" });
    } else {
      failed++;
      // Mark it so the follow-up is not attempted again on every run.
      await putLead(env, { ...lead, followUpAt: new Date().toISOString() });
      outcomes.push({ email: lead.email, status: "failed", error: res.error });
      if (res.auth) break;
    }
  }

  await bumpSentToday(env, budget.sentDate, sentToday);
  if (sent > 0) {
    await notifyFounder(
      env,
      `Outreach follow-ups ${sent}`,
      `Follow-up batch after ${days}d\n\n${JSON.stringify(outcomes, null, 2)}\n`
    );
  }
  return { sent, failed, candidates: candidates.length, days, outcomes };
}

/** Poll Gmail for unreplied INBOX messages that look like outreach replies. */
export async function runReplyPoll(env: OutreachEnv): Promise<Record<string, unknown>> {
  const token = await getGmailAccessToken(env);
  if (!token) return { skipped: true, reason: "gmail_token_unavailable" };

  // Prefer Gmail label exclusion when label exists; always de-dupe via KV.
  const q = encodeURIComponent(`in:inbox newer_than:14d -label:${LABEL_NAME}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=25`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    return { skipped: true, reason: `gmail_list_${listRes.status}` };
  }
  const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const messages = list.messages || [];
  const replies: unknown[] = [];
  let skippedProcessed = 0;
  let nurtured = 0;
  let suppressed = 0;

  for (const msg of messages) {
    if (await wasProcessed(env, msg.id)) {
      skippedProcessed++;
      continue;
    }

    const fullRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Message-ID&metadataHeaders=Message-Id`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!fullRes.ok) continue;
    const full = (await fullRes.json()) as {
      id: string;
      threadId?: string;
      snippet?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const headers = full.payload?.headers || [];
    const header = (name: string) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const from = header("From");
    const subject = header("Subject");
    const inReplyTo = header("In-Reply-To");
    const rfcMessageId = header("Message-ID") || header("Message-Id");
    const emailMatch = from.match(/<([^>]+)>/);
    const fromEmail = (emailMatch ? emailMatch[1] : from).trim().toLowerCase();
    if (!fromEmail.includes("@")) {
      await markProcessed(env, token, msg.id);
      continue;
    }

    const ourAddresses = new Set(
      [env.GMAIL_FROM_EMAIL, env.OUTREACH_REPLY_TO, "noreply@authichain.com", "hello@authichain.com"]
        .filter(Boolean)
        .map(e => String(e).toLowerCase())
    );

    const earlySnippet = (full.snippet || "").slice(0, 280);

    // Bounce / DSN → suppress the failed recipient if we know them
    if (BOUNCE_FROM_RE.test(fromEmail) || /delivery status notification|undeliverable|mail delivery subsystem/i.test(subject)) {
      const bounceTarget =
        (earlySnippet.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/) || [])[0]?.toLowerCase() ||
        null;
      if (bounceTarget && !ourAddresses.has(bounceTarget)) {
        const bounced = await getLead(env, bounceTarget);
        if (bounced) {
          await putLead(env, {
            ...bounced,
            status: "suppressed",
            suppressReason: "bounce",
            lastReplyAt: new Date().toISOString(),
            lastReplySnippet: earlySnippet,
          });
          suppressed++;
          replies.push({
            from: bounceTarget,
            subject,
            snippet: earlySnippet,
            action: "bounced",
          });
          await notifyFounder(
            env,
            `Outreach BOUNCE ${bounceTarget}`,
            `Subject: ${subject}\n\n${earlySnippet}\n`
          );
        }
      }
      await markProcessed(env, token, msg.id);
      continue;
    }

    // Ignore our own outbound / system mail that lands in INBOX (self-sends, Resend notifies)
    if (ourAddresses.has(fromEmail) || fromEmail.startsWith("noreply@")) {
      await markProcessed(env, token, msg.id);
      continue;
    }

    const lead = await getLead(env, fromEmail);
    const threadLead = lead;
    // Also match by threadId against known sent leads when From is unexpected
    let matched: OutreachLead | null = threadLead;
    if (!matched && full.threadId) {
      const listed = await env.SESSIONS.list({ prefix: LEAD_PREFIX, limit: 200 });
      for (const key of listed.keys) {
        const raw = await env.SESSIONS.get(key.name);
        if (!raw) continue;
        try {
          const l = JSON.parse(raw) as OutreachLead;
          if (l.threadId && l.threadId === full.threadId) {
            matched = l;
            break;
          }
        } catch {
          /* ignore */
        }
      }
    }

    const looksLikeReply =
      Boolean(
        matched &&
          (matched.status === "sent" ||
            matched.status === "followup_sent" ||
            matched.status === "nurtured") &&
          matched.threadId
      ) ||
      (Boolean(inReplyTo) && /dpp|authichain|passport|audit|readiness/i.test(subject));

    if (!looksLikeReply) continue;

    const targetEmail = (matched?.email || fromEmail).toLowerCase();
    const snippet = (full.snippet || "").slice(0, 280);
    const blob = `${subject} ${snippet}`;

    if (NEGATIVE_RE.test(blob)) {
      await putLead(env, {
        ...(matched || { email: targetEmail }),
        email: targetEmail,
        status: "suppressed",
        suppressReason: "negative_reply",
        threadId: full.threadId || matched?.threadId,
        lastReplyAt: new Date().toISOString(),
        lastReplySnippet: snippet,
      });
      suppressed++;
      await markProcessed(env, token, msg.id);
      await notifyFounder(
        env,
        `Outreach SUPPRESSED (negative) ${targetEmail}`,
        `Subject: ${subject}\n\n${snippet}\n`
      );
      replies.push({ from: targetEmail, subject, snippet, action: "suppressed" });
      continue;
    }

    await putLead(env, {
      email: targetEmail,
      name: matched?.name,
      company: matched?.company,
      industry: matched?.industry,
      source: matched?.source || "inbound_reply",
      status: "replied",
      threadId: full.threadId || matched?.threadId,
      messageId: matched?.messageId,
      rfcMessageId: matched?.rfcMessageId,
      sentAt: matched?.sentAt,
      followUpAt: matched?.followUpAt,
      lastReplyAt: new Date().toISOString(),
      lastReplySnippet: snippet,
    });

    await markProcessed(env, token, msg.id);

    const item: Record<string, unknown> = {
      from: targetEmail,
      subject,
      snippet,
      threadId: full.threadId,
      action: "notified",
    };

    await notifyFounder(
      env,
      `Outreach REPLY from ${targetEmail}`,
      `Subject: ${subject}\n\n${snippet}\n\nLead: ${JSON.stringify(matched || { email: targetEmail }, null, 2)}\n\nOpen the Gmail thread and reply in person.\n`
    );

    // Auto nurture: positive-ish reply → calendar + DPP link once
    if (shouldAutoNurture(env, blob)) {
      const nurtureBody = [
        greet(matched?.name),
        ``,
        `Thanks for the reply — happy to walk through EU DPP readiness.`,
        ``,
        `Grab a slot: https://authichain.com/book`,
        `Or start the $299 audit now: https://authichain.com/dpp?utm_source=email&utm_medium=reply_nurture&utm_campaign=dpp_outreach&email=${encodeURIComponent(targetEmail)}`,
        ``,
        `— Zac`,
      ].join("\n");
      const nurtureRes = await gmailSend(
        env,
        token,
        { email: targetEmail, name: matched?.name, company: matched?.company },
        {
          subject: `Re: ${subject.replace(/^re:\s*/i, "")}`,
          body: nurtureBody,
          threadId: full.threadId,
          inReplyTo: rfcMessageId || undefined,
          references: rfcMessageId || undefined,
        }
      );
      if (nurtureRes.ok) {
        nurtured++;
        item.action = "nurtured";
        await putLead(env, {
          email: targetEmail,
          name: matched?.name,
          company: matched?.company,
          industry: matched?.industry,
          source: matched?.source || "inbound_reply",
          status: "nurtured",
          threadId: full.threadId || matched?.threadId,
          messageId: matched?.messageId,
          sentAt: matched?.sentAt,
          followUpAt: matched?.followUpAt,
          lastReplyAt: new Date().toISOString(),
          lastReplySnippet: snippet,
        });
      }
    }

    replies.push(item);
  }

  return {
    checked: messages.length,
    replies: replies.length,
    nurtured,
    suppressed,
    skippedProcessed,
    items: replies,
  };
}

/**
 * Process a synthetic or webhook-ingested reply (for tests + future inbound hooks).
 * Does not require a live Gmail message id.
 */
export async function processInboundReply(
  env: OutreachEnv,
  input: {
    from: string;
    subject?: string;
    snippet?: string;
    threadId?: string;
    rfcMessageId?: string;
    sendNurture?: boolean;
  }
): Promise<Record<string, unknown>> {
  const fromEmail = input.from.trim().toLowerCase();
  if (!fromEmail.includes("@")) return { ok: false, error: "invalid_from" };

  const lead = (await getLead(env, fromEmail)) || {
    email: fromEmail,
    source: "inbound_reply",
  };
  const subject = input.subject || "";
  const snippet = (input.snippet || "").slice(0, 280);
  const blob = `${subject} ${snippet}`;

  if (NEGATIVE_RE.test(blob)) {
    await putLead(env, {
      ...lead,
      email: fromEmail,
      status: "suppressed",
      suppressReason: "negative_reply",
      threadId: input.threadId || lead.threadId,
      lastReplyAt: new Date().toISOString(),
      lastReplySnippet: snippet,
    });
    await notifyFounder(
      env,
      `Outreach SUPPRESSED (negative) ${fromEmail}`,
      `Subject: ${subject}\n\n${snippet}\n`
    );
    return { ok: true, action: "suppressed" };
  }

  await putLead(env, {
    ...lead,
    email: fromEmail,
    status: "replied",
    threadId: input.threadId || lead.threadId,
    lastReplyAt: new Date().toISOString(),
    lastReplySnippet: snippet,
  });

  await notifyFounder(
    env,
    `Outreach REPLY from ${fromEmail}`,
    `Subject: ${subject}\n\n${snippet}\n\nLead: ${JSON.stringify(lead, null, 2)}\n`
  );

  const shouldNurture =
    input.sendNurture !== false &&
    shouldAutoNurture(env, blob);

  if (!shouldNurture) {
    return { ok: true, action: "replied" };
  }

  const token = await getGmailAccessToken(env);
  if (!token) return { ok: true, action: "replied", nurture: "gmail_token_unavailable" };

  const nurtureBody = [
    greet(lead.name),
    ``,
    `Thanks for the reply — happy to walk through EU DPP readiness.`,
    ``,
    `Grab a slot: https://authichain.com/book`,
    `Or start the $299 audit now: https://authichain.com/dpp?utm_source=email&utm_medium=reply_nurture&utm_campaign=dpp_outreach&email=${encodeURIComponent(fromEmail)}`,
    ``,
    `— Zac`,
  ].join("\n");

  const nurtureRes = await gmailSend(
    env,
    token,
    { email: fromEmail, name: lead.name, company: lead.company },
    {
      subject: `Re: ${(subject || "EU DPP readiness").replace(/^re:\s*/i, "")}`,
      body: nurtureBody,
      threadId: input.threadId || lead.threadId,
      inReplyTo: input.rfcMessageId,
      references: input.rfcMessageId,
    }
  );

  if (nurtureRes.ok) {
    await putLead(env, {
      ...lead,
      email: fromEmail,
      status: "nurtured",
      threadId: nurtureRes.threadId || input.threadId || lead.threadId,
      lastReplyAt: new Date().toISOString(),
      lastReplySnippet: snippet,
    });
    return { ok: true, action: "nurtured", threadId: nurtureRes.threadId };
  }

  return { ok: true, action: "replied", nurtureError: nurtureRes.error };
}

export async function getOutreachStatus(env: OutreachEnv): Promise<Record<string, unknown>> {
  const queue = await getQueue(env);
  const budget = await consumeSendBudget(env);
  const listed = await env.SESSIONS.list({ prefix: LEAD_PREFIX, limit: 500 });
  const byStatus: Record<string, number> = {};
  const samples: OutreachLead[] = [];
  for (const key of listed.keys) {
    const raw = await env.SESSIONS.get(key.name);
    if (!raw) continue;
    try {
      const lead = JSON.parse(raw) as OutreachLead;
      const st = lead.status || "unknown";
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (samples.length < 25) samples.push(lead);
    } catch {
      /* ignore */
    }
  }
  return {
    autonomous: env.OUTREACH_AUTONOMOUS === "true",
    replyTo: env.OUTREACH_REPLY_TO || env.GMAIL_FROM_EMAIL || null,
    from: env.GMAIL_FROM_EMAIL || null,
    queueLength: queue.length,
    queuePreview: queue.slice(0, 10),
    sentToday: budget.sentToday,
    cap: budget.cap,
    remainingToday: budget.remaining,
    byStatus,
    sampleLeads: samples,
    at: new Date().toISOString(),
  };
}

export async function runAutonomousOutreachCycle(
  env: OutreachEnv
): Promise<Record<string, unknown>> {
  const send = await runOutreachSend(env);
  const followups = await runFollowUps(env);
  const replies = await runReplyPoll(env);
  return { send, followups, replies, at: new Date().toISOString() };
}
