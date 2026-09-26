/**
 * Port of the lead-intake routes onto the edge router:
 *   src/app/api/book/route.ts          → POST /api/book
 *   src/app/api/leads/capture/route.ts → POST /api/leads/capture
 *   src/app/api/lead-capture/route.ts  → POST /api/lead-capture (alias)
 *   src/app/api/crm/sync/route.ts      → POST /api/crm/sync
 *
 * Those were Next.js routes on Vercel. Vercel is gone and /api/* on
 * authichain.com and app.authichain.com now lands here, so without these the
 * /book, /contact and lead-capture forms got a JSON 404 and no lead reached
 * Supabase or HubSpot.
 *
 * Differences from the Next.js versions, all deliberate:
 * - Lead capture syncs to HubSpot in-process instead of POSTing to
 *   `${NEXT_PUBLIC_APP_URL || 'https://qron.space'}/api/crm/sync`, a hop to
 *   another host that also no longer served the route.
 * - The HubSpot contact no longer carries `lead_score`. That property does not
 *   exist on this portal's contacts, and HubSpot rejects the whole create when
 *   any property is unknown, so every sync failed. `source` (Lead source URL)
 *   does exist and carries where the lead came from instead.
 * - POST /api/crm/sync was unauthenticated: anyone could create HubSpot
 *   contacts. It now requires INTERNAL_API_SECRET. Its Vercel Cron GET (a
 *   no-op) is not ported.
 * - User-supplied fields are HTML-escaped in the notification email.
 */
import type { Context, Hono } from "hono";
import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { detectBot } from "../src/app/api/book/bot-detection";
import { enrichLead } from "../src/lib/industrial/enrichment";

export type LeadEnv = {
  HUBSPOT_ACCESS_TOKEN?: string;
  HUBSPOT_TOKEN?: string;
  HUBSPOT_PRIVATE_APP_TOKEN?: string;
  HUBSPOT_OWNER_ID?: string;
  RESEND_API_KEY?: string;
  OUTREACH_FROM_EMAIL?: string;
  SALES_NOTIFY_EMAIL?: string;
  MAKE_LEAD_WEBHOOK_URL?: string;
  N8N_LEAD_WEBHOOK_URL?: string;
  APOLLO_API_KEY?: string;
  INTERNAL_API_SECRET?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type LeadContext = Context<{ Bindings: LeadEnv }>;

const HS_BASE = "https://api.hubapi.com";
const DEFAULT_HUBSPOT_OWNER_ID = "87978084";

function envValue(c: LeadContext, name: keyof LeadEnv): string | undefined {
  return c.env?.[name] || process.env[name] || undefined;
}

export function hubspotToken(c: LeadContext): string | undefined {
  return (
    envValue(c, "HUBSPOT_ACCESS_TOKEN") ||
    envValue(c, "HUBSPOT_TOKEN") ||
    envValue(c, "HUBSPOT_PRIVATE_APP_TOKEN")
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return cryptoTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Run after the response when the Workers runtime allows it; else inline. */
async function background(c: LeadContext, work: Promise<unknown>) {
  const guarded = work.catch(err =>
    console.warn("[lead-routes] background task failed:", errorMessage(err))
  );
  try {
    c.executionCtx.waitUntil(guarded);
  } catch {
    // No ExecutionContext (Hono's app.request in tests): finish inline.
    await guarded;
  }
}

async function supabaseAdmin(c: LeadContext) {
  const url =
    envValue(c, "SUPABASE_URL") || envValue(c, "NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue(c, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

async function logAutomation(
  c: LeadContext,
  workflowName: string,
  status: "success" | "failure",
  payload?: unknown,
  errorMsg?: string
) {
  try {
    const admin = await supabaseAdmin(c);
    await admin?.from("automation_logs").insert({
      workflow_name: workflowName,
      trigger_type: "event",
      status,
      payload: payload ? JSON.stringify(payload) : null,
      error_message: errorMsg || null,
    });
  } catch (err) {
    console.error("[lead-routes] automation log failed:", errorMessage(err));
  }
}

export type HubSpotContactInput = {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  job_title?: string;
  lead_score?: number;
  source?: string;
};

/**
 * Create a HubSpot contact. A 409 (contact already exists) counts as success.
 * Only sends properties that exist on this portal's contacts.
 */
export async function syncContactToHubSpot(
  lead: HubSpotContactInput,
  token: string
): Promise<{
  ok: boolean;
  contactId?: string;
  existed?: boolean;
  error?: string;
}> {
  const score = typeof lead.lead_score === "number" ? lead.lead_score : 0;
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.first_name || "Protocol",
    lastname: lead.last_name || "Lead",
    company: lead.company_name || "Unknown Enterprise",
    jobtitle: lead.job_title || "",
    hs_lead_status: score > 70 ? "OPEN" : "NEW",
  };
  if (lead.source) properties.source = lead.source;

  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });
  if (res.status === 409) return { ok: true, existed: true };
  if (!res.ok) {
    return { ok: false, error: `HubSpot ${res.status}: ${await res.text()}` };
  }
  const data = (await res.json()) as { id?: string };
  return { ok: true, contactId: data.id };
}

/** Contact + demo deal for a /book submission (unchanged from the Next route). */
async function upsertHubSpotDeal(
  { name, email, company, message }: Record<string, string | undefined>,
  token: string,
  ownerId: string
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const [firstName, ...rest] = (name ?? "").split(" ");
  const lastName = rest.join(" ");

  let contactId: string | undefined;
  const cRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: {
        email,
        firstname: firstName,
        lastname: lastName,
        company: company ?? "",
      },
    }),
  });
  if (cRes.ok) {
    contactId = ((await cRes.json()) as { id?: string }).id;
  } else if (cRes.status === 409) {
    const err = (await cRes.json()) as { message?: string };
    const m = err.message?.match(/ID:\s*(\d+)/);
    if (m) {
      contactId = m[1];
    } else {
      const sRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: email },
              ],
            },
          ],
          limit: 1,
        }),
      });
      const sData = (await sRes.json()) as { results?: Array<{ id?: string }> };
      contactId = sData.results?.[0]?.id;
    }
  } else {
    console.warn("[api/book] HubSpot contact error:", cRes.status);
  }

  const dRes = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: {
        dealname: `Demo Request — ${name} @ ${company ?? "Unknown"}`,
        dealstage: "appointmentscheduled",
        hubspot_owner_id: ownerId,
        pipeline: "default",
        ...(message ? { description: message } : {}),
      },
    }),
  });
  if (!dRes.ok) {
    console.warn("[api/book] HubSpot deal error:", dRes.status);
    return;
  }
  const deal = (await dRes.json()) as { id: string };

  // associationTypeId 3 = deal_to_contact
  if (contactId) {
    await fetch(
      `${HS_BASE}/crm/v4/objects/deals/${deal.id}/associations/contacts/${contactId}/3`,
      { method: "PUT", headers }
    ).catch(e =>
      console.warn("[api/book] HubSpot association error:", errorMessage(e))
    );
  }
  return deal.id;
}

