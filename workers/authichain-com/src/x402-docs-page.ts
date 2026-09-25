/**
 * Public x402 agent-pay docs at /x402 (and /docs/x402).
 *
 * The live rail is already bound on authichain-com. This page is discovery
 * only — published payTo / asset / price, health URL, and unpaid 402 curls.
 * No facilitator URL, no private keys, no settle steps.
 *
 * payTo is the owner-authorized treasury / tokenomics EOA
 * (X402_PUBLISHED_PAY_TO = 0xaebf…e437), not the $QRON holder EOA
 * (0x5db5…), not the NFT deployer, and not the Coinbase Smart Wallet.
 * Asset is Circle USDC on Base — not $QRON. Map:
 * docs/strategy/WEB3_IDENTITY.md. Do not rebind away from that treasury.
 *
 * Visual system (interim): light-enterprise chrome + a dark Web3-adjacent
 * rail/code surface. Markup is semantic and uses Tailwind-shaped utilities
 * bound to `--ac-*` tokens so a later Wonder export can restyle without
 * rewriting the document.
 *
 * TODO(wonder): Final visual tokens come from Wonder artboards once the
 * owner opens the Wonder editor (account undone.k@gmail.com). Map exported
 * cssVars onto X402_TOKEN_CSS. Do not invent a second palette here. $0 path:
 * no Tailwind CDN, no paid fonts, no Workers Paid.
 */

import { ESTATE_FONTS_LINK } from "../../_shared/estate-landing";
import {
  CHECKOUT_EMAIL_FORM_CSS,
  catalogPaymentLinkHtml,
  checkoutEmailFormHtml,
} from "../../../src/lib/checkout-email";
import { planUsd } from "../../../src/lib/plans";
import { BASE_USDC_ASSET, X402_PUBLISHED_PAY_TO } from "../../../src/lib/x402";

export const X402_DOCS_PATHS = [
  "/x402",
  "/x402/",
  "/docs/x402",
  "/docs/x402/",
] as const;

export const X402_PUBLIC = {
  canonicalPath: "/x402",
  canonicalUrl: "https://authichain.com/x402",
  healthUrl: "https://authichain.com/api/x402/health",
  catalogUrl: "https://authichain.com/api/x402/catalog",
  wellKnownUrl: "https://authichain.com/.well-known/x402.json",
  fanoutUrl: "https://authichain.com/.well-known/x402",
  openApiUrl: "https://authichain.com/openapi.json",
  payUrl: "https://authichain.com/api/x402",
  verifyUrl: "https://authichain.com/api/v1/agent-verify",
  identityUrl:
    "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md",
  tokenomicsUrl:
    "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/AGENT_TOKENOMICS_x402.md",
  priceUsd: "$0.05",
  priceUsdNumber: "0.05",
  network: "Base",
  chainId: "8453",
  /** payTo / tokenomics EOA — not the NFT deployer. Do not rebind. */
  payTo: X402_PUBLISHED_PAY_TO,
  /** Circle USDC on Base. Not $QRON. */
  asset: BASE_USDC_ASSET,
  assetName: "Circle USDC",
  dailyCapUsd: "$10",
  legalEntity: "ZACHARY KIETZMAN",
} as const;

