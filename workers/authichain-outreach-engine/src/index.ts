// authichain-outreach-engine — AgentZ-driven outreach backend, human-gated.
//
// Lead lifecycle: new -> approved -> sent | blocked | failed | suppressed.
//
//   POST /admin/leads    (admin token)    queue a lead; rejected unless it passes guard.ts
//   GET  /admin/leads    (admin token)    list leads by ?status=
//   POST /admin/preview  (admin token)    render drafts + run every check; sends nothing, writes nothing
//   POST /admin/approve  (approver token) {lead_ids: number[]} approve the exact drafts shown by preview
//   POST /admin/run      (admin token)    OUTREACH_MODE=live: send approved leads. Otherwise same as preview.
//   GET|POST /unsubscribe?e=&t=           one-click unsubscribe (RFC 8058), adds to the shared suppression KV
//
// Why it is shaped this way: on 2026-05-16 this worker's predecessor emailed
// guessed DEA and CBP addresses claiming "SBIR Phase 1 results" that did not
// exist, addressed them as "Hi Pilot Coordinator", and retried eleven times
// until a key worked. Now AgentZ can queue and preview, but only a person
// holding OUTREACH_APPROVER_TOKEN can release an email, every draft goes
// through claims.ts, and a send-time auth failure stops the batch instead of
// touching lead state.

import { checkClaims } from "../../../server/outreach/claims";
import { checkLead, parseMetadata, type LeadMetadata } from "./guard";
import { renderTemplate, segmentFor, TEMPLATES } from "./templates";

export interface Env {
  DB: D1Database;
  SUPPRESS_KV: KVNamespace;
  OUTREACH_ADMIN_TOKEN: string;
  /** Held by a person, not by AgentZ. Required to release any email. */
  OUTREACH_APPROVER_TOKEN: string;
  RESEND_API_KEY: string;
  OUTREACH_FROM_EMAIL: string;
  OUTREACH_REPLY_TO: string;
  BATCH_SIZE: string;
  /** "live" sends approved leads. Anything else is preview-only. */
  OUTREACH_MODE: string;
  /** Public base URL of this worker, used for unsubscribe links. */
  OUTREACH_PUBLIC_URL: string;
  OUTREACH_SENDER_NAME: string;
  OUTREACH_UNSUBSCRIBE_SECRET: string;
  /** CAN-SPAM postal address. Live sends fail closed without it. */
  MAILING_ADDRESS: string;
}

interface LeadRow {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  score: number;
  status: string;
  metadata: string | null;
  created_at: string;
}

export interface Draft {
  lead_id: number;
  to: string;
  segment: string;
  subject: string;
  body: string;
  draft_hash: string;
  reasons: string[];
  ok: boolean;
}

// --- small helpers -------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a),
    bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function hasBearer(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  return timingSafeEqual(request.headers.get("Authorization") ?? "", `Bearer ${token}`);
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}

async function unsubscribeToken(env: Env, email: string): Promise<string> {
  return (await hmacHex(env.OUTREACH_UNSUBSCRIBE_SECRET, email.toLowerCase())).slice(0, 32);
}

async function unsubscribeUrl(env: Env, email: string): Promise<string> {
  let base = env.OUTREACH_PUBLIC_URL;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const t = await unsubscribeToken(env, email);
  return `${base}/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&t=${t}`;
}

// --- suppression, prior sends, MX -------------------------------------------------

const SUPPRESS_PREFIX = "suppress:";

async function isSuppressed(env: Env, email: string): Promise<boolean> {
  return (await env.SUPPRESS_KV.get(SUPPRESS_PREFIX + email.toLowerCase())) !== null;
}

async function suppress(env: Env, email: string, reason: string) {
  await env.SUPPRESS_KV.put(
    SUPPRESS_PREFIX + email.toLowerCase(),
    JSON.stringify({ reason, at: new Date().toISOString() })
  );
}

