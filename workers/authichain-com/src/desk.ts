/**
 * Self-serve desk at /desk.
 *
 * Folded from the Grok App Builder preview. Command tokens (ink / paper /
 * steel). Not a second homepage — existing /verify /pricing /dpp stay.
 * Checkout uses GET + ?email= (#1141). $QRON is not a payment rail (#1143).
 */
import {
  catalogPaymentLinkHtml,
  checkoutEmailFormHtml,
} from "../../../src/lib/checkout-email";
import { PAYMENT_LINKS } from "../../../server/payment-links";

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

export const DESK_AS_OF = "22 Sep 2026";
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
    detail:
      "GET /api/checkout/dpp needs ?email=. Else 303 to /dpp?need_email=1.",
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
    detail:
      "Apexes proxy /p. Five 2026 DPP/W3C hubs shipped (#1140). Specs not implemented.",
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

type AgentId = "guardian" | "sentinel" | "archivist" | "scout" | "arbiter";
type AgentVote = "pass" | "fail" | "unknown";
type SealStatus = "verified" | "failed" | "unknown";

const AGENTS: { id: AgentId; name: string; role: string }[] = [
  { id: "guardian", name: "Guardian", role: "Seal integrity" },
  { id: "sentinel", name: "Sentinel", role: "Clone / anomaly" },
  { id: "archivist", name: "Archivist", role: "Registry record" },
  { id: "scout", name: "Scout", role: "Custody graph" },
  { id: "arbiter", name: "Arbiter", role: "Consensus" },
];

const ALL_PASS: Record<AgentId, AgentVote> = {
  guardian: "pass",
  sentinel: "pass",
  archivist: "pass",
  scout: "pass",
  arbiter: "pass",
};

const SAMPLE_NOTE =
  "Desk sample. query_provenance never attests an unknown ID, and it labels this row a sample — not a live registry write.";

type DeskSeal = {
  id: string;
  status: SealStatus;
  sample: boolean;
  product: string;
  holder: string;
  origin: string;
  finding: string;
  disclaimer: string;
  plan?: "dpp_readiness" | "strainchain_farm" | "strainchain_passport";
  gift?: string;
  fields: { label: string; value: string }[];
  votes: Record<AgentId, AgentVote>;
};

const DESK_SEALS: DeskSeal[] = [
  {
    id: SEED,
    status: "verified",
    sample: true,
    product: "Michigan METRC sample",
    holder: "Self-serve desk seed",
    origin: "Michigan",
    finding:
      "Five-agent consensus on the published desk seed. Not a live METRC filing and not a cryptographic attestation.",
    disclaimer: SAMPLE_NOTE,
    plan: "strainchain_passport",
    fields: [
      { label: "Source", value: "Desk seed · AC-7C2A91E4" },
      { label: "Protocol", value: "AuthiChain attestation 0.1" },
      { label: "MCP", value: "query_provenance status desk_sample, verified false" },
      { label: "Scan", value: "2.1s · Guardian → Arbiter" },
    ],
    votes: ALL_PASS,
  },
  {
    id: "AC-DPP-BATT-8841",
    status: "verified",
    sample: true,
    product: "Harbor-3 LFP industrial pack · 3.2 kWh",
    holder: "Great Lakes Energy Works",
    origin: "Grand Rapids, MI",
    finding: "Five-agent consensus. Seal matches the sample DPP for this pack.",
    disclaimer: SAMPLE_NOTE,
    plan: "dpp_readiness",
    fields: [
      { label: "Carbon", value: "68.4 kg CO2e / kWh" },
      { label: "Recycled Co", value: "14%" },
      { label: "Recycled Li", value: "6%" },
      { label: "Repair", value: "Module swap · 8-year residual" },
      { label: "ESPR gate", value: "18 Feb 2027 · batteries ≥2 kWh" },
      { label: "DPP class", value: "Industrial / LMT battery" },
    ],
    votes: ALL_PASS,
  },
  {
    id: "SC-FARM-LT63-0912",
    status: "verified",
    sample: true,
    product: "Mendo / LT-63 genetics passport",
    holder: "Sun-grown Michigan cultivar desk",
    origin: "Northern Lower Peninsula, MI",
    finding: "Genetics passport matches the sample CoA hash. Not a METRC filing.",
    disclaimer: SAMPLE_NOTE,
    plan: "strainchain_farm",
    fields: [
      { label: "Cultivar", value: "LT-63" },
      { label: "CoA hash", value: "sha256:7c91…e2ab" },
      { label: "METRC lot", value: "1A4060300002DEMO" },
      { label: "Pack", value: "Jar + CoA, not a dispensary license" },
      { label: "SKU", value: "Farm $149/mo · Passport $49" },
    ],
    votes: ALL_PASS,
  },
  {
    id: "GC-MIA-DLA-0005",
    status: "verified",
    sample: true,
    product: "ACPT seal · token 5 · DLA Aviation Philadelphia",
    holder: "Founder-held AuthiChainProduct",
    origin: "United States",
    finding:
      "Founder-held ACPT seal. Metadata is live. This is not a government mint and not an award.",
    disclaimer:
      "No SBIR/STTR/SVIP win is asserted. On-chain government seals wait on a live contract with bytecode.",
    gift: "https://govchain.us/gift",
    fields: [
      { label: "Agency", value: "DLA Aviation · Philadelphia" },
      { label: "Fit", value: "From mint calldata, not an award" },
      { label: "Mint", value: "No government NFT. No SBIR win claimed." },
      { label: "Origin brief", value: "FTC 16 CFR Part 323 · EO 14392 context" },
      { label: "Packet", value: "govchain.us/gift · free DoD packet" },
    ],
    votes: ALL_PASS,
  },
  {
    id: "AC-DPP-BATT-8841X",
    status: "failed",
    sample: true,
    product: "Harbor-3 LFP industrial pack · clone attempt",
    holder: "Unknown presenter",
    origin: "Claimed Grand Rapids, MI",
    finding:
      "Sentinel rejected a copied QR. The original pack still verifies. This mark does not.",
    disclaimer: SAMPLE_NOTE,
    plan: "dpp_readiness",
    fields: [
      { label: "Cloned from", value: "AC-DPP-BATT-8841" },
      { label: "Signature", value: "Does not verify against JWKS" },
      { label: "Registry", value: "No matching tokenURI" },
    ],
    votes: {
      guardian: "fail",
      sentinel: "fail",
      archivist: "fail",
      scout: "unknown",
      arbiter: "fail",
    },
  },
];

