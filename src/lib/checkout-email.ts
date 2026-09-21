/**
 * Prefill Stripe Checkout `customer_email` so abandoned-cart recovery
 * can mail a buyer who never typed an address on hosted Checkout.
 *
 * GET /api/checkout/* stays a 303 (or JSON error) — never marketing HTML.
 * Landing pages collect the address and pass `?email=`.
 */

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
