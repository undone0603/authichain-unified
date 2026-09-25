/**
 * Click-to-confirm checkout gate.
 *
 * Why: Sep 20-25 2026 — 98 of the last 100 live Checkout Sessions expired
 * unpaid, 85 with no email. One-click GET links (/api/checkout/*, and raw
 * buy.stripe.com Payment Links, which also open a session on GET) were being
 * opened by link scanners, email security gateways and chat link previews.
 *
 * Rule: a GET/HEAD never calls Stripe. GET renders a confirm page with a POST
 * form; only a POST from that form (valid email, not a bot, not a prefetch)
 * creates a Checkout Session.
 *
 * Stable public path (Marketing drafts, sites, outreach):
 *   https://authichain.com/checkout            → plan chooser
 *   https://authichain.com/checkout/<planId>   → confirm page for one plan
 *   optional ?email=you@co.com&utm_*=…&visit_id=… prefill the form.
 */
import { applyHostedCheckoutRecovery } from "./checkout-recovery";
import { CHECKOUT_REDIRECT_HEADERS, pickCheckoutEmail } from "./checkout-email";
import {
  DPP_OFFER_KEY,
  GATED_CHECKOUT_ORIGIN,
  PLANS,
  gatedCheckoutUrl,
  listedPlans,
  planById,
  type Plan,
  type PlanId,
} from "./plans";

export { GATED_CHECKOUT_ORIGIN, gatedCheckoutUrl };

/** Friendly aliases → catalogue ids for /checkout/<alias>. */
const PLAN_ALIASES: Record<string, PlanId> = {
  dpp: "dpp_readiness",
  passport: "strainchain_passport",
  farm: "strainchain_farm",
};

/** Query/form keys carried from the landing into Stripe metadata. */
export const CHECKOUT_CARRY_KEYS = [
  "visit_id",
  "prospect_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "source",
  "referrer",
  "ref",
  "affiliate_code",
] as const;

export const CHECKOUT_SUCCESS_ORIGIN = "https://authichain.govchain.us";

const HTML_HEADERS: Record<string, string> = {
  ...CHECKOUT_REDIRECT_HEADERS,
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

/** Sites allowed to POST the confirm form cross-origin. */
const ALLOWED_POST_ORIGIN_HOSTS = [
  "authichain.com",
  "authichain.govchain.us",
  "govchain.us",
  "strainchain.io",
  "qron.space",
];

export function isGatedCheckoutPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/checkout" || /^\/checkout\/[A-Za-z0-9_-]+$/.test(p);
}

/** `/checkout/<id|alias>` → purchasable catalogue plan, else undefined. */
export function planFromGatedPath(pathname: string): Plan | undefined {
  const p = pathname.replace(/\/+$/, "");
  const m = p.match(/^\/checkout\/([A-Za-z0-9_-]+)$/);
  if (!m) return undefined;
  const slug = m[1].toLowerCase();
  const id = (PLAN_ALIASES[slug] ?? slug) as PlanId;
  const plan = planById(id);
  if (!plan || !plan.stripe_price_id || !plan.stripe_mode) return undefined;
  return plan;
}

/**
 * Gated confirm URL for a plan, carrying email + attribution from a legacy
 * one-click URL (e.g. /api/checkout/dpp?email=…&utm_source=…).
 */
export function gatedConfirmUrl(
  planId: PlanId,
  from?: URLSearchParams | null
): string {
  const url = new URL(gatedCheckoutUrl(planId));
  if (from) {
    const email = pickCheckoutEmail(from.get("email"));
    if (email) url.searchParams.set("email", email);
    for (const key of CHECKOUT_CARRY_KEYS) {
      const v = (from.get(key) || "").trim();
      if (v) url.searchParams.set(key, v.slice(0, 256));
    }
  }
  return url.toString();
}

// ─── Bot / prefetch detection (belt and braces; the POST step is the fix) ───

const BOT_UA_RE =
  /bot\b|bot\/|crawler|spider|slurp|linkpreview|preview\/|scanner|facebookexternalhit|embedly|quora link|outbrain|vkshare|w3c_validator|headlesschrome|phantomjs|puppeteer|playwright|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|libwww|wget\/|curl\/|node-fetch|undici|axios\/|scrapy|barracuda|mimecast|proofpoint|safelinks|urldefense|trendmicro|symantec|forcepoint|fortiguard|zscaler|ironport|google-safety|googleother|bingpreview|ahrefs|semrush|mj12|petalbot|yandex|baiduspider|pingdom|statuscake|uptimerobot|checkly/i;