const SEAL_INDEX = new Map(DESK_SEALS.map(s => [s.id, s]));

function normalizeSealId(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._:-]/g, "")
    .slice(0, 64);
}

function lookupDeskSeal(raw: string): DeskSeal {
  const id = normalizeSealId(raw);
  const hit = SEAL_INDEX.get(id);
  if (hit) return hit;
  return {
    id: id || "—",
    status: "unknown",
    sample: false,
    product: "No registry row",
    holder: "—",
    origin: "—",
    finding:
      "Not in this desk and not attested. The live MCP query_provenance path returns the same class of answer: unknown, never verified.",
    disclaimer:
      "Honesty is the product. This desk never upgrades an unknown ID to a readiness stamp.",
    fields: [
      { label: "Lookup", value: "Public query_provenance" },
      { label: "Attestation", value: "None — unknown stays unknown" },
    ],
    votes: {
      guardian: "unknown",
      sentinel: "unknown",
      archivist: "unknown",
      scout: "unknown",
      arbiter: "unknown",
    },
  };
}

function voteLabel(vote: AgentVote): string {
  if (vote === "pass") return "Pass";
  if (vote === "fail") return "Fail";
  return "Unknown";
}

function agentRail(votes: Record<AgentId, AgentVote>): string {
  return `<ol class="agents">${AGENTS.map(
    a =>
      `<li class="agent"><p class="kicker">${esc(a.role)}</p><p style="margin:.35rem 0 0;font-family:Newsreader,serif;font-size:1.15rem">${esc(a.name)}</p><p class="vote-${votes[a.id]}">${voteLabel(votes[a.id])}</p></li>`
  ).join("")}</ol>`;
}

function sealCta(seal: DeskSeal): string {
  if (seal.gift) {
    return `<a class="btn" href="${esc(seal.gift)}">Open free DoD packet</a>`;
  }
  if (seal.plan === "dpp_readiness") {
    return catalogPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "Pay $299 DPP Readiness",
      className: "btn",
    });
  }
  if (seal.plan === "strainchain_farm") {
    return catalogPaymentLinkHtml({
      planId: "strainchain_farm",
      label: "Pay Farm $149/mo",
      className: "btn",
    });
  }
  if (seal.plan === "strainchain_passport") {
    return catalogPaymentLinkHtml({
      planId: "strainchain_passport",
      label: "Pay Passport $49",
      className: "btn",
    });
  }
  return `<a class="btn" href="/desk/pricing">See live SKUs</a>`;
}

