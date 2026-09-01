// authichain-outreach-engine — AgentZ-driven cold outreach backend
// Contract (agentz/core/outreach_engine.py):
//   POST /admin/leads  {company, contact_name, contact_email, industry, priority} -> 201 on insert
//   GET  /admin/leads  -> JSON array of pending leads
//   POST /admin/run    -> processes one batch via Resend, returns JSON summary
// Auth: Authorization: Bearer <OUTREACH_ADMIN_TOKEN> on all /admin/* routes.
//
// Uses the pre-existing authichain-db schema: leads (status 'new' = pending,
// score = priority), templates (industry email bodies with {{placeholders}}),
// outreach_logs (per-send audit trail). Sends are explicit-only (no cron) and
// gated by the shared suppression KV (qron-outreach-kv).

export interface Env {
  DB: D1Database;
  SUPPRESS_KV: KVNamespace;
  OUTREACH_ADMIN_TOKEN: string;
  RESEND_API_KEY: string;
  OUTREACH_FROM_EMAIL: string;
  OUTREACH_REPLY_TO: string;
  BATCH_SIZE: string;
}

interface Lead {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  industry: string | null;
  score: number;
  status: string;
  created_at: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a),
    bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function isAuthed(request: Request, env: Env): boolean {
  if (!env.OUTREACH_ADMIN_TOKEN) return false;
  const header = request.headers.get("Authorization") ?? "";
  return timingSafeEqual(header, `Bearer ${env.OUTREACH_ADMIN_TOKEN}`);
}

// --- Industry -> template key mapping (templates live in D1) ---------------

function templateKeyFor(industry: string | null): string {
  const i = (industry ?? "").toLowerCase();
  if (/defen[cs]e|dod|gov|military|federal/.test(i))
    return "dod_supply_chain_email";
  if (/pharma|health|medical|biotech/.test(i))
    return "pharma_traceability_email";
  if (/luxury|watch|jewel|fashion|apparel|collect/.test(i))
    return "luxury_brand_protection_email";
  return "generic_b2b_email";
}

const FALLBACK_TEMPLATE = {
  subject: "Authenticity Verification for {{company}}",
  body_markdown:
    "Hi {{contact_name}},\\n\\nCounterfeits and gray-market goods erode both revenue and customer trust. AuthiChain fixes that with one-scan product authentication: each {{company}} product gets a unique QR resolving to an on-chain provenance record.\\n\\nAre you available for a brief technical overview next week?\\n\\nBest,\\nZac | AuthiChain",
};

async function loadTemplate(
  env: Env,
  key: string
): Promise<{ key: string; subject: string; body_markdown: string }> {
  const row = await env.DB.prepare(
    `SELECT key, subject, body_markdown FROM templates WHERE key = ?1`
  )
    .bind(key)
    .first<{ key: string; subject: string; body_markdown: string }>();
  if (row) return row;
  if (key !== "generic_b2b_email")
    return loadTemplate(env, "generic_b2b_email");
  return { key: "fallback", ...FALLBACK_TEMPLATE };
}

function render(text: string, lead: Lead): string {
  return text
    .replace(/\{\{\s*contact_name\s*\}\}/g, lead.name || "there")
    .replace(/\{\{\s*name\s*\}\}/g, lead.name || "there")
    .replace(/\{\{\s*company\s*\}\}/g, lead.company || "your company")
    .replace(/\\n/g, "\n"); // bodies are stored with literal \n sequences
}

// --- Resend + suppression ---------------------------------------------------

const SUPPRESS_PREFIX = "suppress:";

async function isSuppressed(env: Env, email: string): Promise<boolean> {
  return (
    (await env.SUPPRESS_KV.get(SUPPRESS_PREFIX + email.toLowerCase())) !== null
  );
}

async function suppress(env: Env, email: string, reason: string) {
  await env.SUPPRESS_KV.put(
    SUPPRESS_PREFIX + email.toLowerCase(),
    JSON.stringify({ reason, at: new Date().toISOString() })
  );
}