/** Any earlier successful send to this address, from this or an older version of the worker. */
async function priorSends(env: Env, email: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM outreach_logs l JOIN leads d ON d.id = l.lead_id
     WHERE lower(d.email) = ?1 AND l.status IN ('sent','ok')`
  )
    .bind(email.toLowerCase())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Does the domain accept mail? DNS-over-HTTPS, since Workers have no resolver.
 * Invented domains (contact@authichain-os-arc-teryx-gear-...com) fail here.
 * Any lookup failure counts as "no" — fail closed.
 */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" } }
    );
    if (!r.ok) return false;
    const j = (await r.json()) as { Status?: number; Answer?: { type: number }[] };
    return j.Status === 0 && (j.Answer ?? []).some(a => a.type === 15);
  } catch {
    return false;
  }
}

// --- drafts ---------------------------------------------------------------------

export async function buildDraft(lead: LeadRow, env: Env): Promise<Draft> {
  const meta = parseMetadata(lead.metadata);
  const check = checkLead({
    email: lead.email,
    name: lead.name,
    company: lead.company,
    metadata: meta,
  });
  const segment = segmentFor(lead.industry);
  const note =
    meta.personal_note && meta.personal_note_source
      ? { text: meta.personal_note, source_url: meta.personal_note_source }
      : null;
  const rendered = renderTemplate(TEMPLATES[segment], {
    first_name: check.first_name,
    company: lead.company ?? "",
    sender_name: env.OUTREACH_SENDER_NAME ?? "",
    personal_note: note,
  });
  const claims = checkClaims(rendered.subject, rendered.body);
  const reasons = [
    ...check.reasons,
    ...claims.map(v => `claim:${v.rule}:${v.match}`),
  ];
  return {
    lead_id: lead.id,
    to: lead.email.toLowerCase(),
    segment,
    subject: rendered.subject,
    body: rendered.body,
    draft_hash: (await sha256Hex(`${rendered.subject}\n${rendered.body}`)).slice(0, 16),
    reasons,
    ok: reasons.length === 0,
  };
}

/** The checks that need the network or the database. Read-only. */
async function liveChecks(env: Env, draft: Draft): Promise<string[]> {
  const reasons: string[] = [];
  if (await isSuppressed(env, draft.to)) reasons.push("suppressed");
  if ((await priorSends(env, draft.to)) > 0) reasons.push("already_emailed");
  if (!(await domainAcceptsMail(draft.to))) reasons.push("domain_accepts_no_mail");
  return reasons;
}

async function fullDraft(env: Env, lead: LeadRow): Promise<Draft> {
  const draft = await buildDraft(lead, env);
  const extra = await liveChecks(env, draft);
  draft.reasons.push(...extra);
  draft.ok = draft.reasons.length === 0;
  return draft;
}

function missingLiveConfig(env: Env): string[] {
  const required: (keyof Env)[] = [
    "RESEND_API_KEY",
    "OUTREACH_APPROVER_TOKEN",
    "OUTREACH_PUBLIC_URL",
    "OUTREACH_SENDER_NAME",
    "OUTREACH_UNSUBSCRIBE_SECRET",
    "MAILING_ADDRESS",
    "OUTREACH_FROM_EMAIL",
  ];
  return required.filter(k => !String(env[k] ?? "").trim());
}

// --- sending --------------------------------------------------------------------

type SendResult =
  | { kind: "sent"; id: string }
  | { kind: "failed"; error: string }
  /** Stop the whole batch: bad key, unverified sender or rate limit. Lead state is left alone. */
  | { kind: "abort"; error: string };

async function sendDraft(env: Env, draft: Draft): Promise<SendResult> {
  const unsub = await unsubscribeUrl(env, draft.to);
  const footer = `\n\n--\nAuthiChain\n${env.MAILING_ADDRESS}\nUnsubscribe: ${unsub}`;
  let r: Response;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.OUTREACH_FROM_EMAIL,
        to: [draft.to],
        reply_to: env.OUTREACH_REPLY_TO,
        subject: draft.subject,
        text: draft.body + footer,
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
  } catch (e: any) {
    return { kind: "failed", error: `network: ${e?.message ?? e}` };
  }
  const result: any = await r.json().catch(() => ({}));
  if (r.ok && result.id) return { kind: "sent", id: result.id };
  const error = `Resend HTTP ${r.status}: ${result.message ?? "no message"}`;
  if (r.status === 401 || r.status === 403 || r.status === 429) return { kind: "abort", error };
  return { kind: "failed", error };
}

async function log(env: Env, leadId: number, segment: string, status: string, note?: string) {
  await env.DB.prepare(
    `INSERT INTO outreach_logs (lead_id, template_key, provider, status, error_message)
     VALUES (?1, ?2, 'resend', ?3, ?4)`
  )
    .bind(leadId, `v2_${segment}`, status, note ?? null)
    .run();
}

async function setLead(env: Env, id: number, status: string, meta?: LeadMetadata & Record<string, unknown>) {
  if (meta) {
    await env.DB.prepare(
      `UPDATE leads SET status = ?2, metadata = ?3, updated_at = datetime('now') WHERE id = ?1`
    )
      .bind(id, status, JSON.stringify(meta))
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE leads SET status = ?2, updated_at = datetime('now') WHERE id = ?1`
    )
      .bind(id, status)
      .run();
  }
}