async function sendResend(
  apiKey: string,
  mail: { from: string; to: string; subject: string; html: string }
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mail),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

async function readJson(
  c: LeadContext
): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

async function handleBook(c: LeadContext) {
  const body = await readJson(c);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company);
  const message = str(body.message);
  const interest = str(body.interest);
  const prospectId = str(body.prospect_id);
  const utmCampaign = str(body.utm_campaign);

  if (!name || !email) {
    return c.json({ error: "name and email are required" }, 400);
  }

  // Indistinguishable 200 for bots: nothing written, nothing sent.
  const botReason = detectBot(body);
  if (botReason) {
    console.info("[api/book] dropped automated submission:", botReason);
    return c.json({ ok: true });
  }

  try {
    const admin = await supabaseAdmin(c);
    if (!admin) return c.json({ error: "Supabase not configured" }, 503);

    const now = new Date().toISOString();
    await admin.from("leads").upsert(
      {
        email,
        name,
        company,
        source: prospectId ? "b2b_outreach_reply" : "book_page",
        status: "demo_requested",
        industry: interest ?? null,
        metadata: {
          message,
          interest,
          prospect_id: prospectId ?? null,
          utm_campaign: utmCampaign ?? null,
          booked_at: now,
        },
        updatedAt: now,
      },
      { onConflict: "email" }
    );

    const token = hubspotToken(c);
    if (token) {
      const owner = envValue(c, "HUBSPOT_OWNER_ID") || DEFAULT_HUBSPOT_OWNER_ID;
      await background(
        c,
        upsertHubSpotDeal({ name, email, company, message }, token, owner)
      );
    }

    const resendKey = envValue(c, "RESEND_API_KEY");
    if (resendKey) {
      // Falls back to the one domain verified on the Resend account.
      const from = envValue(c, "OUTREACH_FROM_EMAIL") || "hello@strainchain.io";
      const to = envValue(c, "SALES_NOTIFY_EMAIL") || "hello@authichain.com";
      await background(
        c,
        sendResend(resendKey, {
          from,
          to,
          subject: `Demo request: ${name} @ ${company ?? ""}`,
          html: `
          <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) at <strong>${escapeHtml(company)}</strong> requested a demo call.</p>
          ${interest ? `<p><strong>Interest:</strong> ${escapeHtml(interest)}</p>` : ""}
          ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ""}
          ${prospectId ? `<p><strong>Prospect ID:</strong> ${escapeHtml(prospectId)} (originated from cold outreach)</p>` : ""}
          <p><a href="mailto:${escapeHtml(email)}">Reply directly →</a></p>
        `,
        })
      );
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("[api/book] error:", errorMessage(err));
    return c.json({ error: "Internal error" }, 500);
  }
}

