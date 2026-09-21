/**
 * Prefill Stripe Checkout `customer_email` so abandoned-cart recovery
 * can mail a buyer who never typed an address on hosted Checkout.
 *
 * GET /api/checkout/* stays a 303 (or JSON error) — never marketing HTML.
 * Landing pages collect the address and pass `?email=`.
 */

import { type PlanId, planById, planPaymentLink } from "./plans";

export const CHECKOUT_REDIRECT_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/** Minimal form chrome for SEO hubs that do not load estate CSS. */
export const CHECKOUT_EMAIL_FORM_CSS = `.checkout-email-form{display:flex;flex-direction:column;gap:8px;max-width:22rem;margin:1rem 0 0;text-align:left}.checkout-email-label{display:flex;flex-direction:column;gap:6px;font-size:.85rem;font-weight:600}.checkout-email-form input[type=email]{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.checkout-email-hint{font-size:.82rem;opacity:.8;margin:0}.checkout-email-form button{cursor:pointer;font:inherit;padding:12px 20px;border-radius:8px;border:0;background:#4F46E5;color:#fff;font-weight:700}`;

export function checkoutRedirectResponse(url: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: url,
      ...CHECKOUT_REDIRECT_HEADERS,
    },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeCheckoutEmail(value: string): boolean {
  const email = value.trim();
  return email.length >= 3 && email.length <= 254 && EMAIL_RE.test(email);
}

export function pickCheckoutEmail(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const email = (candidate || "").trim().slice(0, 254);
    if (looksLikeCheckoutEmail(email)) return email;
  }
  return "";
}

/** Bounce a GET one-click (no `?email=`) to a landing that captures it. */
export function checkoutNeedEmailRedirect(
  kind: "dpp" | "plan",
  visitId?: string
): string {
  const url = new URL(
    kind === "dpp"
      ? "https://authichain.com/dpp"
      : "https://authichain.com/pricing"
  );
  url.searchParams.set("need_email", "1");
  if (visitId) url.searchParams.set("visit_id", visitId.slice(0, 128));
  return url.toString();
}

/** Banner + query-param copy for landings that collect checkout email. */
export const CHECKOUT_NEED_EMAIL_BANNER_HTML =
  '<div id="checkout-need-email-banner" class="checkout-need-email">Enter a work email so Stripe can recover this cart. Checkout does not start without it.</div>';

export const CHECKOUT_NEED_EMAIL_DECORATE_JS = `<script>
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    document.querySelectorAll('form.checkout-email-form').forEach(function (form) {
      ['visit_id','prospect_id','utm_source','utm_medium','utm_campaign','utm_content','utm_term','source'].forEach(function (key) {
        var value = params.get(key);
        if (!value) return;
        var el = form.querySelector('input[name="'+key+'"]');
        if (!el) {
          el = document.createElement('input');
          el.type = 'hidden';
          el.name = key;
          form.appendChild(el);
        }
        el.value = value.slice(0, 512);
      });
    });
    if (params.get('need_email') === '1') {
      var banner = document.getElementById('checkout-need-email-banner');
      if (banner) banner.classList.add('is-visible');
      var input = document.querySelector('form.checkout-email-form input[name="email"]');
      if (input) input.focus();
    }
  } catch (e) {}
})();
</script>`;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function checkoutEmailFormHtml(opts: {
  action: string;
  label: string;
  required?: boolean;
  formId?: string;
  inputId?: string;
  hint?: string;
  extraClass?: string;
  buttonClass?: string;
}): string {
  const required = opts.required !== false;
  const formId = opts.formId ? ` id="${esc(opts.formId)}"` : "";
  const inputId = opts.inputId || "checkout-email";
  const hint =
    opts.hint ?? "Receipt and abandoned-checkout recovery. Not a newsletter.";
  const cls = ["checkout-email-form", opts.extraClass]
    .filter(Boolean)
    .join(" ");
  const buttonClass = opts.buttonClass || "btn btn-primary";
  return `<form class="${esc(cls)}" action="${esc(opts.action)}" method="get"${formId}>
  <label class="checkout-email-label" for="${esc(inputId)}">Work email
    <input id="${esc(inputId)}" name="email" type="email"${required ? " required" : ""} maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com">
  </label>
  <p class="checkout-email-hint">${esc(hint)}</p>
  <button class="${esc(buttonClass)}" type="submit">${esc(opts.label)}</button>
</form>`;
}