// --- handlers -------------------------------------------------------------------

const LEAD_COLUMNS = `id, email, name, company, industry, score, status, metadata, created_at`;

async function addLead(request: Request, env: Env): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const email = String(body.contact_email ?? "").trim().toLowerCase();
  const metadata: LeadMetadata = {
    verification_source: body.verification_source,
    verification_evidence: body.verification_evidence,
    personal_note: body.personal_note,
    personal_note_source: body.personal_note_source,
  };
  const check = checkLead({
    email,
    name: body.contact_name ?? null,
    company: body.company ?? null,
    metadata,
  });
  if (!check.ok) {
    return Response.json({ error: "lead rejected", reasons: check.reasons }, { status: 422 });
  }

  const existing = await env.DB.prepare(`SELECT id FROM leads WHERE lower(email) = ?1`)
    .bind(email)
    .first<{ id: number }>();
  if (existing) {
    return Response.json({ error: "lead already exists", id: existing.id }, { status: 409 });
  }

  const res = await env.DB.prepare(
    `INSERT INTO leads (email, name, company, title, industry, score, status, source, metadata)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'new', 'agentz', ?7)`
  )
    .bind(
      email,
      String(body.contact_name).trim(),
      String(body.company).trim(),
      body.contact_title ? String(body.contact_title) : null,
      String(body.industry ?? "").toLowerCase(),
      Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
      JSON.stringify(metadata)
    )
    .run();

  return Response.json({ id: res.meta.last_row_id, status: "new" }, { status: 201 });
}

async function listLeads(request: Request, env: Env): Promise<Response> {
  const status = new URL(request.url).searchParams.get("status") ?? "new";
  const { results } = await env.DB.prepare(
    `SELECT id, company, name AS contact_name, email AS contact_email, industry,
            score AS priority, status, created_at, last_contacted_at
     FROM leads WHERE status = ?1 ORDER BY score DESC, id ASC`
  )
    .bind(status)
    .all();
  return Response.json(results ?? []);
}

function batchSize(env: Env): number {
  return Math.max(1, Math.min(25, Number(env.BATCH_SIZE) || 5));
}

async function preview(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT ${LEAD_COLUMNS} FROM leads WHERE status IN ('new','approved')
     ORDER BY score DESC, id ASC LIMIT ?1`
  )
    .bind(batchSize(env))
    .all<LeadRow>();
  const drafts: (Draft & { status: string })[] = [];
  for (const lead of results ?? []) {
    drafts.push({ ...(await fullDraft(env, lead)), status: lead.status });
  }
  return Response.json({
    mode: env.OUTREACH_MODE === "live" ? "live" : "dry_run",
    sends: 0,
    drafts,
    missing_live_config: missingLiveConfig(env),
  });
}

async function approve(request: Request, env: Env): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const ids: number[] = Array.isArray(body.lead_ids)
    ? body.lead_ids.map(Number).filter(Number.isInteger)
    : [];
  if (ids.length === 0) {
    return Response.json({ error: "lead_ids required" }, { status: 400 });
  }
  const out: any[] = [];
  for (const id of ids) {
    const lead = await env.DB.prepare(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = ?1`)
      .bind(id)
      .first<LeadRow>();
    if (!lead) {
      out.push({ lead_id: id, approved: false, reasons: ["not_found"] });
      continue;
    }
    if (lead.status !== "new") {
      out.push({ lead_id: id, approved: false, reasons: [`status_is_${lead.status}`] });
      continue;
    }
    const draft = await fullDraft(env, lead);
    if (!draft.ok) {
      out.push({ lead_id: id, approved: false, reasons: draft.reasons });
      continue;
    }
    const meta = {
      ...parseMetadata(lead.metadata),
      approved_at: new Date().toISOString(),
      approved_draft_hash: draft.draft_hash,
    };
    await setLead(env, id, "approved", meta);
    await log(env, id, draft.segment, "approved", draft.draft_hash);
    out.push({ lead_id: id, approved: true, draft_hash: draft.draft_hash });
  }
  return Response.json({ results: out });
}