export function isX402DocsPath(pathname: string): boolean {
  return (X402_DOCS_PATHS as readonly string[]).includes(pathname);
}

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[<>&"']/g,
    c =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

/**
 * Interim token sheet. Values match estate light-enterprise (`#4F46E5` on
 * white, Plus Jakarta Sans) plus a mineral-dark ledger for the paid rail.
 *
 * TODO(wonder): Replace this block from Wonder artboard exports. Prefer
 * `var(--wonder-…)` aliases that point at these slots — do not flatten
 * Wonder tokens to new hex literals in the markup.
 */
const X402_TOKEN_CSS = `:root {
  --ac-bg: #ffffff;
  --ac-bg-muted: #f8fafc;
  --ac-ink: #0f172a;
  --ac-muted: #475569;
  --ac-faint: #64748b;
  --ac-border: #e2e8f0;
  --ac-accent: #4F46E5;
  --ac-accent-ink: #ffffff;
  --ac-accent-soft: #eef2ff;
  --ac-rail: #0b1220;
  --ac-rail-ink: #e2e8f0;
  --ac-rail-muted: #94a3b8;
  --ac-rail-line: rgba(226,232,240,.12);
  --ac-radius: 10px;
  --ac-shadow: 0 1px 2px rgba(79,70,229,.06), 0 16px 40px rgba(79,70,229,.10);
  --ac-display: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --ac-body: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --ac-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --ac-measure: 40rem;
  --ac-page: 68rem;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--ac-bg);color:var(--ac-ink);font-family:var(--ac-body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--ac-accent);text-decoration:none;text-underline-offset:2px}
a:hover{text-decoration:underline}
a:focus-visible{outline:2px solid var(--ac-accent);outline-offset:3px}
.skip{position:absolute;left:12px;top:-48px;z-index:20;background:var(--ac-ink);color:#fff;padding:8px 12px;border-radius:6px}
.skip:focus{top:12px}
.shell{min-height:100vh;display:flex;flex-direction:column}
.wrap{width:min(var(--ac-page),calc(100% - 2rem));margin:0 auto}
.nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--ac-border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:0.9rem 0}
.brand{font-family:var(--ac-display);font-weight:600;font-size:1.1rem;letter-spacing:-.02em;color:var(--ac-ink);text-decoration:none}
.brand:hover{text-decoration:none;color:var(--ac-ink)}
.brand span{color:var(--ac-accent)}
.nav-links{display:flex;gap:1.15rem;list-style:none;font-size:.92rem;font-weight:500}
.nav-links a{color:var(--ac-muted)}
.nav-links a:hover{color:var(--ac-ink);text-decoration:none}
.hero{padding:4.5rem 0 3rem;background:var(--ac-bg)}
.kicker{display:inline-flex;align-items:center;gap:.45rem;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-accent);margin-bottom:1.1rem}
.kicker i{width:.45rem;height:.45rem;border-radius:999px;background:var(--ac-accent);display:inline-block}
h1{font-family:var(--ac-display);font-size:clamp(2rem,4.5vw,3.15rem);line-height:1.15;letter-spacing:-.03em;font-weight:600;max-width:18ch;margin-bottom:1.15rem}
.lede{font-size:1.125rem;color:var(--ac-muted);max-width:var(--ac-measure);margin-bottom:1rem}
.hero p{color:var(--ac-muted);max-width:var(--ac-measure);margin-bottom:1rem}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.75rem}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:.75rem 1.15rem;border-radius:8px;font-weight:600;font-size:.95rem;border:1px solid var(--ac-border);color:var(--ac-ink);background:var(--ac-bg);text-decoration:none}
.btn:hover{text-decoration:none;border-color:var(--ac-accent);color:var(--ac-accent)}
.btn-primary{background:var(--ac-accent);color:var(--ac-accent-ink);border-color:var(--ac-accent)}
.btn-primary:hover{color:var(--ac-accent-ink);opacity:.92}
.panel-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:1.25rem;padding:0 0 3rem}
@media (max-width:880px){.panel-grid{grid-template-columns:1fr}}
.card{background:var(--ac-bg);border:1px solid var(--ac-border);border-radius:var(--ac-radius);box-shadow:var(--ac-shadow);padding:1.5rem 1.6rem}
.card h2{font-family:var(--ac-display);font-size:1.2rem;letter-spacing:-.02em;margin-bottom:.6rem}
.card p,.card li{color:var(--ac-muted);font-size:.95rem}
.card p{margin-bottom:.85rem}
.rail{background:var(--ac-rail);color:var(--ac-rail-ink);border:1px solid #111827;box-shadow:none}
.rail h2,.rail dt{color:#fff}
.rail p,.rail dd{color:var(--ac-rail-muted)}
.rail a{color:#5eead4}
.spec{display:grid;grid-template-columns:8.5rem 1fr;gap:.55rem .85rem;margin-top:1rem}
@media (max-width:640px){.spec{grid-template-columns:1fr}}
.spec dt{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding-top:.35rem}
.spec dd{font-size:.92rem;word-break:break-all}
.mono{font-family:var(--ac-mono);font-size:.84rem}
.flow ol{margin:0 0 0 1.1rem}
.flow li{margin-bottom:.65rem}
code{font-family:var(--ac-mono);font-size:.84rem;background:var(--ac-bg-muted);border:1px solid var(--ac-border);border-radius:6px;padding:.08rem .4rem}
.rail code{background:#111827;border-color:var(--ac-rail-line);color:var(--ac-rail-ink)}
.examples{padding:0 0 3rem}
.examples h2{font-family:var(--ac-display);font-size:1.2rem;letter-spacing:-.02em;margin-bottom:1rem}
.examples-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}
@media (max-width:880px){.examples-grid{grid-template-columns:1fr}}
figure{background:var(--ac-rail);color:var(--ac-rail-ink);border-radius:var(--ac-radius);padding:1.35rem 1.4rem}
figcaption{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-rail-muted);margin-bottom:.7rem}
pre{overflow-x:auto;font-family:var(--ac-mono);font-size:.84rem;line-height:1.55;color:#f8fafc}
figure p{color:var(--ac-rail-muted);font-size:.88rem;margin-top:.85rem}
.note{border-left:3px solid var(--ac-accent);background:var(--ac-bg-muted);padding:1rem 1.15rem;color:var(--ac-muted);font-size:.92rem;margin:0 0 3.5rem;border-radius:0 var(--ac-radius) var(--ac-radius) 0}
footer.site{margin-top:auto;border-top:1px solid var(--ac-border);padding:1.75rem 0;color:var(--ac-faint);font-size:.85rem}
.foot-inner{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.75rem}`;

/** Renders the public x402 discovery page. */
export function renderX402DocsPage(): string {
  const p = X402_PUBLIC;
  const rows = [
    { label: "Price", value: `${p.priceUsd} USDC per call` },
    { label: "Network", value: `${p.network} (chain id ${p.chainId})` },
    {
      label: "Asset",
      value: `${p.assetName} ${p.asset}`,
      mono: true,
    },
    { label: "payTo", value: p.payTo, mono: true },
    { label: "Health", value: p.healthUrl, href: p.healthUrl, mono: true },
    { label: "Catalog", value: p.catalogUrl, href: p.catalogUrl, mono: true },
    {
      label: "Well-known",
      value: p.wellKnownUrl,
      href: p.wellKnownUrl,
      mono: true,
    },
    {
      label: "Fan-out",
      value: p.fanoutUrl,
      href: p.fanoutUrl,
      mono: true,
    },
    {
      label: "OpenAPI",
      value: p.openApiUrl,
      href: p.openApiUrl,
      mono: true,
    },
    { label: "Pay endpoint", value: p.payUrl, href: p.payUrl, mono: true },
    { label: "Alias", value: p.verifyUrl, mono: true },
    {
      label: "Facilitator",
      value: "PayAI, reachable (URL is not republished here)",
    },
    { label: "Daily cap", value: `${p.dailyCapUsd} per payer` },
  ];

  const spec = rows
    .map(row => {
      const inner = row.href
        ? `<a href="${esc(row.href)}">${esc(row.value)}</a>`
        : esc(row.value);
      return `<dt>${esc(row.label)}</dt><dd class="${row.mono ? "mono" : ""}">${inner}</dd>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>x402 agent pay — AuthiChain</title>
<meta name="description" content="AuthiChain x402 agent verification micropayments: ${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)}. Health at /api/x402/health. Unpaid POST returns HTTP 402.">
<link rel="canonical" href="${esc(p.canonicalUrl)}">
<link rel="alternate" type="application/json" href="${esc(p.catalogUrl)}" title="x402 catalog">
<link rel="describedby" href="${esc(p.wellKnownUrl)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#4F46E5">
<meta property="og:type" content="website">
<meta property="og:title" content="x402 agent pay — AuthiChain">
<meta property="og:description" content="${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)} per agent verification. Discover the live rail, then POST unpaid for a 402 challenge.">
<meta property="og:url" content="${esc(p.canonicalUrl)}">
<meta property="og:image" content="https://authichain.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: "AuthiChain x402 agent verification",
        description: `Pay-per-call product verification for autonomous agents. ${p.priceUsd} USDC on Base.`,
        url: p.canonicalUrl,
        identifier: p.catalogUrl,
      },
      {
        "@type": "Service",
        name: "AuthiChain agent verification",
        provider: {
          "@type": "Organization",
          name: "AuthiChain",
          legalName: p.legalEntity,
        },
        url: p.canonicalUrl,
        termsOfService: p.tokenomicsUrl,
        offers: {
          "@type": "Offer",
          name: "x402 verification call",
          price: p.priceUsdNumber,
          priceCurrency: "USD",
          description: `${p.priceUsd} ${p.assetName} on ${p.network} per POST /api/x402`,
          url: p.catalogUrl,
          availability: "https://schema.org/InStock",
        },
      },
    ],
  })}</script>
${ESTATE_FONTS_LINK}
<style>
${X402_TOKEN_CSS}
${CHECKOUT_EMAIL_FORM_CSS}
.checkout-email-form{margin:1rem 0}
.checkout-email-form button{background:var(--ac-accent,#4F46E5)}
</style>
</head>
<body class="shell">
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="/">Authi<span>Chain</span></a>
    <nav aria-label="Page">
      <ul class="nav-links">
        <li><a href="${esc(p.healthUrl)}">Health JSON</a></li>
        <li><a href="${esc(p.catalogUrl)}">Catalog</a></li>
        <li><a href="/authentic-agentic-economy">Agentic economy</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/dpp">DPP brief</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="main">
  <section class="hero" aria-labelledby="x402-title">
    <div class="wrap">
      <p class="kicker"><i aria-hidden="true"></i> Live · x402 · ${esc(p.priceUsd)} USDC</p>
      <h1 id="x402-title">Agent verification, paid per call.</h1>
      <p class="lede">AuthiChain exposes an <strong>x402</strong> micropayment rail so a funded agent can verify a product without a contract, an API key, or a human in the runtime loop.</p>
      <p>An unpaid <code>POST</code> receives <code>HTTP 402 Payment Required</code> with the exact scheme, asset, and receiving address. The agent settles ${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)}, retries with an <code>X-PAYMENT</code> proof, and the edge verifies settlement before answering.</p>
      <div class="cta">
        <a class="btn btn-primary" href="${esc(p.healthUrl)}">GET /api/x402/health</a>
        <a class="btn" href="${esc(p.catalogUrl)}">GET /api/x402/catalog</a>
        <a class="btn" href="/dpp">DPP checkout</a>
      </div>
    </div>
  </section>

  <div class="wrap panel-grid">
    <section class="card rail" aria-labelledby="rail-title">
      <h2 id="rail-title">Published rail</h2>
      <p>These values match the live health document. Treat <a href="${esc(p.healthUrl)}"><code>GET /api/x402/health</code></a> as the source of truth if anything here and the JSON ever disagree.</p>
      <dl class="spec">${spec}</dl>
    </section>
    <section class="card flow" aria-labelledby="flow-title">
      <h2 id="flow-title">Unpaid POST → 402</h2>
      <ol>
        <li>Agent <code>POST</code>s ${esc(p.payUrl)} (or the agent-verify alias) with a JSON body and no payment header.</li>
        <li>The edge answers <code>402</code> with <code>x402Version: 2</code> JSON (<code>resource</code> object, <code>accepts[].amount</code>, CAIP-2 <code>eip155:8453</code>, plus EIP-712 extra for Circle USDC) and the same envelope in the <code>PAYMENT-REQUIRED</code> header. Both declare <code>extensions.bazaar</code> and <code>accepts[0].outputSchema.input</code> (<code>type</code> + <code>method</code>) so discovery clients can catalog the skill. PayAI settle still uses the v1 requirement internally.</li>
        <li>The agent settles through a compatible x402 client, then retries the same POST with <code>X-PAYMENT</code> (v1) or <code>PAYMENT-SIGNATURE</code> (v2).</li>
        <li>A valid settlement returns <code>200</code> JSON. A missing or invalid proof returns another <code>402</code>.</li>
      </ol>
      <p>Do not send private keys to AuthiChain. Settlement happens in the agent’s wallet. This page only shows the unpaid challenge.</p>
    </section>
  </div>

  <section class="examples" aria-labelledby="examples-title">
    <div class="wrap">
      <h2 id="examples-title">Example curls</h2>
      <div class="examples-grid">
        <figure>
          <figcaption>curl — health</figcaption>
          <pre><code>curl -sS https://authichain.com/api/x402/health</code></pre>
          <p>Expect HTTP 200 with <code>"status":"ready"</code>, <code>"mode":"trustless"</code>, the payTo and Circle USDC addresses above, and <code>"pricePerCall":{"usd":0.05}</code>.</p>
        </figure>
        <figure>
          <figcaption>curl — unpaid challenge</figcaption>
          <pre><code>curl -sS -i -X POST https://authichain.com/api/x402 \\
  -H 'content-type: application/json' \\
  -d '{"sealId":"demo"}'</code></pre>
          <p>Expect HTTP 402. The body lists the asset, payTo, and EIP-712 extra. No wallet, key, or <code>X-PAYMENT</code> header is required for this probe.</p>
        </figure>
        <figure>
          <figcaption>curl — catalog</figcaption>
          <pre><code>curl -sS https://authichain.com/api/x402/catalog</code></pre>
          <p>Machine-readable paid endpoints, price, payTo, and health URL. Same numbers as health — not a second price list. Catalog also at <a href="${esc(p.wellKnownUrl)}"><code>/.well-known/x402.json</code></a>. x402scan fan-out is <a href="${esc(p.fanoutUrl)}"><code>/.well-known/x402</code></a>. OpenAPI with <code>x-payment-info</code> is <a href="${esc(p.openApiUrl)}"><code>/openapi.json</code></a>.</p>
        </figure>
        <figure>
          <figcaption>curl — settle retry (Agent A → AuthiChain)</figcaption>
          <pre><code>curl -sS -i -X POST https://authichain.com/api/x402 \\
  -H 'content-type: application/json' \\
  -H 'X-PAYMENT: &lt;base64-x402-payload&gt;' \\
  -d '{"sealId":"demo"}'</code></pre>
          <p>After an x402 client pays the 402 <code>accepts[]</code> requirement to the published payTo, retry the same POST with <code>X-PAYMENT</code>. Do not send private keys here. Facilitator URL is not republished on this page.</p>
        </figure>
      </div>
    </div>
  </section>

  <div class="wrap panel-grid">
    <section class="card" aria-labelledby="machine-title">
      <h2 id="machine-title">Machine-readable discovery</h2>
      <p>Agents should fetch JSON, not scrape this HTML. Health is the live rail; catalog lists paid methods and prices copied from that same report.</p>
      <dl class="spec">
        <dt>Catalog</dt><dd class="mono"><a href="${esc(p.catalogUrl)}">${esc(p.catalogUrl)}</a></dd>
        <dt>Well-known</dt><dd class="mono"><a href="${esc(p.wellKnownUrl)}">${esc(p.wellKnownUrl)}</a></dd>
        <dt>Fan-out</dt><dd class="mono"><a href="${esc(p.fanoutUrl)}">${esc(p.fanoutUrl)}</a></dd>
        <dt>OpenAPI</dt><dd class="mono"><a href="${esc(p.openApiUrl)}">${esc(p.openApiUrl)}</a></dd>
        <dt>Health</dt><dd class="mono"><a href="${esc(p.healthUrl)}">${esc(p.healthUrl)}</a></dd>
        <dt>Tokenomics</dt><dd class="mono"><a href="${esc(p.tokenomicsUrl)}">AGENT_TOKENOMICS_x402.md</a></dd>
        <dt>Wallets</dt><dd class="mono"><a href="${esc(p.identityUrl)}">WEB3_IDENTITY.md</a></dd>
      </dl>
    </section>
    <section class="card" aria-labelledby="human-title">
      <h2 id="human-title">Human checkout vs agent rail</h2>
      <p>Stripe is for people. x402 is for machines. They do not share a wallet, a SKU, or a receipt.</p>
      <ul>
        <li>StrainChain Passport — <strong>$${planUsd("strainchain_passport")}</strong> one-time. Enter a work email so Stripe can recover the cart.</li>
        <li>StrainChain Farm — <strong>$${planUsd("strainchain_farm")}</strong>/month. Unlimited cultivars; same Payment Link as /pricing.</li>
        <li>EU DPP Readiness — <strong>$${planUsd("dpp_readiness")}</strong> one-time. Same recovery path.</li>
        <li>Agent verification — <strong>${esc(p.priceUsd)} USDC</strong> per call on this rail, daily cap ${esc(p.dailyCapUsd)}. <strong>$QRON is not this rail.</strong></li>
      </ul>
      ${checkoutEmailFormHtml({
        action: "/api/checkout/plan/strainchain_passport",
        label: `Passport checkout — $${planUsd("strainchain_passport")}`,
        inputId: "x402-passport-email",
        formId: "x402-passport-checkout",
      })}
      ${catalogPaymentLinkHtml({
        planId: "strainchain_passport",
        label: `Pay $${planUsd("strainchain_passport")} on Stripe`,
      })}
      ${catalogPaymentLinkHtml({
        planId: "strainchain_farm",
        label: `Pay $${planUsd("strainchain_farm")} on Stripe`,
      })}
      ${checkoutEmailFormHtml({
        action: "/api/checkout/plan/strainchain_farm",
        label: `Farm checkout — $${planUsd("strainchain_farm")}/mo`,
        inputId: "x402-farm-email",
        formId: "x402-farm-checkout",
      })}
      ${checkoutEmailFormHtml({
        action: "/api/checkout/dpp",
        label: `DPP checkout — $${planUsd("dpp_readiness")}`,
        inputId: "x402-dpp-email",
        formId: "x402-dpp-checkout",
      })}
      ${catalogPaymentLinkHtml({
        planId: "dpp_readiness",
        label: `Pay $${planUsd("dpp_readiness")} on Stripe`,
      })}
    </section>
  </div>

  <div class="wrap">
    <aside class="note">
      Autonomous at runtime, one-time human setup. A KYC’d legal entity must fund and own the paying wallet. Every payer is spend-capped (${esc(p.dailyCapUsd)} / day by default) and rate-limited. The edge accepts payment; a full registry lookup on this path is not the same as a dashboard verify.
    </aside>
  </div>
</main>
<footer class="site">
  <div class="wrap foot-inner">
    <p>© 2026 AuthiChain. SAM legal entity ${esc(p.legalEntity)} (sole proprietor; AuthiChain is a brand, not a corporation). Agent pay is live at <a href="${esc(p.canonicalPath)}">/x402</a>.</p>
    <p><a href="/">Home</a> · <a href="/contact">Contact</a> · <a href="/dpp">/dpp</a></p>
  </div>
</footer>
</body>
</html>`;
}
