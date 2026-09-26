/**
 * One-click opt-out for cold email, on the edge router (apex /api/* lands here,
 * docs/ROUTING.md).
 *
 * GET  /api/outreach/unsubscribe?e=&t=        the link in the email footer
 * POST /api/outreach/unsubscribe?e=&t=        RFC 8058 List-Unsubscribe=One-Click
 * GET  /api/outreach/unsubscribe/check?e=&t=  pre-send check: same secret? no write
 *
 * A valid link adds the address to guardrail_suppression_list, the table the
 * send gate reads before every script send (shared/guardrail-store.ts), over
 * Supabase REST with the credentials this Worker already has.
 *
 * Fails closed: with no OUTREACH_UNSUBSCRIBE_SECRET or no Supabase credentials
 * the link answers 503 and says to reply instead, and the check answers 503,
 * which keeps live sends in dry run (scripts/outreach-optout-check.ts).
 * A GET unsubscribes too, so a mail scanner that prefetches the link can only
 * ever remove someone, never add them.
 */
import type { Hono } from "hono";
import {
  normalizeOptOutEmail,
  UNSUBSCRIBE_CHECK_EMAIL,
  UNSUBSCRIBE_CHECK_PATH,
  UNSUBSCRIBE_PATH,
  verifyUnsubscribeToken,
} from "../server/outreach/unsubscribe-link";

export type UnsubscribeBindings = {
  OUTREACH_UNSUBSCRIBE_SECRET?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const NO_STORE = { "Cache-Control": "private, no-store" };

function config(env?: UnsubscribeBindings) {
  const secret =
    env?.OUTREACH_UNSUBSCRIBE_SECRET ||
    process.env.OUTREACH_UNSUBSCRIBE_SECRET ||
    "";
  const url = (
    env?.SUPABASE_URL ||
    env?.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const key =
    env?.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return { secret, url, key, configured: Boolean(secret && url && key) };
}

export async function recordOptOut(
  cfg: { url: string; key: string },
  email: string,
  fetchImpl: typeof fetch = fetch,
  source: "unsubscribe_link" | "inbound_reply" = "unsubscribe_link"
): Promise<boolean> {
  const res = await fetchImpl(
    `${cfg.url}/rest/v1/guardrail_suppression_list?on_conflict=email`,
    {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        // Already suppressed is success, not an error.
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        email,
        reason: "unsubscribed",
        source,
      }),
    }
  );
  return res.ok;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ] as string
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6;color:#1f2937}h1{font-size:1.4rem}</style></head><body><h1>${esc(title)}</h1><p>${body}</p></body></html>`;
}

type Ctx = {
  req: {
    query: (name: string) => string | undefined;
    method: string;
  };
  env?: UnsubscribeBindings;
  html: (
    body: string,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
  text: (
    body: string,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
};

async function unsubscribe(c: Ctx): Promise<Response> {
  const post = c.req.method === "POST";
  const reply = (status: number, title: string, body: string) =>
    post
      ? c.text(title, status as 200, NO_STORE)
      : c.html(page(title, body), status as 200, NO_STORE);

  const cfg = config(c.env);
  if (!cfg.configured) {
    return reply(
      503,
      "We couldn't record this right now",
      "Please reply to the email with the word <strong>unsubscribe</strong> and we will remove you by hand."
    );
  }
  const email = normalizeOptOutEmail(c.req.query("e") ?? "");
  const token = c.req.query("t") ?? "";
  if (
    !email ||
    email === UNSUBSCRIBE_CHECK_EMAIL ||
    !(await verifyUnsubscribeToken(cfg.secret, email, token))
  ) {
    return reply(
      400,
      "This unsubscribe link isn't valid",
      "It may have been cut short when it was copied. Reply to the email with the word <strong>unsubscribe</strong> instead."
    );
  }
  let ok = false;
  try {
    ok = await recordOptOut(cfg, email);
  } catch {
    ok = false;
  }
  if (!ok) {
    return reply(
      503,
      "We couldn't record this right now",
      "Please try the link again in a few minutes, or reply to the email with the word <strong>unsubscribe</strong>."
    );
  }
  return reply(
    200,
    "You're unsubscribed",
    `${esc(email)} won't get further outreach email from AuthiChain.`
  );
}

export function registerUnsubscribeRoutes<
  E extends UnsubscribeBindings,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.get(UNSUBSCRIBE_CHECK_PATH, async c => {
    const cfg = config(c.env);
    if (!cfg.configured) {
      return c.json({ configured: false, tokenValid: false }, 503, NO_STORE);
    }
    const email = normalizeOptOutEmail(c.req.query("e") ?? "");
    if (email !== UNSUBSCRIBE_CHECK_EMAIL) {
      return c.json({ error: "check_email_only" }, 400, NO_STORE);
    }
    const tokenValid = await verifyUnsubscribeToken(
      cfg.secret,
      email,
      c.req.query("t") ?? ""
    );
    return c.json(
      { configured: true, tokenValid },
      tokenValid ? 200 : 409,
      NO_STORE
    );
  });
  app.get(UNSUBSCRIBE_PATH, c => unsubscribe(c as unknown as Ctx));
  app.post(UNSUBSCRIBE_PATH, c => unsubscribe(c as unknown as Ctx));
}