function renderCertificate(seal: DeskSeal): string {
  const statusLabel =
    seal.status === "verified"
      ? "Verified"
      : seal.status === "failed"
        ? "Rejected"
        : "Unknown";
  const headline =
    seal.status === "verified"
      ? "Consensus reached."
      : seal.status === "failed"
        ? "The mark does not hold."
        : "Unknown. Not attested.";
  const fields = seal.fields
    .map(
      f =>
        `<div><p class="kicker">${esc(f.label)}</p><p style="margin:.3rem 0 0">${esc(f.value)}</p></div>`
    )
    .join("");
  return `<section style="margin-top:2rem">
    <p class="kicker">Verification · ${esc(seal.id)}</p>
    <h2 style="margin:.4rem 0 0">${esc(headline)}</h2>
    <p class="muted">Guardian, Sentinel, Archivist, Scout, then Arbiter. Target 2.1 seconds. No agent may upgrade an unknown ID to verified.</p>
    ${agentRail(seal.votes)}
    <article class="card" style="margin-top:1.25rem">
      <p><span class="badge">${esc(statusLabel)}</span>${seal.sample ? ' <span class="badge">Desk sample</span>' : ""} <span class="muted">2.1s consensus</span></p>
      <h3 style="margin:.6rem 0 .35rem">${esc(seal.product)}</h3>
      <p class="mono">${esc(seal.id)}</p>
      <p>${esc(seal.finding)}</p>
      <div class="fields">${fields}
        <div><p class="kicker">Holder</p><p style="margin:.3rem 0 0">${esc(seal.holder)}</p></div>
        <div><p class="kicker">Origin</p><p style="margin:.3rem 0 0">${esc(seal.origin)}</p></div>
      </div>
      <p class="muted" style="margin-top:1rem">${esc(seal.disclaimer)}</p>
      <div class="row">${sealCta(seal)}
        <a class="btn ghost" href="https://authichain.com/onboard">Start a pilot</a>
      </div>
    </article>
  </section>`;
}

