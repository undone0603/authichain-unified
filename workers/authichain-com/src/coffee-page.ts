/**
 * /coffee — AuthiChain Proof-of-Support (human 1-tap fiat + agent x402).
 *
 * GET  Accept: text/html → on-brand HTML
 * GET  Accept: application/json | ?rail=x402 → HTTP 402 Base USDC
 *   challenge (eip155:8453). Automated x402 facilitator settlement / JWS
 *   minting is not wired on /coffee yet.
 * POST /coffee or /api/coffee/checkout → Stripe Checkout or Payment Link
 * GET  /coffee/jwks.json, /coffee/sample-receipt.json
 *
 * "Thanks for the coffee" hero/CTA flips ONLY after a verified paid Stripe
 * session (payment_status === "paid", status === "complete",
 * metadata.kind === "coffee_support") — never on a bare ?thanks=1.
 * Live JWS minting requires COFFEE_RECEIPT_PRIVATE_JWK; unset still thanks.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing";
import {
  BUY_ANOTHER_COPY,
  BUY_HEADING,
  COFFEE_CANONICAL,
  COFFEE_CHECKOUT_PATH,
  COFFEE_JWKS_PATH,
  COFFEE_PATH,
  COFFEE_PAYMENT_LINK_ID,
  COFFEE_PRESETS,
  COFFEE_SAMPLE_RECEIPT_PATH,
  COFFEE_THANKS_STORAGE_KEY,
  COFFEE_UNIT_CENTS,
  FREE_PREVIEW_V1,
  HANDLE_MAX,
  MAX_SUPPORT_CENTS,
  MESSAGE_MAX,
  MIN_SUPPORT_CENTS,
  NON_TAX_DEDUCTIBLE_DISCLOSURE,
  RECEIPT_KEY_UNBOUND_COPY,
  THANKS_BADGE,
  THANKS_COPY,
  buildSampleCoffeeReceipt,
  buildX402SupportChallenge,
  coffeeCheckoutResponse,
  coffeeJwksForEnv,
  isCoffeePaidSession,
  isStripeCheckoutSessionId,
  mintProofOfCoffeeReceipt,
  negotiateSupportRail,
  parseCoffeeReceiptPrivateJwk,
  parseCoffeeThanksCookie,
  resolveCoffeePageMode,
  retrieveCoffeeCheckoutSession,
  serializeCoffeeThanksCookie,
  type CoffeeEnv,
  type CoffeePageMode,
  type ProofOfCoffeeRecord,
} from "../../../src/lib/support-coffee";
import { X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402";

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
};

const SAMPLE_CORS = { "Access-Control-Allow-Origin": "*" } as const;

const HTML_PATHS = new Set([COFFEE_PATH, `${COFFEE_PATH}/`]);
const CHECKOUT_PATHS = new Set([
  COFFEE_CHECKOUT_PATH,
  `${COFFEE_CHECKOUT_PATH}/`,
  COFFEE_PATH,
  `${COFFEE_PATH}/`,
]);
const ARTIFACT_PATHS = new Set([
  COFFEE_JWKS_PATH,
  `${COFFEE_JWKS_PATH}/`,
  COFFEE_SAMPLE_RECEIPT_PATH,
  `${COFFEE_SAMPLE_RECEIPT_PATH}/`,
]);

export function isCoffeeHtmlPath(pathname: string): boolean {
  return HTML_PATHS.has(pathname);
}

export function isCoffeeCheckoutPath(pathname: string): boolean {
  return (
    pathname === COFFEE_CHECKOUT_PATH || pathname === `${COFFEE_CHECKOUT_PATH}/`
  );
}

export function isCoffeePath(pathname: string): boolean {
  return (
    HTML_PATHS.has(pathname) ||
    ARTIFACT_PATHS.has(pathname) ||
    isCoffeeCheckoutPath(pathname)
  );
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

function coffeeFooter(): string {
  return estateFooter(
    "authichain",
    [
      {
        heading: "Start",
        links: [
          { href: "/coffee", label: "Proof-of-Support" },
          { href: "/pricing", label: "Pricing" },
          { href: "/x402", label: "x402" },
        ],
      },
      {
        heading: "Verify",
        links: [
          { href: "/battery-passport/sample", label: "Sample passport" },
          { href: COFFEE_JWKS_PATH, label: "Coffee JWKS" },
          { href: COFFEE_SAMPLE_RECEIPT_PATH, label: "Sample receipt" },
        ],
      },
      {
        heading: "Company",
        links: [
          { href: "/contact", label: "Written packet" },
          { href: "/privacy", label: "Privacy" },
        ],
      },
    ],
    "AuthiChain is an operating brand of Zachary Kietzman, sole proprietor. Tips are commercial support — not a charity and not tax-deductible.",
    "The authentic agentic economy.",
    NON_TAX_DEDUCTIBLE_DISCLOSURE
  );
}

const THANKS_WIDGET_SCRIPT = `(function(){
  var KEY=${JSON.stringify(COFFEE_THANKS_STORAGE_KEY)};
  var params=new URLSearchParams(location.search||"");
  if(params.get("session_id"))return;
  var root=document.querySelector("[data-coffee-state]");
  if(!root||root.getAttribute("data-coffee-state")!=="buy")return;
  function flag(){
    try{
      var raw=localStorage.getItem(KEY);
      if(raw){
        var o=JSON.parse(raw);
        if(o&&typeof o.receiptId==="string"&&/^poc_[a-zA-Z0-9]+$/.test(o.receiptId))return o;
      }
    }catch(e){}
    var m=document.cookie.match(/(?:^|; )ac_coffee_thanks=([^;]*)/);
    if(!m)return null;
    var p=decodeURIComponent(m[1]).split("|");
    if(p[0]&&/^poc_[a-zA-Z0-9]+$/.test(p[0]))return {receiptId:p[0],ts:Number(p[1]||0)};
    return null;
  }
  var f=flag();
  if(!f)return;
  root.setAttribute("data-coffee-state","returning_thanks");
  var heading=document.getElementById("coffee-heading");
  var badge=document.getElementById("coffee-badge");
  var nav=document.getElementById("coffee-nav-cta");
  if(heading)heading.textContent=${JSON.stringify(THANKS_BADGE)};
  if(badge)badge.textContent=${JSON.stringify(THANKS_BADGE)};
  if(nav)nav.textContent=${JSON.stringify(THANKS_BADGE)};
  var another=document.getElementById("buy-another");
  if(another)another.hidden=false;
})();`;

const COFFEE_THANKS_COOKIE_PREFIX = "ac_coffee_thanks=";

function persistThanksScript(receiptId: string, ts: number): string {
  return `(function(){
  var KEY=${JSON.stringify(COFFEE_THANKS_STORAGE_KEY)};
  var payload=${JSON.stringify({ v: 1, receiptId, ts })};
  try{localStorage.setItem(KEY,JSON.stringify(payload));}catch(e){}
  var secure=location.protocol==="https:"?"; Secure":"";
  document.cookie=${JSON.stringify(COFFEE_THANKS_COOKIE_PREFIX)}+encodeURIComponent(payload.receiptId+"|"+payload.ts)+"; Path=/; Max-Age=31536000; SameSite=Lax"+secure;
})();`;
}

export type CoffeePageView = {
  mode: CoffeePageMode;
  receipt?: {
    record: ProofOfCoffeeRecord;
    jws: string;
    sampleSigner: boolean;
    kid: string;
  };
  receiptUnbound?: boolean;
  thanksFlag?: { receiptId: string; ts: number };
};

function presetButtons(): string {
  return COFFEE_PRESETS.map(u => {
    const dollars = (u * COFFEE_UNIT_CENTS) / 100;
    return `<button type="submit" name="units" value="${u}" class="btn btn-primary coffee-preset">${u}× coffee — $${dollars}</button>`;
  }).join("");
}

export function renderCoffeePage(
  view: CoffeePageView = { mode: "buy" }
): string {
  const paid = view.mode === "paid_thanks";
  const returning = view.mode === "returning_thanks";
  const thanks = paid || returning;
  const heading = paid ? THANKS_COPY : returning ? THANKS_BADGE : BUY_HEADING;
  const badge = thanks ? THANKS_BADGE : "Proof-of-Support";
  const navCta = thanks ? THANKS_BADGE : "Buy AuthiChain a coffee";
  const title = thanks
    ? `${THANKS_COPY} | AuthiChain ${FREE_PREVIEW_V1}`
    : `Buy AuthiChain a coffee | AuthiChain ${FREE_PREVIEW_V1}`;
  const description = thanks
    ? "Thanks for the coffee. Voluntary commercial support for AuthiChain software development. Not a charitable donation and not tax-deductible."
    : "Buy AuthiChain a coffee. Voluntary commercial support for AuthiChain software development. Not a charitable donation and not tax-deductible; confers no equity, tokens, credits, or SLA.";
  const min = (MIN_SUPPORT_CENTS / 100).toFixed(2);
  const max = (MAX_SUPPORT_CENTS / 100).toFixed(0);
  const receiptBlock =
    paid && view.receipt
      ? `<section class="estate-section" id="receipt">
  <div class="wrap">
    <h2>Proof-of-Coffee receipt</h2>
    <p class="section-sub">${view.receipt.sampleSigner ? "Signed by the bundled demonstration Ed25519 key — not the live passport issuer. " : ""}Offline-verifiable Ed25519 JWS. Zero equity, tokens, credits, SLA, or tax-deductible promises.</p>
    <p class="coffee-kid">kid <code>${esc(view.receipt.kid)}</code> · receipt <code>${esc(view.receipt.record.receiptId)}</code> · ${esc(view.receipt.record.amount.display)}</p>
    <label class="coffee-jws-label" for="coffee-jws">JWS
      <textarea id="coffee-jws" class="coffee-jws" readonly rows="6">${esc(view.receipt.jws)}</textarea>
    </label>
    <div class="estate-actions">
      <button type="button" class="btn btn-outline" id="copy-jws">Copy receipt</button>
      <a class="btn btn-outline" href="${COFFEE_JWKS_PATH}">JWKS</a>
    </div>
  </div>
</section>
<script>
(function(){
  var btn=document.getElementById("copy-jws");
  var box=document.getElementById("coffee-jws");
  if(!btn||!box||!navigator.clipboard)return;
  btn.addEventListener("click",function(){
    navigator.clipboard.writeText(box.value).then(function(){btn.textContent="Copied";});
  });
})();
</script>`
      : paid && view.receiptUnbound
        ? `<section class="estate-section" id="receipt">
  <div class="wrap">
    <h2>Payment verified</h2>
    <p class="section-sub" id="receipt-unbound">${esc(RECEIPT_KEY_UNBOUND_COPY)}</p>
  </div>
</section>`
        : "";
  const persist =
    paid && view.thanksFlag
      ? `<script>${persistThanksScript(view.thanksFlag.receiptId, view.thanksFlag.ts)}</script>`
      : "";
  const buyAnotherHidden = thanks ? "" : " hidden";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: heading,
    url: COFFEE_CANONICAL,
    description,
    isPartOf: { "@type": "WebSite", url: "https://authichain.com" },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="authichain:preview" content="${FREE_PREVIEW_V1}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${COFFEE_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${COFFEE_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta property="og:site_name" content="AuthiChain ${FREE_PREVIEW_V1}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .coffee-presets { display:grid; gap:12px; grid-template-columns:1fr; margin:1rem 0; }
    @media (min-width:640px){ .coffee-presets { grid-template-columns:repeat(3,1fr); } }
    .coffee-form label { display:block; margin-top:1rem; font-size:.92rem; font-weight:600; }
    .coffee-form input, .coffee-form textarea { width:100%; box-sizing:border-box; margin-top:.35rem; padding:.65rem .75rem; border:1px solid var(--border); border-radius:.6rem; font:inherit; }
    .coffee-notice { margin-top:1.5rem; padding:1rem 1.1rem; border:1px solid var(--border); border-radius:.75rem; background:var(--bg2); font-size:.9rem; }
    .coffee-jws { width:100%; box-sizing:border-box; font-family:ui-monospace,monospace; font-size:.78rem; padding:.75rem; border:1px solid var(--border); border-radius:.6rem; }
    .coffee-kid { font-size:.88rem; color:var(--text-dim); }
    .coffee-agent { font-size:.9rem; color:var(--text-dim); }
  </style>
</head>
<body data-coffee-state="${view.mode}">
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: "/coffee", label: "Coffee" },
      { href: "/pricing", label: "Pricing" },
      { href: "/x402", label: "x402" },
    ],
    { href: "#support", label: navCta }
  ).replace(
    /<a class="btn btn-primary btn-sm" href="#support">[^<]+<\/a>/,
    `<a class="btn btn-primary btn-sm" id="coffee-nav-cta" href="#support">${esc(navCta)}</a>`
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge" id="coffee-badge">${esc(badge)}</p>
      <p class="section-tag">${FREE_PREVIEW_V1}</p>
      <h1 id="coffee-heading">${esc(heading)}</h1>
      <p class="estate-lede hero-sub">${
        thanks
          ? "Zero platform cut. Apple Pay, Google Pay, Link, and cards on Stripe Checkout. Agents can request a Base USDC HTTP 402 challenge on the same URL; Ed25519 receipts currently mint after verified Stripe payment."
          : "Zero platform cut. 1× is $5. Apple Pay, Google Pay, Link, and cards welcome. Agents can request a Base USDC HTTP 402 challenge on the same URL."
      }</p>
      <div class="estate-actions hero-cta">
        <a class="btn btn-outline" id="buy-another" href="#support"${buyAnotherHidden}>${esc(BUY_ANOTHER_COPY)}</a>
      </div>
    </div>
  </header>

  ${receiptBlock}

  <section class="estate-section" id="support">
    <div class="wrap">
      <h2>${thanks ? esc(BUY_ANOTHER_COPY) : "Pick a coffee"}</h2>
      <p class="section-sub">Presets are $5 units. Custom amounts are bounded at $${min}–$${max} so $0.50 card-testing cannot land.</p>
      <form class="coffee-form" method="POST" action="${COFFEE_PATH}">
        <div class="coffee-presets">
          ${presetButtons()}
        </div>
        <label>Custom amount (USD, $${min}–$${max})
          <input type="number" name="customUsd" min="${min}" max="${max}" step="0.01" placeholder="12.00">
        </label>
        <button type="submit" class="btn btn-outline" style="margin-top:12px">Support with custom amount</button>
        <label>Public handle (optional, ≤${HANDLE_MAX} chars)
          <input type="text" name="handle" maxlength="${HANDLE_MAX}" placeholder="@you" autocomplete="nickname">
        </label>
        <label>Short message (optional, ≤${MESSAGE_MAX} chars, URLs stripped)
          <textarea name="message" maxlength="${MESSAGE_MAX}" rows="3" placeholder="Keep shipping signed receipts."></textarea>
        </label>
      </form>
      <div class="coffee-notice" role="note">
        <strong>Not a charity donation.</strong> ${esc(NON_TAX_DEDUCTIBLE_DISCLOSURE)}
        Optional <code>supporter_handle</code> and <code>supporter_message</code> are stored in Stripe Checkout / PaymentIntent metadata (<code>acct_1SXIyEGqTruSqV8T</code>). When falling back to the standalone Stripe Payment Link (<code>${COFFEE_PAYMENT_LINK_ID}</code>), Stripe shows its hosted confirmation receipt on <code>buy.stripe.com</code>; on-page Checkout returns to <code>/coffee?thanks=1&amp;session_id=…</code> for the Thanks for the coffee state and Ed25519 receipt.
      </div>
      <p class="coffee-agent">
        Agents: <code>Accept: application/json</code> or <code>?rail=x402</code> returns HTTP 402 with a Base USDC (<code>eip155:8453</code>) requirement to <code>${X402_PUBLISHED_PAY_TO}</code> (default 1× = $5).
        Ed25519 <em>Proof-of-Coffee</em> receipts and the Thanks for the coffee state currently mint on verified Stripe Checkout completion — automated x402 facilitator settlement is not wired on <code>/coffee</code> yet.
      </p>
    </div>
  </section>
</main>
  ${coffeeFooter()}
  <script>${THANKS_WIDGET_SCRIPT}</script>
  ${persist}
</body>
</html>`;
}

async function coffeeThanksView(
  request: Request,
  env: CoffeeEnv,
  fetchImpl: typeof fetch
): Promise<{ view: CoffeePageView; setCookie?: string }> {
  const url = new URL(request.url);
  const thanksQuery = url.searchParams.get("thanks") === "1";
  const sessionId = (url.searchParams.get("session_id") || "").trim();
  const cookieFlag = parseCoffeeThanksCookie(request.headers.get("cookie"));
  let paidSession = false;
  let stripeSession: Awaited<ReturnType<typeof retrieveCoffeeCheckoutSession>> =
    null;

  if (sessionId && isStripeCheckoutSessionId(sessionId)) {
    const key = (env.STRIPE_SECRET_KEY || "").trim();
    if (key) {
      stripeSession = await retrieveCoffeeCheckoutSession(
        key,
        sessionId,
        fetchImpl
      );
      paidSession = Boolean(
        stripeSession && isCoffeePaidSession(stripeSession)
      );
    }
  }

  const mode = resolveCoffeePageMode({
    thanksQuery,
    sessionId,
    paidSession,
    cookieFlag,
  });

  if (mode !== "paid_thanks" || !stripeSession) {
    return { view: { mode, thanksFlag: cookieFlag || undefined } };
  }

  const unboundFlag = {
    receiptId: `poc_${crypto.randomUUID().replace(/-/g, "")}`,
    ts: Date.now(),
  };
  const cents = Number(
    stripeSession.metadata?.amount_cents || stripeSession.amount_total || 0
  );
  const bound = parseCoffeeReceiptPrivateJwk(env.COFFEE_RECEIPT_PRIVATE_JWK);
  if (!bound) {
    return {
      view: {
        mode: "paid_thanks",
        receiptUnbound: true,
        thanksFlag: unboundFlag,
      },
      setCookie: serializeCoffeeThanksCookie(unboundFlag),
    };
  }
  try {
    const minted = await mintProofOfCoffeeReceipt(
      {
        rail: "fiat",
        paymentStatus: "paid",
        amountCents: cents,
        handle: stripeSession.metadata?.supporter_handle,
        message: stripeSession.metadata?.supporter_message,
        paymentReference: stripeSession.id || sessionId,
        privateJwk: bound,
      },
      bound
    );
    const flag = {
      receiptId: minted.record.receiptId,
      ts: Date.parse(minted.record.issuedAt) || Date.now(),
    };
    return {
      view: {
        mode: "paid_thanks",
        receipt: {
          record: minted.record,
          jws: minted.jws,
          sampleSigner: minted.sampleSigner,
          kid: minted.verification.kid,
        },
        thanksFlag: flag,
      },
      setCookie: serializeCoffeeThanksCookie(flag),
    };
  } catch {
    return {
      view: {
        mode: "paid_thanks",
        receiptUnbound: true,
        thanksFlag: unboundFlag,
      },
      setCookie: serializeCoffeeThanksCookie(unboundFlag),
    };
  }
}

function jsonResponse(
  body: unknown,
  method: string,
  extra: Record<string, string> = {}
): Response {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    ...SAMPLE_CORS,
    Allow: "GET, HEAD",
    ...extra,
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(body), { status: 200, headers });
}

export async function tryHandleCoffee(
  request: Request,
  env: CoffeeEnv = {},
  fetchImpl: typeof fetch = fetch
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!isCoffeePath(pathname) && !CHECKOUT_PATHS.has(pathname)) return null;

  if (isCoffeeCheckoutPath(pathname)) {
    return coffeeCheckoutResponse(request, env, fetchImpl);
  }

  if (ARTIFACT_PATHS.has(pathname)) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Allow: "GET, HEAD",
        },
      });
    }
    const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    if (path === COFFEE_JWKS_PATH) {
      const jwks = coffeeJwksForEnv(env);
      return jsonResponse(
        {
          keys: jwks.keys,
          liveBound: jwks.liveBound,
          note: jwks.liveBound
            ? "Proof-of-Coffee verifying keys. The sample kid verifies /coffee/sample-receipt.json only."
            : "Live signing key not bound on this node. The sample kid verifies /coffee/sample-receipt.json only. Paid Stripe returns flip Thanks for the coffee without minting a live JWS.",
        },
        request.method
      );
    }
    return jsonResponse(buildSampleCoffeeReceipt(), request.method);
  }

  if (!HTML_PATHS.has(pathname)) return null;

  if (request.method === "POST") {
    return coffeeCheckoutResponse(request, env, fetchImpl);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: "GET, HEAD, POST",
      },
    });
  }

  const rail = negotiateSupportRail({
    accept: request.headers.get("accept"),
    rail: url.searchParams.get("rail"),
  });
  if (rail === "x402") {
    const challenge = buildX402SupportChallenge({
      units: url.searchParams.get("units") || undefined,
      amount_cents: url.searchParams.get("amount_cents") || undefined,
      customUsd: url.searchParams.get("customUsd") || undefined,
      origin: "https://authichain.com",
      resource: COFFEE_CANONICAL,
      payTo: X402_PUBLISHED_PAY_TO,
    });
    if (!challenge.ok) {
      return new Response(JSON.stringify({ error: challenge.error }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    const headers = { ...challenge.headers };
    if (request.method === "HEAD") {
      return new Response(null, { status: 402, headers });
    }
    return new Response(JSON.stringify(challenge.body), {
      status: 402,
      headers,
    });
  }

  const { view, setCookie } = await coffeeThanksView(request, env, fetchImpl);
  const headers: Record<string, string> = {
    ...HTML_SECURITY_HEADERS,
    "Content-Type": "text/html; charset=utf-8",
  };
  if (setCookie) {
    headers["Set-Cookie"] = setCookie;
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(renderCoffeePage(view), { status: 200, headers });
}