async function runLeadAutomation(
  c: LeadContext,
  lead: {
    email: string;
    name?: string;
    source?: string;
    product_interest?: string;
  }
) {
  try {
    const apollo = envValue(c, "APOLLO_API_KEY");
    if (apollo) process.env.APOLLO_API_KEY = apollo;
    const enriched = await enrichLead(lead.email);
    const finalLead = { ...lead, ...enriched };

    const make = envValue(c, "MAKE_LEAD_WEBHOOK_URL");
    if (make) {
      await fetch(make, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...finalLead,
          timestamp: new Date().toISOString(),
        }),
      });
    }

    const n8n = envValue(c, "N8N_LEAD_WEBHOOK_URL");
    if (n8n) {
      await fetch(n8n, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalLead.name || "",
          email: finalLead.email,
          message: finalLead.product_interest || "",
          source: finalLead.source || "website",
          timestamp: new Date().toISOString(),
        }),
      }).catch(err =>
        console.error("[lead-routes] n8n webhook error:", errorMessage(err))
      );
    }

    const token = hubspotToken(c);
    if (token && (enriched.is_enterprise || enriched.lead_score > 60)) {
      const synced = await syncContactToHubSpot(
        { ...finalLead, source: lead.source },
        token
      );
      await logAutomation(
        c,
        "hubspot_sync",
        synced.ok ? "success" : "failure",
        {
          email: lead.email,
          contact_id: synced.contactId,
          existed: synced.existed,
        },
        synced.error
      );
    }

    await logAutomation(c, "lead_captured", "success", finalLead);
  } catch (err) {
    await logAutomation(c, "lead_captured", "failure", lead, errorMessage(err));
  }
}

async function handleLeadCapture(c: LeadContext) {
  const body = await readJson(c);
  const email = str(body?.email);
  if (!body || !email) return c.json({ error: "Email required" }, 400);

  const lead = {
    email,
    name: str(body.name),
    source: str(body.source) || "website",
    product_interest: str(body.product_interest) || "qron",
  };

  try {
    const admin = await supabaseAdmin(c);
    if (!admin) throw new Error("Supabase not configured");
    const { error } = await admin.from("lead_captures").insert({
      email,
      name: lead.name ?? null,
      source: lead.source,
      page_url: str(body.page_url) ?? null,
      utm_source: str(body.utm_source) ?? null,
      utm_medium: str(body.utm_medium) ?? null,
      utm_campaign: str(body.utm_campaign) ?? null,
      product_interest: lead.product_interest,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[lead-capture] DB error:", errorMessage(err));
    await logAutomation(
      c,
      "lead_capture.db_insert",
      "failure",
      { email, source: lead.source },
      errorMessage(err)
    );
  }

  await background(c, runLeadAutomation(c, lead));
  return c.json({ ok: true });
}

async function handleCrmSync(c: LeadContext) {
  const secret = envValue(c, "INTERNAL_API_SECRET");
  if (!secret)
    return c.json({ error: "INTERNAL_API_SECRET not configured" }, 503);
  const provided =
    c.req.header("x-internal-secret") ||
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!provided || !timingSafeEqualStrings(provided, secret)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = hubspotToken(c);
  if (!token) return c.json({ error: "CRM not configured" }, 503);

  const body = await readJson(c);
  const email = str(body?.email);
  if (!body || !email) return c.json({ error: "Email required" }, 400);

  const result = await syncContactToHubSpot(
    {
      email,
      first_name: str(body.first_name),
      last_name: str(body.last_name),
      company_name: str(body.company_name),
      job_title: str(body.job_title),
      lead_score:
        typeof body.lead_score === "number" ? body.lead_score : undefined,
      source: str(body.source),
    },
    token
  );
  await logAutomation(
    c,
    "hubspot_sync",
    result.ok ? "success" : "failure",
    { email, contact_id: result.contactId, existed: result.existed },
    result.error
  );
  if (!result.ok) {
    return c.json(
      { error: "HubSpot synchronization failed", detail: result.error },
      502
    );
  }
  return result.existed
    ? c.json({ success: true, message: "Contact already exists" })
    : c.json({ success: true, contact_id: result.contactId });
}

export function registerLeadRoutes(app: Hono<any>) {
  app.post("/api/book", c => handleBook(c));
  app.post("/api/leads/capture", c => handleLeadCapture(c));
  app.post("/api/lead-capture", c => handleLeadCapture(c));
  app.post("/api/crm/sync", c => handleCrmSync(c));
}