const SAMPLE_CHIPS = [
  [SEED, "METRC seed"],
  ["AC-DPP-BATT-8841", "Battery DPP"],
  ["SC-FARM-LT63-0912", "Farm genetics"],
  ["GC-MIA-DLA-0005", "ACPT token 5"],
  ["AC-DPP-BATT-8841X", "Clone"],
] as const;

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
.agents{display:grid;gap:.5rem;margin:1.25rem 0 0}
@media(min-width:640px){.agents{grid-template-columns:repeat(5,1fr)}}
.agent{border:1px solid var(--line);border-radius:12px;padding:.75rem;background:var(--ink);animation:rise .45s ease both}
.agent:nth-child(1){animation-delay:.32s}.agent:nth-child(2){animation-delay:.64s}.agent:nth-child(3){animation-delay:.96s}.agent:nth-child(4){animation-delay:1.28s}.agent:nth-child(5){animation-delay:1.6s}
@keyframes rise{from{opacity:.35;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.agent{animation:none}}
.vote-pass,.vote-fail,.vote-unknown{font-family:IBM Plex Mono,ui-monospace,Menlo,monospace;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;margin:.65rem 0 0}
.vote-pass{color:var(--ok)}.vote-fail{color:#c45c5c}.vote-unknown{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0 0}
.chip{border:1px solid var(--line);border-radius:999px;padding:.35rem .8rem;font-size:.8rem;color:var(--paper)}
.fields{display:grid;gap:1px;background:var(--line);margin-top:1rem;border-radius:12px;overflow:hidden}
@media(min-width:640px){.fields{grid-template-columns:1fr 1fr}}
.fields div{background:var(--char);padding:.85rem 1rem}
`;

function shell(
  title: string,
  description: string,
  path: string,
  body: string
): string {
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
       <p style="align-self:end">${catalogPaymentLinkHtml({
         planId: "dpp_readiness",
         label: "Pay $299 on Stripe",
         className: "btn ghost",
       })}</p>
       <p style="align-self:end"><a class="btn ghost" href="/desk/verify">Verify ${SEED}</a></p>
     </div>
     <div class="row" style="margin-top:1rem;flex-wrap:wrap;gap:.75rem">
       ${catalogPaymentLinkHtml({
         planId: "strainchain_passport",
         label: "Passport $49",
         className: "btn ghost",
       })}
       ${catalogPaymentLinkHtml({
         planId: "strainchain_farm",
         label: "Farm $149/mo",
         className: "btn ghost",
       })}
       <a class="btn ghost" href="${PAYMENT_LINKS.strainchain.basic.url}">${PAYMENT_LINKS.strainchain.basic.name} ${PAYMENT_LINKS.strainchain.basic.price}</a>
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
  const farm = checkoutEmailFormHtml({
    action: "/api/checkout/plan/strainchain_farm",
    label: "Start a Farm Plan",
    formId: "desk-price-farm",
    inputId: "desk-price-farm-email",
    buttonClass: "btn",
  });
  return shell(
    "Pricing — AuthiChain desk",
    "Live catalogue. Farm $149/mo is the recurring SKU. Checkout requires a recovery email.",
    "/desk/pricing",
    `<p class="kicker">Published catalogue</p>
     <h1>Prices that already charge.</h1>
     <p class="muted">GET checkout without email 303s to a capture page. Anonymous carts never get Stripe recovery mail.</p>
     <div class="grid g2" style="margin-top:1.5rem">
       <div class="card"><p class="kicker">Farm</p><p class="price">$149<span style="font-size:1rem;color:var(--muted)">/mo</span></p><p class="muted">Unlimited cultivars. Recurring. Same live Stripe link as strainchain.io.</p>${farm}
         <p style="margin-top:.75rem">${catalogPaymentLinkHtml({
           planId: "strainchain_farm",
           label: "Pay $149/mo on Stripe",
           className: "btn ghost",
         })}</p></div>
       <div class="card"><p class="kicker">Passport</p><p class="price">$49</p><p class="muted">One cultivar. StrainChain, not an AuthiChain desk fee.</p>${passport}
         <p style="margin-top:.75rem"><a href="/telegram">Telegram Mini App</a></p></div>
       <div class="card"><p class="kicker">EU DPP Readiness</p><p class="price">$299</p><p class="muted">One-time. Credits toward AuthiChain Basic.</p>${dpp}</div>
       <div class="card"><p class="kicker">AuthiChain Starter</p><p class="price">$299<span style="font-size:1rem;color:var(--muted)">/mo</span></p><p class="muted">Not the QRON Starter Pack ($29).</p>
         <p style="margin-top:1rem"><a class="btn ghost" href="https://buy.stripe.com/28E8wP0EVf7M6mefTS1Nu1p">Open $299/mo</a></p></div>
     </div>
     <p class="muted" style="margin-top:1.5rem">QRON Starter $29 / Creator $99 live on <a href="https://qron.space/generate">qron.space/generate</a>. GovChain is onboard only. Farm $149/mo is the founder-income recurring rail.</p>`
  );
}

function verify(request: Request): string {
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  const pending = raw.trim();
  const seal = pending ? lookupDeskSeal(pending) : null;
  const inputValue = esc(pending || SEED);
  const chips = SAMPLE_CHIPS.map(
    ([id, label]) =>
      `<a class="chip" href="/desk/verify?id=${esc(id)}">${esc(label)} · ${esc(id)}</a>`
  ).join("");
  const result = seal ? renderCertificate(seal) : "";
  return shell(
    "Verify — AuthiChain desk",
    "Five-agent consensus on this desk. Typical scan is 2.1 seconds. Unknown IDs stay unknown.",
    "/desk/verify",
    `<p class="kicker">Five-agent consensus</p>
     <h1>Verify</h1>
     <p class="muted">Guardian, Sentinel, Archivist, Scout, Arbiter. Desk samples are labeled. query_provenance never attests an unknown ID.</p>
     <form id="vf" class="card" style="max-width:28rem" method="get" action="/desk/verify">
       <label for="cert">Certificate ID</label>
       <input id="cert" name="id" value="${inputValue}" autocomplete="off" maxlength="64">
       <div class="row"><button class="btn" type="submit">Run 2.1s consensus</button>
       <a class="btn ghost" href="/protocol">Open Verification Protocol</a></div>
     </form>
     <p class="muted" style="margin-top:1rem">Scan stays on this desk. Samples first:</p>
     <div class="chips">${chips}</div>
     ${result}`
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
     <p class="muted" style="margin-top:1.5rem">Checkout stays DPP $299 / Passport $49 / Farm $149/mo / QRON packs / GovChain onboard.</p>`
  );
}

type PageRender = (request: Request) => string;

const PAGES: Record<string, PageRender> = {
  "/desk": () => home(),
  "/desk/": () => home(),
  "/desk/status": () => status(),
  "/desk/status/": () => status(),
  "/desk/pricing": () => pricing(),
  "/desk/pricing/": () => pricing(),
  "/desk/verify": verify,
  "/desk/verify/": verify,
  "/desk/token": () => token(),
  "/desk/token/": () => token(),
  "/desk/hubs": () => hubs(),
  "/desk/hubs/": () => hubs(),
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
  return new Response(render(request), { headers: HTML_HEADERS });
}