/** Secondary CTA: the catalogue Payment Link from `src/lib/plans.ts`. */
export function catalogPaymentLinkHtml(opts: {
  planId: PlanId;
  label: string;
  className?: string;
}): string {
  const href = planPaymentLink(opts.planId);
  if (!href) return "";
  const cls = opts.className || "btn btn-outline";
  return `<a class="${esc(cls)}" href="${esc(href)}">${esc(opts.label)}</a>`;
}

/** Map a live checkout action to the catalogue plan it charges. */
export function planIdFromCheckoutAction(action: string): PlanId | undefined {
  let path = action.trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return undefined;
  }
  path = path.replace(/\/+$/, "") || "/";
  if (path === "/api/checkout/dpp" || path === "/protocol/checkout/dpp") {
    return "dpp_readiness";
  }
  const match = path.match(/^\/api\/checkout\/plan\/([a-z0-9_]+)$/);
  if (!match) return undefined;
  const id = match[1] as PlanId;
  return planById(id) ? id : undefined;
}

/**
 * Email-gated checkout plus the durable Payment Link for that SKU, so a
 * visitor can pay on Stripe without the attributed session.
 */
export function emailCheckoutWithPaymentLinkHtml(opts: {
  action: string;
  label: string;
  required?: boolean;
  formId?: string;
  inputId?: string;
  hint?: string;
  extraClass?: string;
  buttonClass?: string;
  planId?: PlanId;
  paymentLinkClassName?: string;
}): string {
  const form = checkoutEmailFormHtml(opts);
  const planId = opts.planId ?? planIdFromCheckoutAction(opts.action);
  if (!planId) return form;
  const plan = planById(planId);
  const pay = catalogPaymentLinkHtml({
    planId,
    label: plan ? `Pay $${plan.price} on Stripe` : "Pay on Stripe",
    className: opts.paymentLinkClassName,
  });
  if (!pay) return form;
  return `${form}<div class="checkout-payment-link" style="margin-top:8px">${pay}</div>`;
}

/**
 * Map a one-click checkout <a href> to the catalogue Payment Link for that
 * SKU. Stale APP_WORKER HTML still one-clicks /api/checkout; the landing
 * worker rewrites those anchors so Bing SEO hubs can pay before edge-router
 * deploys. Form actions stay email-gated.
 */
export function rewriteCheckoutHref(href: string): string | undefined {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:")) {
    return undefined;
  }
  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (host !== "authichain.com" && host !== "www.authichain.com") {
        return undefined;
      }
      pathname = url.pathname;
    } else {
      pathname = raw.split("?")[0].split("#")[0];
    }
  } catch {
    return undefined;
  }
  const planId = planIdFromCheckoutAction(pathname);
  if (!planId) return undefined;
  return planPaymentLink(planId);
}

/** Replace checkout <a href> only. Leave <form action> so email capture still posts. */
export function rewriteCheckoutHrefsInHtml(html: string): string {
  return html.replace(/href=(["'])([^"']*)\1/gi, (full, quote, href) => {
    const next = rewriteCheckoutHref(String(href));
    return next ? `href=${quote}${next}${quote}` : full;
  });
}

export async function rewriteProxiedCheckoutHtml(
  response: Response
): Promise<Response> {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  if (!contentType.includes("text/html")) return response;
  const html = await response.text();
  const rewritten = rewriteCheckoutHrefsInHtml(html);
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
