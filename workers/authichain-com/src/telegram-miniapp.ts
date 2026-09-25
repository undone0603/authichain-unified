/**
 * Telegram Mini App for StrainChain Passport ($49).
 *
 * Hosted on the apex worker so BotFather's Menu Button can point at a real
 * authichain.com URL without reviving the archived authichain-telegram worker
 * or paying for Workers. Checkout is the live Passport rail — do not invent
 * TruMark prices or ship the May 2025 Inc / Series A claims.
 */
import { catalogPaymentLinkHtml } from "../../../src/lib/checkout-email";

export const PASSPORT_CHECKOUT_PATH = "https://authichain.com/checkout/strainchain_passport";
export const PASSPORT_CHECKOUT_URL = PASSPORT_CHECKOUT_PATH;
export const MINIAPP_CANONICAL = "https://authichain.govchain.us/telegram";

const MINIAPP_PATHS = new Set([
  "/telegram",
  "/telegram/",
  "/miniapp",
  "/miniapp/",
]);

export function isTelegramMiniAppPath(pathname: string): boolean {
  return MINIAPP_PATHS.has(pathname);
}

/** Telegram Desktop embeds Mini Apps in an iframe — do not send X-Frame-Options: DENY. */
export const MINIAPP_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://authichain.govchain.us https://telegram.org",
    "font-src 'self' data: https:",
    "frame-ancestors https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://telegram.org",
  ].join("; "),
};