/** Headers browsers send on speculative loads (never a human click). */
export function isPrefetchRequest(request: Request): boolean {
  const h = request.headers;
  const values = [
    h.get("purpose"),
    h.get("sec-purpose"),
    h.get("x-purpose"),
    h.get("x-moz"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /prefetch|prerender|preview/.test(values);
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua || "").trim();
  if (!s) return true;
  return BOT_UA_RE.test(s);
}

export function isAutomatedCheckoutRequest(request: Request): boolean {
  return (
    isPrefetchRequest(request) ||
    isBotUserAgent(request.headers.get("user-agent"))
  );
}

/** Reject explicit foreign Origins (auto-submitting third-party forms). */
export function isAllowedPostOrigin(request: Request): boolean {
  const origin = (request.headers.get("origin") || "").trim();
  if (!origin || origin === "null") return true;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ALLOWED_POST_ORIGIN_HOSTS.some(
    allowed => host === allowed || host.endsWith(`.${allowed}`)
  );
}

// ─── HTML ───────────────────────────────────────────────────────────────────

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

function priceLabel(plan: Plan): string {
  const suffix =
    plan.price_suffix === "/month" || plan.stripe_mode === "subscription"
      ? "/mo"
      : "";
  return `$${plan.price.toLocaleString("en-US")}${suffix}`;
}

const PAGE_CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#0b0b10;color:#f4f4f5;line-height:1.55;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}main{width:100%;max-width:30rem;background:#111118;border:1px solid #27272a;border-radius:16px;padding:28px}h1{font-size:1.35rem;margin-bottom:.25rem}.price{font-size:1.9rem;font-weight:800;color:#00ffd1;margin:.5rem 0}.desc{color:#a1a1aa;font-size:.95rem;margin-bottom:1rem}label{display:flex;flex-direction:column;gap:6px;font-size:.85rem;font-weight:600;color:#d4d4d8}input[type=email]{padding:11px 12px;border:1px solid #3f3f46;border-radius:8px;background:#09090b;color:#fff;font:inherit}button{margin-top:14px;width:100%;padding:13px 18px;border:0;border-radius:10px;background:#00ffd1;color:#000;font:inherit;font-weight:800;cursor:pointer}.hint{font-size:.8rem;color:#a1a1aa;margin-top:8px}.err{background:#3f1d1d;border:1px solid #7f1d1d;color:#fecaca;padding:8px 10px;border-radius:8px;font-size:.85rem;margin-bottom:10px}.hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}ul.plans{list-style:none;display:flex;flex-direction:column;gap:10px;margin-top:1rem}ul.plans a{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #27272a;border-radius:10px;color:#fff;text-decoration:none}ul.plans a:hover{border-color:#00ffd1}.links{margin-top:18px;font-size:.85rem}.links a{color:#a1a1aa;margin-right:12px}`;

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="https://authichain.com/favicon.svg"><style>${PAGE_CSS}</style></head><body><main>${body}</main></body></html>`;
}

export function renderCheckoutConfirmPage(opts: {
  plan: Plan;
  params?: URLSearchParams | null;
  error?: string;
}): string {
  const { plan } = opts;
  const params = opts.params ?? new URLSearchParams();
  const email = pickCheckoutEmail(params.get("email"));
  const hidden = CHECKOUT_CARRY_KEYS.map(key => {
    const v = (params.get(key) || "").trim().slice(0, 256);
    return v ? `<input type="hidden" name="${key}" value="${esc(v)}">` : "";
  }).join("");
  const action = `/checkout/${plan.id}`;
  const err = opts.error ? `<div class="err" role="alert">${esc(opts.error)}</div>` : "";
  return pageShell(
    `Confirm ${plan.name} — AuthiChain checkout`,
    `<h1>${esc(plan.name)}</h1>
<div class="price">${esc(priceLabel(plan))}</div>
<p class="desc">${esc(plan.description)}</p>
${err}<form method="post" action="${esc(action)}" id="checkout-confirm">
<label for="checkout-confirm-email">Work email
<input id="checkout-confirm-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com" value="${esc(email)}"></label>
<div class="hp" aria-hidden="true"><label>Leave empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
${hidden}<button type="submit">Continue to secure Stripe checkout</button>
<p class="hint">We use this for your receipt and to follow up if checkout doesn't finish. No newsletter. You will review the total on Stripe before paying.</p>
</form>
<div class="links"><a href="/checkout">All plans</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a></div>`
  );
}

export function renderCheckoutChooserPage(params?: URLSearchParams | null): string {
  const carry = new URLSearchParams();
  if (params) {
    const email = pickCheckoutEmail(params.get("email"));
    if (email) carry.set("email", email);
    for (const key of CHECKOUT_CARRY_KEYS) {
      const v = (params.get(key) || "").trim();
      if (v) carry.set(key, v.slice(0, 256));
    }
  }
  const qs = carry.toString() ? `?${carry.toString()}` : "";
  const plans = [
    ...listedPlans("qron"),
    ...listedPlans("strainchain"),
  ].filter(p => p.stripe_price_id && p.stripe_mode);
  const items = plans
    .map(
      p =>
        `<li><a href="/checkout/${esc(p.id)}${esc(qs)}"><span>${esc(p.name)}</span><strong>${esc(priceLabel(p))}</strong></a></li>`
    )
    .join("");
  return pageShell(
    "Checkout — AuthiChain",
    `<h1>Choose a plan</h1><p class="desc">Pick a plan, confirm your work email, then pay on Stripe. Prices come from the published AuthiChain catalogue.</p><ul class="plans">${items}</ul><div class="links"><a href="/pricing">Compare plans</a><a href="/contact">Contact</a></div>`
  );
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: HTML_HEADERS });
}

// ─── Stripe session (POST only) ─────────────────────────────────────────────

export type GatedSessionResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; detail?: string };

function readCookie(cookieHeader: string, name: string): string {
  const raw = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function newVisitId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Build the form body for POST /v1/checkout/sessions. Mirrors the metadata of
 * src/lib/dpp-checkout.ts (DPP) and src/lib/plan-checkout.ts (plans).
 */
export function buildGatedSessionBody(opts: {
  plan: Plan;
  email: string;
  fields: URLSearchParams;
  cookieHeader?: string;
  successOrigin?: string;
}): URLSearchParams {
  const { plan, email, fields } = opts;
  const origin = opts.successOrigin || CHECKOUT_SUCCESS_ORIGIN;
  const f = (k: string, max = 128) => (fields.get(k) || "").trim().slice(0, max);
  const isDpp = plan.id === "dpp_readiness";
  const visitId =
    f("visit_id") || f("prospect_id") || newVisitId(isDpp ? "dpp" : "chk");
  const utmSource = f("utm_source", 64);
  const source = utmSource || f("source", 64) || "direct";
  const cookieHeader = opts.cookieHeader || "";
  const affiliateCode = (
    f("affiliate_code", 64) ||
    f("ref", 64) ||
    readCookie(cookieHeader, "aff_ref")
  ).slice(0, 64);
  const refCode = readCookie(cookieHeader, "ref_code").slice(0, 64);
  const mode = plan.stripe_mode as "payment" | "subscription";
  const brand = plan.brand ?? "authichain";

  const body = new URLSearchParams();
  body.set("mode", mode);
  body.set("line_items[0][price]", plan.stripe_price_id as string);
  body.set("line_items[0][quantity]", "1");
  body.set("payment_method_types[0]", "card");
  body.set(
    "success_url",
    `${origin}/dpp/thanks?session_id={CHECKOUT_SESSION_ID}&visit_id=${encodeURIComponent(visitId)}`
  );
  body.set(
    "cancel_url",
    isDpp
      ? `${origin}/dpp?cancelled=1&visit_id=${encodeURIComponent(visitId)}`
      : `${origin}/pricing?cancelled=1`
  );
  body.set("client_reference_id", visitId.slice(0, 200));
  body.set("customer_email", email);
  const meta: Record<string, string> = {
    plan: plan.id,
    brand,
    stripe_price_id: plan.stripe_price_id as string,
    prospect_id: visitId,
    visit_id: visitId,
    source,
    checkout_gate: "confirm_post",
  };
  if (isDpp) meta.offer = DPP_OFFER_KEY;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = f(k, k === "utm_source" || k === "utm_medium" ? 64 : 128);
    if (v) meta[k] = v;
  }
  const referrer = f("referrer", 450);
  if (referrer) meta.referrer = referrer;
  if (affiliateCode) meta.affiliate_code = affiliateCode;
  if (refCode) meta.ref_code = refCode;
  for (const [k, v] of Object.entries(meta)) body.set(`metadata[${k}]`, v);
  if (mode === "subscription") {
    for (const [k, v] of Object.entries(meta)) {
      body.set(`subscription_data[metadata][${k}]`, v);
    }
  }
  applyHostedCheckoutRecovery(body, mode);
  return body;
}

export async function createGatedCheckoutSession(opts: {
  plan: Plan;
  email: string;
  fields: URLSearchParams;
  stripeSecretKey: string;
  cookieHeader?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatedSessionResult> {
  const key = (opts.stripeSecretKey || "").trim();
  if (!key) return { ok: false, status: 500, error: "Stripe is not configured" };
  const body = buildGatedSessionBody(opts);
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  let data: { url?: string; error?: { message?: string } } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !data.url) {
    return {
      ok: false,
      status: 502,
      error: "Failed to start checkout",
      detail: data.error?.message || `stripe ${res.status}`,
    };
  }
  return { ok: true, url: data.url };
}

// ─── Request handler ────────────────────────────────────────────────────────

export type GatedCheckoutEnv = { STRIPE_SECRET_KEY?: string };

async function readFormFields(request: Request): Promise<URLSearchParams> {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  try {
    if (type.includes("application/x-www-form-urlencoded")) {
      return new URLSearchParams(await request.text());
    }
    if (type.includes("multipart/form-data")) {
      const fd = await request.formData();
      const out = new URLSearchParams();
      fd.forEach((v, k) => {
        if (typeof v === "string") out.append(k, v);
      });
      return out;
    }
  } catch {
    /* fall through */
  }
  return new URLSearchParams();
}

/**
 * /checkout and /checkout/<plan>.
 *   GET/HEAD → confirm page (200) or chooser; unknown plan 404. Never Stripe.
 *   POST     → validate (email, honeypot, origin, bot/prefetch) → 303 Stripe.
 */
export async function tryHandleGatedCheckout(
  request: Request,
  env: GatedCheckoutEnv,
  deps: { fetchImpl?: typeof fetch } = {}
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isGatedCheckoutPath(url.pathname)) return null;
  const method = request.method.toUpperCase();
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (p === "/checkout") {
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...CHECKOUT_REDIRECT_HEADERS, Allow: "GET, HEAD" },
      });
    }
    const html = renderCheckoutChooserPage(url.searchParams);
    return method === "HEAD"
      ? new Response(null, { status: 200, headers: HTML_HEADERS })
      : htmlResponse(html);
  }

  const plan = planFromGatedPath(p);
  if (!plan) {
    const html = renderCheckoutChooserPage(url.searchParams);
    return method === "HEAD"
      ? new Response(null, { status: 404, headers: HTML_HEADERS })
      : htmlResponse(html, 404);
  }
  // Canonicalise aliases (/checkout/dpp → /checkout/dpp_readiness).
  if (p !== `/checkout/${plan.id}` && (method === "GET" || method === "HEAD")) {
    return new Response(null, {
      status: 301,
      headers: {
        ...CHECKOUT_REDIRECT_HEADERS,
        Location: `/checkout/${plan.id}${url.search}`,
      },
    });
  }

  if (method === "GET" || method === "HEAD") {
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: HTML_HEADERS });
    }
    return htmlResponse(renderCheckoutConfirmPage({ plan, params: url.searchParams }));
  }

  if (method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...CHECKOUT_REDIRECT_HEADERS, Allow: "GET, HEAD, POST" },
    });
  }

  const fields = await readFormFields(request);
  if (isAutomatedCheckoutRequest(request) || !isAllowedPostOrigin(request)) {
    return htmlResponse(
      renderCheckoutConfirmPage({
        plan,
        params: fields,
        error:
          "This request looked automated, so checkout was not started. If you are a person, press the button again from a normal browser.",
      }),
      403
    );
  }
  if ((fields.get("website") || "").trim()) {
    // Honeypot filled — silently show the page again, no Stripe call.
    return htmlResponse(renderCheckoutConfirmPage({ plan, params: fields }), 400);
  }
  const email = pickCheckoutEmail(fields.get("email"));
  if (!email) {
    return htmlResponse(
      renderCheckoutConfirmPage({
        plan,
        params: fields,
        error: "Enter a valid work email to continue.",
      }),
      400
    );
  }
  const result = await createGatedCheckoutSession({
    plan,
    email,
    fields,
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    cookieHeader: request.headers.get("cookie") || "",
    fetchImpl: deps.fetchImpl,
  });
  if (!result.ok) {
    return htmlResponse(
      renderCheckoutConfirmPage({
        plan,
        params: fields,
        error: "Stripe checkout could not start. Please try again in a minute or use /contact.",
      }),
      result.status
    );
  }
  return new Response(null, {
    status: 303,
    headers: { ...CHECKOUT_REDIRECT_HEADERS, Location: result.url },
  });
}

/** Every catalogue plan that the gate can sell (for tests/inventory). */
export function gatedCheckoutPlanIds(): PlanId[] {
  return PLANS.filter(p => p.stripe_price_id && p.stripe_mode).map(p => p.id);
}
