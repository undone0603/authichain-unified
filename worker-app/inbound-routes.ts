/**
 * Resend inbound webhook: replies to cold email that ask to stop are recorded
 * as opt-outs, the same way a click on the signed link is.
 *
 * POST /api/outreach/inbound   (Resend webhook, event `email.received`)
 *
 * 1. Verify the Svix signature on the raw body (RESEND_INBOUND_WEBHOOK_SECRET,
 *    the endpoint's `whsec_…` signing secret). Anything else is 401.
 * 2. Resend webhooks carry metadata only, so fetch the message
 *    (GET https://api.resend.com/emails/receiving/{email_id}) with
 *    RESEND_INBOUND_API_KEY (falls back to RESEND_API_KEY): use the key of the
 *    Resend account that owns the receiving domain (reply.authichain.com).
 * 3. If the new part of the reply asks to stop (server/outreach/reply-optout.ts),
 *    add the sender to guardrail_suppression_list, source `inbound_reply`.
 *
 * Failures that a retry could fix (fetch or write) answer 5xx so Resend
 * redelivers; a reply that isn't an opt-out answers 200 and is left in the
 * Resend inbox for a person to read. Nothing is sent back to the sender.
 */
import type { Hono } from "hono";
import { senderAddress, wantsOptOut } from "../server/outreach/reply-optout";
import { verifySvix } from "../server/outreach/svix-verify";
import { recordOptOut } from "./unsubscribe-routes";

export const INBOUND_PATH = "/api/outreach/inbound";

export type InboundBindings = {
  RESEND_INBOUND_WEBHOOK_SECRET?: string;
  RESEND_INBOUND_API_KEY?: string;
  RESEND_API_KEY?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const NO_STORE = { "Cache-Control": "private, no-store" };

function config(env?: InboundBindings) {
  const pick = (...v: Array<string | undefined>) =>
    v.find(x => x && x.trim()) ?? "";
  return {
    secret: pick(
      env?.RESEND_INBOUND_WEBHOOK_SECRET,
      process.env.RESEND_INBOUND_WEBHOOK_SECRET
    ),
    apiKey: pick(
      env?.RESEND_INBOUND_API_KEY,
      process.env.RESEND_INBOUND_API_KEY,
      env?.RESEND_API_KEY,
      process.env.RESEND_API_KEY
    ),
    url: pick(
      env?.SUPABASE_URL,
      env?.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ).replace(/\/+$/, ""),
    key: pick(
      env?.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  };
}

type ReceivedEmail = {
  from?: unknown;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
};

export type InboundResult =
  | {
      status: 200;
      body: {
        ok: true;
        action: "ignored" | "none" | "suppressed";
        reason?: string;
      };
    }
  | { status: 401 | 400 | 502 | 503; body: { ok: false; error: string } };

export async function handleInbound(
  req: { headers: Headers; body: string },
  env: InboundBindings | undefined,
  fetchImpl: typeof fetch = fetch,
  now?: number
): Promise<InboundResult> {
  const cfg = config(env);
  if (!cfg.secret || !cfg.apiKey || !cfg.url || !cfg.key) {
    return {
      status: 503,
      body: { ok: false, error: "inbound_not_configured" },
    };
  }
  const check = await verifySvix({
    secret: cfg.secret,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body: req.body,
    now,
  });
  if (!check.ok)
    return { status: 401, body: { ok: false, error: check.reason } };

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(req.body);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }
  if (event.type !== "email.received") {
    return {
      status: 200,
      body: { ok: true, action: "ignored", reason: event.type ?? "no_type" },
    };
  }
  const emailId = event.data?.email_id;
  if (!emailId)
    return { status: 400, body: { ok: false, error: "missing_email_id" } };

  let email: ReceivedEmail;
  try {
    const res = await fetchImpl(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
      { headers: { Authorization: `Bearer ${cfg.apiKey}` } }
    );
    if (!res.ok)
      return {
        status: 502,
        body: { ok: false, error: `resend_http_${res.status}` },
      };
    email = (await res.json()) as ReceivedEmail;
  } catch {
    return { status: 502, body: { ok: false, error: "resend_unreachable" } };
  }

  if (!wantsOptOut(email)) {
    return { status: 200, body: { ok: true, action: "none" } };
  }
  const sender = senderAddress(email.from);
  if (!sender)
    return {
      status: 200,
      body: { ok: true, action: "none", reason: "no_sender" },
    };

  let recorded = false;
  try {
    recorded = await recordOptOut(cfg, sender, fetchImpl, "inbound_reply");
  } catch {
    recorded = false;
  }
  if (!recorded)
    return {
      status: 503,
      body: { ok: false, error: "suppression_write_failed" },
    };
  return { status: 200, body: { ok: true, action: "suppressed" } };
}

export function registerInboundRoutes<
  E extends InboundBindings,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.post(INBOUND_PATH, async c => {
    const body = await c.req.text();
    const result = await handleInbound(
      { headers: c.req.raw.headers, body },
      c.env
    );
    return c.json(result.body, result.status, NO_STORE);
  });
}
