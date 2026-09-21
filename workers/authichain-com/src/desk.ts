/**
 * Self-serve desk at /desk.
 *
 * Folded from the Grok App Builder preview. Command tokens (ink / paper /
 * steel). Not a second homepage — existing /verify /pricing /dpp stay.
 * Checkout uses GET + ?email= (#1141). $QRON is not a payment rail (#1143).
 */
import { checkoutEmailFormHtml } from "../../../src/lib/checkout-email";

const HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const DESK_AS_OF = "21 Sep 2026";
export const DESK_COMMIT = "259290d";

const PAYTO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
const DEPLOYER = "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d";
const SMART = "0xC0D26735fd9e868eacc60400ef3171Fa4161177f";
const POLYGON_NFT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const QRON = "0xAebfA6b08fb25b59748c93273aB8880e20FfE437";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SEED = "AC-7C2A91E4";

type DeskState = "live" | "pending" | "off";
const ESTATE: { surface: string; state: DeskState; detail: string }[] = [
  {
    surface: "Cloudflare apex",
    state: "live",
    detail: "authichain.com workers. Money path is not Vercel. #1138 on main.",
  },
  {
    surface: "EU DPP checkout",
    state: "live",
    detail: "GET /api/checkout/dpp needs ?email=. Else 303 to /dpp?need_email=1.",
  },
  {
    surface: "Passport $49",
    state: "live",
    detail: "Plan checkout + Mini App. /telegram is in sitemap.xml (#1145).",
  },
  {
    surface: "x402 agent pay",
    state: "live",
    detail: "$0.05 USDC on Base. PayTo is the tokenomics EOA. Do not rebind.",
  },
  {
    surface: "$QRON",
    state: "live",
    detail: "Polygon ERC-20. Not a payment rail. Staking UI is theater.",
  },
  {
    surface: "SEO hubs /p",
    state: "live",
    detail: "Apexes proxy /p. Five 2026 DPP/W3C hubs shipped (#1140). Specs not implemented.",
  },
  {
    surface: "Base AuthiChainNFT",
    state: "pending",
    detail: "NFT deployer EOA funded. getCode on 8453 is still 0x.",
  },
  {
    surface: "Certificate count",
    state: "pending",
    detail: "Apex cards show — until /api/authichain/certificates answers.",
  },
  {
    surface: "gov-mint",
    state: "off",
    detail: "Frozen until a Base getCode proof. Default dry_run=true.",
  },
];

const HUBS = [
  {
    brand: "AuthiChain",
    href: "https://authichain.com/p/what-is-a-digital-product-passport",
    label: "What is a DPP",
  },
  {
    brand: "AuthiChain",
    href: "https://authichain.com/p/eu-digital-product-passport-registry-test-environment",
    label: "EU DPP registry test env",
  },
  {
    brand: "AuthiChain",
    href: "https://authichain.com/p/w3c-verifiable-credentials-data-model-2-1-changes",
    label: "W3C VC Data Model 2.1",
  },
  {
    brand: "StrainChain",
    href: "https://strainchain.io/p/cannabis-blockchain-provenance",
    label: "Cannabis provenance",
  },
  {
    brand: "QRON",
    href: "https://qron.space/p/ai-qr-code-art-generator",
    label: "AI QR generator",
  },
  {
    brand: "GovChain",
    href: "https://govchain.us/p/government-document-verification-blockchain",
    label: "Document verification",
  },
];