export async function runBatch(env: Env): Promise<Response> {
  if (env.OUTREACH_MODE !== "live") return preview(env);

  const missing = missingLiveConfig(env);
  if (missing.length) {
    return Response.json({ error: "live mode is missing configuration", missing }, { status: 500 });
  }

  const { results } = await env.DB.prepare(
    `SELECT ${LEAD_COLUMNS} FROM leads WHERE status = 'approved'
     ORDER BY score DESC, id ASC LIMIT ?1`
  )
    .bind(batchSize(env))
    .all<LeadRow>();

  const outcomes: any[] = [];
  let sent = 0,
    blocked = 0,
    failed = 0,
    attempted = 0;
  let aborted: string | null = null;

  for (const lead of results ?? []) {
    const draft = await fullDraft(env, lead);
    const meta = parseMetadata(lead.metadata) as LeadMetadata & Record<string, unknown>;
    if (meta.approved_draft_hash !== draft.draft_hash) {
      draft.reasons.push("draft_changed_since_approval");
      draft.ok = false;
    }
    if (!draft.ok) {
      await setLead(env, lead.id, "blocked");
      await log(env, lead.id, draft.segment, "blocked", draft.reasons.join(","));
      outcomes.push({ lead_id: lead.id, to: draft.to, status: "blocked", reasons: draft.reasons });
      blocked++;
      continue;
    }

    // Space sends out; no wait before the first one.
    if (attempted++ > 0) await new Promise(r => setTimeout(r, 500));
    const res = await sendDraft(env, draft);
    if (res.kind === "abort") {
      aborted = res.error;
      outcomes.push({ lead_id: lead.id, to: draft.to, status: "not_attempted", error: res.error });
      break;
    }
    if (res.kind === "sent") {
      await setLead(env, lead.id, "sent", {
        ...meta,
        resend_id: res.id,
        sent_at: new Date().toISOString(),
      });
      await env.DB.prepare(`UPDATE leads SET last_contacted_at = datetime('now') WHERE id = ?1`)
        .bind(lead.id)
        .run();
      await log(env, lead.id, draft.segment, "sent", res.id);
      outcomes.push({ lead_id: lead.id, to: draft.to, status: "sent", resend_id: res.id });
      sent++;
    } else {
      await setLead(env, lead.id, "failed");
      await log(env, lead.id, draft.segment, "failed", res.error);
      outcomes.push({ lead_id: lead.id, to: draft.to, status: "failed", error: res.error });
      failed++;
    }
  }

  return Response.json(
    {
      mode: "live",
      processed: outcomes.length,
      sent,
      blocked,
      failed,
      aborted,
      results: outcomes,
      timestamp: new Date().toISOString(),
    },
    { status: aborted ? 502 : 200 }
  );
}

async function unsubscribe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";
  if (!env.OUTREACH_UNSUBSCRIBE_SECRET || !email || !token) {
    return new Response("Invalid unsubscribe link.", { status: 400 });
  }
  if (!timingSafeEqual(token, await unsubscribeToken(env, email))) {
    return new Response("Invalid unsubscribe link.", { status: 400 });
  }
  await suppress(env, email, "unsubscribe");
  await env.DB.prepare(
    `UPDATE leads SET status = 'suppressed', updated_at = datetime('now') WHERE lower(email) = ?1`
  )
    .bind(email)
    .run();
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title><p>${email.replace(/[<>&"]/g, "")} will not receive further email from AuthiChain.</p>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// --- router ---------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", worker: "authichain-outreach-engine" });
    }

    if (url.pathname === "/unsubscribe" && (request.method === "GET" || request.method === "POST")) {
      return unsubscribe(request, env);
    }

    if (url.pathname === "/admin/approve" && request.method === "POST") {
      if (!hasBearer(request, env.OUTREACH_APPROVER_TOKEN)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return approve(request, env);
    }

    if (url.pathname.startsWith("/admin/")) {
      if (!hasBearer(request, env.OUTREACH_ADMIN_TOKEN)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (url.pathname === "/admin/leads" && request.method === "POST") return addLead(request, env);
      if (url.pathname === "/admin/leads" && request.method === "GET") return listLeads(request, env);
      if (url.pathname === "/admin/preview" && request.method === "POST") return preview(env);
      if (url.pathname === "/admin/run" && request.method === "POST") return runBatch(env);
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      service: "authichain-outreach-engine",
      endpoints: [
        "/health",
        "GET|POST /unsubscribe",
        "POST /admin/leads",
        "GET /admin/leads",
        "POST /admin/preview",
        "POST /admin/approve",
        "POST /admin/run",
      ],
    });
  },
};