async function sendViaResend(
  env: Env,
  lead: Lead,
  subject: string,
  body: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.OUTREACH_FROM_EMAIL,
        to: [lead.email],
        subject,
        text: body,
        reply_to: env.OUTREACH_REPLY_TO,
      }),
    });
    const result: any = await r.json().catch(() => ({}));
    if (r.ok && result.id) return { ok: true, id: result.id };
    return { ok: false, error: result.message || `Resend HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function logOutreach(
  env: Env,
  leadId: number,
  templateKey: string,
  status: string,
  error?: string
) {
  await env.DB.prepare(
    `INSERT INTO outreach_logs (lead_id, template_key, provider, status, error_message)
     VALUES (?1, ?2, 'resend', ?3, ?4)`
  )
    .bind(leadId, templateKey, status, error ?? null)
    .run();
}

// --- Admin handlers ----------------------------------------------------------

async function addLead(request: Request, env: Env): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch (err) {
    console.error("addLead: failed to parse request body", err);
  }
  const { company, contact_email } = body;
  if (!company || !contact_email || !String(contact_email).includes("@")) {
    return Response.json(
      { error: "company and a valid contact_email are required" },
      { status: 400 }
    );
  }

  const email = String(contact_email).trim().toLowerCase();
  const existing = await env.DB.prepare(`SELECT id FROM leads WHERE email = ?1`)
    .bind(email)
    .first<{ id: number }>();
  if (existing) {
    return Response.json(
      { error: "lead already exists", id: existing.id },
      { status: 409 }
    );
  }

  const res = await env.DB.prepare(
    `INSERT INTO leads (email, name, company, industry, score, status, source)
     VALUES (?1, ?2, ?3, ?4, ?5, 'new', 'agentz')`
  )
    .bind(
      email,
      String(body.contact_name ?? ""),
      String(company),
      String(body.industry ?? "luxury").toLowerCase(),
      Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0
    )
    .run();

  return Response.json(
    { id: res.meta.last_row_id, status: "new" },
    { status: 201 }
  );
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

async function runBatch(env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return Response.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }
  const batchSize = Math.max(1, Math.min(25, Number(env.BATCH_SIZE) || 5));
  const { results } = await env.DB.prepare(
    `SELECT id, email, name, company, industry, score, status, created_at
     FROM leads WHERE status = 'new' ORDER BY score DESC, id ASC LIMIT ?1`
  )
    .bind(batchSize)
    .all<Lead>();

  const leads = results ?? [];
  const outcomes: any[] = [];
  let sent = 0,
    failed = 0,
    suppressed = 0;

  for (const lead of leads) {
    const templateKey = templateKeyFor(lead.industry);

    if (await isSuppressed(env, lead.email)) {
      await env.DB.prepare(
        `UPDATE leads SET status = 'suppressed', updated_at = datetime('now') WHERE id = ?1`
      )
        .bind(lead.id)
        .run();
      await logOutreach(
        env,
        lead.id,
        templateKey,
        "suppressed",
        "on suppression list"
      );
      outcomes.push({ id: lead.id, to: lead.email, status: "suppressed" });
      suppressed++;
      continue;
    }

    const template = await loadTemplate(env, templateKey);
    const subject = render(template.subject, lead);
    const body = render(template.body_markdown, lead);
    const res = await sendViaResend(env, lead, subject, body);

    if (res.ok) {
      await env.DB.prepare(
        `UPDATE leads SET status = 'sent', last_contacted_at = datetime('now'),
                          updated_at = datetime('now') WHERE id = ?1`
      )
        .bind(lead.id)
        .run();
      await logOutreach(env, lead.id, template.key, "sent");
      outcomes.push({
        id: lead.id,
        to: lead.email,
        status: "sent",
        resend_id: res.id,
        template: template.key,
      });
      sent++;
    } else {
      const bounced = /bounce|suppress|invalid|not.?exist/i.test(
        res.error ?? ""
      );
      if (bounced) await suppress(env, lead.email, res.error ?? "send failed");
      await env.DB.prepare(
        `UPDATE leads SET status = ?2, updated_at = datetime('now') WHERE id = ?1`
      )
        .bind(lead.id, bounced ? "suppressed" : "failed")
        .run();
      await logOutreach(
        env,
        lead.id,
        template.key,
        bounced ? "suppressed" : "failed",
        res.error
      );
      outcomes.push({
        id: lead.id,
        to: lead.email,
        status: bounced ? "suppressed" : "failed",
        error: res.error,
      });
      bounced ? suppressed++ : failed++;
    }

    // Pace sends to stay under Resend rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  const remaining = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM leads WHERE status = 'new'`
  ).first<{ n: number }>();

  return Response.json({
    processed: leads.length,
    sent,
    failed,
    suppressed,
    remaining_pending: remaining?.n ?? 0,
    results: outcomes,
    timestamp: new Date().toISOString(),
  });
}

// --- Router --------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        worker: "authichain-outreach-engine",
      });
    }

    if (url.pathname.startsWith("/admin/")) {
      if (!isAuthed(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (url.pathname === "/admin/leads" && request.method === "POST")
        return addLead(request, env);
      if (url.pathname === "/admin/leads" && request.method === "GET")
        return listLeads(request, env);
      if (url.pathname === "/admin/run" && request.method === "POST")
        return runBatch(env);
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      service: "authichain-outreach-engine",
      endpoints: [
        "/health",
        "POST /admin/leads",
        "GET /admin/leads",
        "POST /admin/run",
      ],
    });
  },
};