export const DESK_SITEMAP = [
  "/desk",
  "/desk/status",
  "/desk/pricing",
  "/desk/verify",
  "/desk/token",
  "/desk/hubs",
] as const;

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
:root{--ink:#0c0c0d;--char:#141416;--paper:#f2efe8;--steel:#b8b4aa;--muted:#8b8880;--line:#2c2c2e;--ok:#7a9478}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;background:var(--ink);color:var(--paper);font-family:IBM Plex Sans,Segoe UI,system-ui,sans-serif;line-height:1.5}
h1,h2,h3{font-family:Newsreader,Iowan Old Style,Palatino,serif;font-weight:500;text-wrap:balance;letter-spacing:-.02em}
a{color:var(--steel);text-decoration:none}a:hover{color:var(--paper)}
header{position:sticky;top:0;border-bottom:1px solid var(--line);background:rgba(12,12,13,.95);backdrop-filter:blur(8px)}
header .bar,footer .bar,main{max-width:56rem;margin:0 auto;padding:0 1rem}
header .bar{display:flex;height:3.5rem;align-items:center;justify-content:space-between}
nav{display:flex;gap:1.25rem;font-size:.875rem}
main{padding:2.5rem 1rem 5rem}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:.75rem}
footer .bar{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;padding:1.25rem 1rem}
.card{border:1px solid var(--line);background:var(--char);border-radius:16px;padding:1.25rem}
.grid{display:grid;gap:.75rem}
@media(min-width:640px){.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}}
.kicker{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--steel)}
.muted{color:var(--muted)}
.mono{font-family:IBM Plex Mono,ui-monospace,Menlo,monospace;font-size:.8rem;word-break:break-all}
.price{font-family:Newsreader,serif;font-size:2.25rem}
.badge{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:.1rem .5rem;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--steel)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:.5rem 1.25rem;border-radius:10px;border:0;background:var(--paper);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--paper)}
.checkout-email-form{display:flex;flex-direction:column;gap:.5rem;margin-top:1rem;max-width:22rem}
.checkout-email-label{display:flex;flex-direction:column;gap:.4rem;font-size:.85rem}
.checkout-email-form input[type=email]{height:2.75rem;padding:0 .75rem;border:1px solid var(--line);border-radius:10px;background:var(--ink);color:var(--paper);font:inherit}
.checkout-email-hint{font-size:.8rem;color:var(--muted);margin:0}
.checkout-email-form button{cursor:pointer;font:inherit;min-height:2.75rem;padding:.5rem 1.25rem;border-radius:10px;border:0;background:var(--paper);color:var(--ink);font-weight:600}
input,select{height:2.75rem;width:100%;padding:0 .75rem;border:1px solid var(--line);border-radius:10px;background:var(--char);color:var(--paper);font:inherit}
label{display:block;margin:.75rem 0 .35rem;font-size:.85rem}
.row{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem}
`;

function shell(title: string, description: string, path: string, body: string): string {
  const nav = [
    ["/desk", "Desk"],
    ["/desk/verify", "Verify"],
    ["/desk/pricing", "Pricing"],
    ["/dpp", "EU DPP"],
    ["/dashboard", "Sign in"],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}"${href === path ? ' style="color:var(--paper)"' : ""}>${label}</a>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://authichain.com${esc(path)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${CSS}</style>
</head><body>
<header><div class="bar">
  <a href="/desk" style="color:var(--paper);font-family:Newsreader,serif;font-size:1.15rem">Authi<span style="color:var(--steel)">Chain</span></a>
  <nav>${nav}</nav>
</div></header>
<main>${body}</main>
<footer><div class="bar">
  <span>Self-serve desk on Cloudflare. Apex sells seals. Tokens off this nav.</span>
  <span><a href="/desk/status">Status</a> · <a href="/desk/token">Rails</a> · <a href="/desk/hubs">Hubs</a> · <a href="/">Apex</a></span>
</div></footer>
</body></html>`;
}

function home(): string {
  const dppForm = checkoutEmailFormHtml({
    action: "/api/checkout/dpp",
    label: "Start DPP checkout",
    formId: "desk-dpp",
    inputId: "desk-dpp-email",
    buttonClass: "btn",
  });
  return shell(
    "Self-serve desk — AuthiChain",
    "Issue. Bind. Verify. Self-serve product seals. EU DPP Readiness at live Stripe checkout with recovery email.",
    "/desk",
    `<p class="kicker">Self-serve desk</p>
     <h1 style="font-size:clamp(2.2rem,6vw,3.6rem);margin:.4rem 0 1rem">Issue. Bind. Verify.</h1>
     <p class="muted" style="max-width:36rem">AuthiChain is the truth layer for physical products. Humans pay Stripe. Agents pay $0.05 USDC on Base. $QRON is not a payment rail.</p>
     <div class="row">${dppForm}
       <p style="align-self:end"><a class="btn ghost" href="/desk/verify">Verify ${SEED}</a></p>
     </div>
     <div class="grid g3" style="margin-top:2.5rem">
       <div class="card"><p class="kicker">TruMark</p><p>Scan seal. Not a SKU.</p><a href="/trumark">Open TruMark</a></div>
       <div class="card"><p class="kicker">Mini App</p><p>Passport $49. Sitemap loc is live.</p><a href="/telegram">Open /telegram</a></div>
       <div class="card"><p class="kicker">x402</p><p>$0.05 USDC · Base 8453</p><a href="/x402">Agent docs</a></div>
     </div>
     <div class="grid g2" style="margin-top:1rem">
       <div class="card"><span class="badge">Public registry</span><p class="price" style="margin:.5rem 0">—</p><p class="muted">Certificates issued (API 404)</p></div>
       <div class="card"><span class="badge">Polygon 137</span><p class="price" style="margin:.5rem 0">16</p><p class="muted">ACPT NFTs. Empty on Base.</p><p class="mono">${POLYGON_NFT}</p></div>
     </div>`
  );
}

