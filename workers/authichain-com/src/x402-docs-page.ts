/**
 * Public x402 agent-pay docs at /x402 (and /docs/x402).
 *
 * The live rail is already bound on authichain-com. This page is discovery
 * only — published payTo / asset / price, health URL, and unpaid 402 curls.
 * No facilitator URL, no private keys, no settle steps.
 */

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
  payUrl: "https://authichain.com/api/x402",
  verifyUrl: "https://authichain.com/api/v1/agent-verify",
  priceUsd: "$0.05",
  network: "Base",
  chainId: "8453",
  payTo: "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  assetName: "Circle USDC",
  dailyCapUsd: "$10",
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

/** Renders the public x402 discovery page. */
export function renderX402DocsPage(): string {
  const p = X402_PUBLIC;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>x402 agent pay — AuthiChain</title>
<meta name="description" content="AuthiChain x402 agent verification micropayments: ${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)}. Health at /api/x402/health. Unpaid POST returns HTTP 402.">
<link rel="canonical" href="${esc(p.canonicalUrl)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#0f766e">
<meta property="og:type" content="website">
<meta property="og:title" content="x402 agent pay — AuthiChain">
<meta property="og:description" content="${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)} per agent verification. Discover the live rail, then POST unpaid for a 402 challenge.">
<meta property="og:url" content="${esc(p.canonicalUrl)}">
<meta property="og:image" content="https://authichain.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"TechArticle","headline":"AuthiChain x402 agent verification","description":"Pay-per-call product verification for autonomous agents. ${esc(p.priceUsd)} USDC on Base.","url":"${esc(p.canonicalUrl)}"}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050507;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;line-height:1.65}
a{color:#5eead4;text-decoration:none}
a:hover{text-decoration:underline}
a:focus-visible{outline:2px solid #0f766e;outline-offset:3px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid rgba(15,118,110,.35)}
.nav-logo{font-size:1.1rem;font-weight:700;letter-spacing:.05em;color:#f8fafc}
.nav-logo span{color:#2dd4bf}
.wrap{max-width:760px;margin:0 auto;padding:3rem 1.5rem 6rem}
h1{font-size:2.1rem;line-height:1.2;letter-spacing:-.02em;margin-bottom:1rem}
h2{font-size:1.15rem;margin:2.5rem 0 .75rem;letter-spacing:.02em}
p{color:#cbd5e1;margin-bottom:1rem}
.lede{font-size:1.1rem;color:#e2e8f0}
.badge{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5eead4;border:1px solid rgba(45,212,191,.35);border-radius:999px;padding:.3rem .7rem;margin-bottom:1.25rem}
pre{background:#0c0c11;border:1px solid rgba(45,212,191,.18);border-radius:10px;padding:1rem;overflow-x:auto;margin:1rem 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem;color:#e2e8f0}
.inline{background:#0c0c11;border:1px solid rgba(45,212,191,.18);border-radius:6px;padding:.1rem .4rem}
table{width:100%;border-collapse:collapse;margin:1rem 0 1.5rem;font-size:.92rem}
th,td{text-align:left;padding:.55rem .4rem;border-bottom:1px solid rgba(148,163,184,.18);vertical-align:top}
th{color:#94a3b8;font-weight:600;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase}
td.mono,th.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
ul,ol{margin:0 0 1rem 1.1rem;color:#cbd5e1}
li{margin-bottom:.5rem}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin:2rem 0 1rem}
.btn{display:inline-block;padding:.7rem 1.15rem;border-radius:8px;font-weight:600;font-size:.92rem;border:1px solid rgba(45,212,191,.4);color:#5eead4}
.btn.primary{background:#0f766e;color:#f8fafc;border-color:#0f766e}
.btn:hover{text-decoration:none;opacity:.9}
.note{border-left:2px solid rgba(45,212,191,.4);padding:.25rem 0 .25rem 1rem;color:#94a3b8;font-size:.92rem;margin:1.5rem 0}
footer{border-top:1px solid rgba(15,118,110,.35);padding:2rem 1.5rem;text-align:center;color:#64748b;font-size:.85rem}
</style>
</head>
<body>
<nav class="nav"><a class="nav-logo" href="/">AUTHI<span>CHAIN</span></a><a href="${esc(p.healthUrl)}">Health JSON</a></nav>
<div class="wrap">
  <div class="badge">Live &middot; x402 &middot; ${esc(p.priceUsd)} USDC</div>
  <h1>Agent verification, paid per call.</h1>
  <p class="lede">AuthiChain exposes an <strong>x402</strong> micropayment rail so a funded agent can verify a product without a contract, an API key, or a human in the runtime loop.</p>
  <p>An unpaid <code class="inline">POST</code> receives <code class="inline">HTTP 402 Payment Required</code> with the exact scheme, asset, and receiving address. The agent settles ${esc(p.priceUsd)} ${esc(p.assetName)} on ${esc(p.network)}, retries with an <code class="inline">X-PAYMENT</code> proof, and the edge verifies settlement before answering.</p>

  <div class="cta">
    <a class="btn primary" href="${esc(p.healthUrl)}">GET /api/x402/health</a>
    <a class="btn" href="/dpp">DPP checkout</a>
    <a class="btn" href="/protocol">Open protocol</a>
  </div>

  <h2>Published rail</h2>
  <p>These values match the live health document. Treat <a href="${esc(p.healthUrl)}"><code class="inline">GET /api/x402/health</code></a> as the source of truth if anything here and the JSON ever disagree.</p>
  <table>
    <tr><th>Price</th><td>${esc(p.priceUsd)} USDC per call</td></tr>
    <tr><th>Network</th><td>${esc(p.network)} (chain id ${esc(p.chainId)})</td></tr>
    <tr><th>Asset</th><td class="mono">${esc(p.assetName)} ${esc(p.asset)}</td></tr>
    <tr><th>payTo</th><td class="mono">${esc(p.payTo)}</td></tr>
    <tr><th>Health</th><td class="mono"><a href="${esc(p.healthUrl)}">${esc(p.healthUrl)}</a></td></tr>
    <tr><th>Pay endpoint</th><td class="mono"><a href="${esc(p.payUrl)}">${esc(p.payUrl)}</a></td></tr>
    <tr><th>Alias</th><td class="mono">${esc(p.verifyUrl)}</td></tr>
    <tr><th>Facilitator</th><td>PayAI, reachable (URL is not republished here)</td></tr>
    <tr><th>Daily cap</th><td>${esc(p.dailyCapUsd)} per payer</td></tr>
  </table>

  <h2>Unpaid POST → 402</h2>
  <ol>
    <li>Agent <code class="inline">POST</code>s ${esc(p.payUrl)} (or the agent-verify alias) with a JSON body and no payment header.</li>
    <li>The edge answers <code class="inline">402</code> with <code class="inline">x402Version: 1</code> and an <code class="inline">accepts[]</code> requirement: scheme <code class="inline">exact</code>, ${esc(p.network)} USDC, payTo above, plus EIP-712 extra for Circle USDC.</li>
    <li>The agent settles through a compatible x402 client / facilitator, then retries the same POST with <code class="inline">X-PAYMENT</code>.</li>
    <li>A valid settlement returns <code class="inline">200</code> JSON. A missing or invalid proof returns another <code class="inline">402</code>.</li>
  </ol>
  <p>Do not send private keys to AuthiChain. Settlement happens in the agent's wallet. This page only shows the unpaid challenge.</p>

  <h2>curl — health</h2>
  <pre><code>curl -sS https://authichain.com/api/x402/health</code></pre>
  <p>Expect HTTP 200 with <code class="inline">"status":"ready"</code>, <code class="inline">"mode":"trustless"</code>, the payTo and Circle USDC addresses above, and <code class="inline">"pricePerCall":{"usd":0.05}</code>.</p>

  <h2>curl — unpaid challenge</h2>
  <pre><code>curl -sS -i -X POST https://authichain.com/api/x402 \\
  -H 'content-type: application/json' \\
  -d '{"sealId":"demo"}'</code></pre>
  <p>Expect HTTP 402. The body lists the asset, payTo, and EIP-712 extra. No wallet, key, or <code class="inline">X-PAYMENT</code> header is required for this probe.</p>

  <div class="note">
    Autonomous at runtime, one-time human setup. A KYC'd legal entity must fund and own the paying wallet. Every payer is spend-capped (${esc(p.dailyCapUsd)} / day by default) and rate-limited. The edge accepts payment; a full registry lookup on this path is not the same as a dashboard verify.
  </div>

  <p>Questions: <a href="/contact">contact</a>. Product passports: <a href="/dpp">/dpp</a>.</p>
</div>
<footer>&copy; 2026 AuthiChain Inc. &middot; Agent pay is live at <a href="${esc(p.canonicalPath)}">/x402</a> &middot; <a href="/">Home</a></footer>
</body>
</html>`;
}