export function renderTelegramMiniApp(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>StrainChain Passport | AuthiChain</title>
  <meta name="description" content="Publish one StrainChain genetics passport from your existing CoAs for $49. Self-serve Stripe checkout. Optional TruMark verify.">
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${MINIAPP_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg: var(--tg-theme-bg-color, #0b1220);
      --card: var(--tg-theme-secondary-bg-color, #141c2e);
      --text: var(--tg-theme-text-color, #e8eefc);
      --muted: var(--tg-theme-hint-color, #94a3b8);
      --accent: var(--tg-theme-button-color, #4F46E5);
      --accent-text: var(--tg-theme-button-text-color, #ffffff);
      --line: color-mix(in srgb, var(--text) 12%, transparent);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { min-height: 100%; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      line-height: 1.5;
      padding: 20px 18px calc(24px + var(--tg-safe-area-inset-bottom, 0px));
    }
    main { max-width: 420px; margin: 0 auto; }
    .eyebrow {
      font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
      color: var(--accent); margin-bottom: .55rem;
    }
    h1 { font-size: 1.55rem; letter-spacing: -.03em; line-height: 1.2; margin-bottom: .65rem; }
    .lede { color: var(--muted); font-size: .95rem; margin-bottom: 1.15rem; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1rem 1.05rem;
      margin-bottom: 1rem;
    }
    .card h2 { font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .55rem; color: var(--muted); }
    ul { padding-left: 1.1rem; color: var(--text); font-size: .92rem; }
    li + li { margin-top: .35rem; }
    .price { font-size: 1.35rem; font-weight: 700; letter-spacing: -.02em; margin: .15rem 0 .35rem; }
    .actions { display: flex; flex-direction: column; gap: .55rem; margin: 1.1rem 0 1.25rem; }
    a.btn, button.btn {
      display: block; width: 100%; text-align: center; text-decoration: none;
      border: 0; border-radius: 12px; padding: .85rem 1rem; font-weight: 700; font-size: .95rem;
      cursor: pointer; font-family: inherit;
    }
    .btn-primary { background: var(--accent); color: var(--accent-text); }
    .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--line); }
    label { display: block; font-size: .78rem; font-weight: 650; margin-bottom: .4rem; }
    input[type="text"], input[type="email"] {
      width: 100%; border-radius: 10px; border: 1px solid var(--line);
      background: var(--bg); color: var(--text); padding: .7rem .75rem; font-size: 1rem;
    }
    .checkout-email-form { display: flex; flex-direction: column; gap: .45rem; }
    .checkout-email-hint { font-size: .78rem; color: var(--muted); margin: 0; }
    .row { display: flex; gap: .5rem; margin-top: .55rem; }
    .row input { flex: 1; }
    .row .btn { width: auto; padding: .7rem .9rem; }
    .links { display: flex; flex-wrap: wrap; gap: .65rem 1rem; font-size: .85rem; margin: .25rem 0 1.1rem; }
    .links a { color: var(--accent); }
    footer { color: var(--muted); font-size: .75rem; }
    footer p + p { margin-top: .4rem; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">AuthiChain · StrainChain</p>
    <h1>Genetics passport in one checkout.</h1>
    <p class="lede">Publish one cultivar from the CoAs you already have. Totals are recomputed from the lab panel at render time — never transcribed.</p>

    <section class="card">
      <h2>Passport</h2>
      <p class="price">$49</p>
      <ul>
        <li>One published passport, one cultivar</li>
        <li>Full cannabinoid and terpene panel from your certificates</li>
        <li>QR code and shareable link</li>
      </ul>
    </section>

    <div class="actions">
      <form class="checkout-email-form" id="checkout-form" action="${PASSPORT_CHECKOUT_URL}" method="post">
        <label for="checkout-email">Work email
          <input id="checkout-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com">
        </label>
        <p class="checkout-email-hint">We use this for your receipt and to follow up if checkout doesn't finish. No newsletter.</p>
        <button class="btn btn-primary" id="checkout" type="submit">Publish Passport — $49</button>
      </form>
      ${catalogPaymentLinkHtml({
        planId: "strainchain_passport",
        label: "Pay $49 on Stripe",
        className: "btn btn-ghost",
      })}
      <a class="btn btn-ghost" id="pricing" href="https://authichain.govchain.us/pricing">View pricing</a>
    </div>

    <section class="card">
      <h2>Optional TruMark verify</h2>
      <p class="lede" style="margin-bottom:.65rem">Already have a seal or certificate id? Open the live verify page. No account and no phone call.</p>
      <form id="verify-form" action="https://authichain.govchain.us/verify" method="get">
        <label for="verify-id">TruMark or product ID</label>
        <div class="row">
          <input id="verify-id" name="id" type="text" inputmode="text" autocomplete="off" placeholder="TM-… or certificate id">
          <button class="btn btn-ghost" type="submit">Verify</button>
        </div>
      </form>
    </section>

    <nav class="links" aria-label="Related pages">
      <a href="https://authichain.govchain.us/passport">Passport page</a>
      <a href="https://authichain.govchain.us/genetics">Genetics library</a>
      <a href="https://authichain.govchain.us/trumark">TruMark</a>
    </nav>

    <footer>
      <p>AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN.</p>
      <p>Self-serve checkout or a written packet — no scheduled calls.</p>
    </footer>
  </main>
  <script>
    (function () {
      var CHECKOUT = ${JSON.stringify(PASSPORT_CHECKOUT_URL)};
      var VERIFY = "https://authichain.govchain.us/verify";
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg) {
        try { tg.ready(); tg.expand(); } catch (e) {}
        if (tg.MainButton) {
          tg.MainButton.setText("Publish Passport — $49");
          tg.MainButton.show();
          tg.MainButton.onClick(function () { openCheckout(); });
        }
      }
      function openExternal(url) {
        if (tg && typeof tg.openLink === "function") {
          tg.openLink(url);
          return;
        }
        window.location.href = url;
      }
      function looksLikeEmail(value) {
        var email = String(value || "").trim();
        return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }
      function checkoutUrlWithEmail() {
        var input = document.getElementById("checkout-email");
        var email = input ? String(input.value || "").trim() : "";
        if (!looksLikeEmail(email)) return "";
        return CHECKOUT + (CHECKOUT.indexOf("?") >= 0 ? "&" : "?") + "email=" + encodeURIComponent(email);
      }
      function openCheckout() {
        var url = checkoutUrlWithEmail();
        if (!url) {
          var input = document.getElementById("checkout-email");
          if (input && typeof input.focus === "function") input.focus();
          return;
        }
        openExternal(url);
      }
      var form = document.getElementById("checkout-form");
      if (form) {
        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          openCheckout();
        });
      }
      var form = document.getElementById("verify-form");
      if (form) {
        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var raw = (document.getElementById("verify-id") || {}).value || "";
          var id = String(raw).trim();
          var url = id ? VERIFY + "/" + encodeURIComponent(id) : VERIFY;
          if (tg && typeof tg.openLink === "function") {
            tg.openLink(url);
          } else {
            window.location.href = url;
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}

export function tryHandleTelegramMiniApp(request: Request): Response | null {
  const pathname = new URL(request.url).pathname;
  if (!isTelegramMiniAppPath(pathname)) return null;
  return new Response(renderTelegramMiniApp(), { headers: MINIAPP_HEADERS });
}
