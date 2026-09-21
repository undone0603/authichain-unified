/**
 * Prefill Stripe Checkout `customer_email` so abandoned-cart recovery
 * can mail a buyer who never typed an address on hosted Checkout.
 *
 * GET /api/checkout/* stays a 303 (or JSON error) — never marketing HTML.
 * Landing pages collect the address and pass `?email=`.
 */

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