function status(): string {
  const rows = ESTATE.map(
    r => `<div class="card" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
      <div><p style="margin:0;font-family:Newsreader,serif;font-size:1.25rem">${esc(r.surface)}</p>
      <p class="muted" style="margin:.35rem 0 0">${esc(r.detail)}</p></div>
      <span class="badge">${esc(r.state)}</span></div>`
  ).join("");
  return shell(
    "Estate status — AuthiChain desk",
    `Estate status as of ${DESK_AS_OF}. Canonical repo undone0603/authichain-unified.`,
    "/desk/status",
    `<p class="kicker">undone0603/authichain-unified @ ${DESK_COMMIT}</p>
     <h1>Estate status</h1>
     <p class="muted">As of ${DESK_AS_OF}. SAM legal entity is ZACHARY KIETZMAN. AuthiChain is the brand. Cloudflare is the deploy authority.</p>
     <div class="grid" style="margin-top:1.5rem">${rows}</div>
     <div class="card" style="margin-top:1rem">
       <p class="kicker">Three rails — do not mix</p>
       <p>Stripe (humans) · x402 USDC on Base (agents) · $QRON on Polygon (not settlement).</p>
       <p class="mono">payTo / tokenomics ${PAYTO}</p>
       <p class="mono">NFT deployer ${DEPLOYER}</p>
       <p class="mono">Coinbase Smart Wallet ${SMART}</p>
     </div>`
  );
}

function pricing(): string {
  const dpp = checkoutEmailFormHtml({
    action: "/api/checkout/dpp",
    label: "Start DPP checkout",
    formId: "desk-price-dpp",
    inputId: "desk-price-dpp-email",
    buttonClass: "btn",
  });
  const passport = checkoutEmailFormHtml({
    action: "/api/checkout/plan/strainchain_passport",
    label: "Publish one passport",
    formId: "desk-price-pass",
    inputId: "desk-price-pass-email",
    buttonClass: "btn",
  });
  return shell(
    "Pricing — AuthiChain desk",
    "Live catalogue. $49 is a StrainChain passport. Checkout requires a recovery email.",
    "/desk/pricing",
    `<p class="kicker">Published catalogue</p>
     <h1>Prices that already charge.</h1>
     <p class="muted">GET checkout without email 303s to a capture page. Anonymous carts never get Stripe recovery mail.</p>
     <div class="grid g3" style="margin-top:1.5rem">
       <div class="card"><p class="kicker">EU DPP Readiness</p><p class="price">$299</p><p class="muted">One-time. Credits toward AuthiChain Basic.</p>${dpp}</div>
       <div class="card"><p class="kicker">AuthiChain Starter</p><p class="price">$299<span style="font-size:1rem;color:var(--muted)">/mo</span></p><p class="muted">Not the QRON Starter Pack ($29).</p>
         <p style="margin-top:1rem"><a class="btn ghost" href="https://buy.stripe.com/28E8wP0EVf7M6mefTS1Nu1p">Open $299/mo</a></p></div>
       <div class="card"><p class="kicker">Passport</p><p class="price">$49</p><p class="muted">One cultivar. StrainChain, not an AuthiChain desk fee.</p>${passport}
         <p style="margin-top:.75rem"><a href="/telegram">Telegram Mini App</a></p></div>
     </div>
     <p class="muted" style="margin-top:1.5rem">QRON Starter $29 / Creator $99 live on <a href="https://qron.space/generate">qron.space/generate</a>. GovChain is onboard only.</p>`
  );
}

function verify(): string {
  return shell(
    "Verify — AuthiChain desk",
    "Enter a cert ID. Typical scan is 2.1 seconds.",
    "/desk/verify",
    `<h1>Verify</h1>
     <p class="muted">Desk sample is ${SEED} (Michigan METRC). Live protocol is on the apex.</p>
     <form id="vf" class="card" style="max-width:28rem">
       <label for="cert">Certificate ID</label>
       <input id="cert" name="id" value="${SEED}" autocomplete="off">
       <div class="row"><button class="btn" type="submit">Verify on apex</button>
       <a class="btn ghost" href="/protocol">Open Verification Protocol</a></div>
     </form>
     <p class="muted" style="margin-top:1rem">This form submits to <a href="/verify">authichain.com/verify</a>.</p>
     <script>
       document.getElementById('vf').addEventListener('submit', function (e) {
         e.preventDefault();
         var id = document.getElementById('cert').value.trim();
         location.href = '/verify' + (id ? ('?id=' + encodeURIComponent(id)) : '');
       });
     </script>`
  );
}

function token(): string {
  return shell(
    "Rails — AuthiChain desk",
    "Stripe, x402 USDC, and $QRON are three rails. Do not mix them.",
    "/desk/token",
    `<h1>$QRON is not a payment rail.</h1>
     <div class="grid" style="margin-top:1rem">
       <div class="card"><p class="kicker">Stripe · humans</p><p>Passport $49 · DPP $299 · QRON packs. Stripe acct, not these wallets.</p></div>
       <div class="card"><p class="kicker">x402 · agents</p><p>$0.05 Circle USDC on Base 8453. Health ready. Do not rebind PayTo.</p>
         <p class="mono">${PAYTO}</p><p class="mono">USDC ${USDC}</p><a href="/x402">authichain.com/x402</a></div>
       <div class="card"><p class="kicker">$QRON · Polygon</p><p>1,000,000,000 supply. Held almost entirely by the tokenomics EOA. Staking UI is theater — not live tokenomics.</p>
         <p class="mono">${QRON}</p></div>
     </div>
     <div class="card" style="margin-top:1rem">
       <p class="kicker">Do not call two keys ops</p>
       <p>payTo / tokenomics EOA ≠ NFT deployer EOA ≠ Coinbase Smart Wallet.</p>
       <p class="mono">deployer ${DEPLOYER}</p>
       <p class="mono">smart wallet ${SMART}</p>
     </div>`
  );
}

function hubs(): string {
  const cards = HUBS.map(
    h => `<div class="card"><p class="kicker">${esc(h.brand)}</p>
      <p style="font-family:Newsreader,serif;font-size:1.35rem;margin:.35rem 0">${esc(h.label)}</p>
      <a href="${esc(h.href)}">Open live hub</a></div>`
  ).join("");
  return shell(
    "SEO hubs — AuthiChain desk",
    "Programmatic /p hubs. Not a fourth price list. W3C VC 2026 specs are cited, not implemented.",
    "/desk/hubs",
    `<p class="kicker">#1139 · #1140</p>
     <h1>Seed hubs live on each apex.</h1>
     <p class="muted">W3C Render Method, Confidence Method, and Data Model 2.1 are research pages. This protocol does not implement them yet.</p>
     <div class="grid g2" style="margin-top:1.5rem">${cards}</div>
     <p class="muted" style="margin-top:1.5rem">Checkout stays DPP $299 / Passport $49 / QRON packs / GovChain onboard.</p>`
  );
}

const PAGES: Record<string, () => string> = {
  "/desk": home,
  "/desk/": home,
  "/desk/status": status,
  "/desk/status/": status,
  "/desk/pricing": pricing,
  "/desk/pricing/": pricing,
  "/desk/verify": verify,
  "/desk/verify/": verify,
  "/desk/token": token,
  "/desk/token/": token,
  "/desk/hubs": hubs,
  "/desk/hubs/": hubs,
};

export function isDeskPath(pathname: string): boolean {
  return pathname === "/desk" || pathname.startsWith("/desk/");
}

export function tryHandleDesk(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isDeskPath(url.pathname)) return null;
  const render = PAGES[url.pathname];
  if (!render) {
    return new Response(
      shell(
        "Not on this desk — AuthiChain",
        "That path is not a seal, a price, or a certificate.",
        url.pathname,
        `<h1>Not on this desk</h1><p class="muted">That path is not a seal, a price, or a certificate.</p><p><a href="/desk">Back to the desk</a></p>`
      ),
      { status: 404, headers: { ...HTML_HEADERS, "X-Robots-Tag": "noindex" } }
    );
  }
  return new Response(render(), { headers: HTML_HEADERS });
}
