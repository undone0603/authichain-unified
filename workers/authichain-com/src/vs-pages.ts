import { planPaymentLink } from "../../../src/lib/plans.ts";

/**
 * Worker-native /vs/* comparison pages.
 *
 * These existed only as Next.js routes under `src/app/vs/` (see `_VsPage.tsx`),
 * which are served by the app deployment — not by this apex Worker. The apex
 * answered /vs/scantrust with the homepage at HTTP 200, so the pages were
 * simultaneously "live" to a crawler and absent to a reader. Rendering them here
 * makes the apex the thing that actually serves them.
 *
 * Content is kept in step with the Next pages deliberately: the copy below is
 * ported from `src/app/vs/{scantrust,circularise,vechain}/page.tsx`. If a claim
 * changes in one place it has to change in both, so prefer editing both in the
 * same commit.
 */

export interface ComparisonRow {
  feature: string;
  authichain: boolean | string;
  competitor: boolean | string;
}

export interface VsDefinition {
  /** URL slug segment, e.g. "scantrust". */
  slug: string;
  competitor: string;
  title: string;
  description: string;
  competitorSummary: string;
  rows: ComparisonRow[];
  reasons: { title: string; desc: string }[];
}

const ACCENT = "#00FFD1";

export const VS_PAGES: VsDefinition[] = [
  {
    slug: "scantrust",
    competitor: "Scantrust",
    title:
      "AuthiChain vs Scantrust: Which Is Better for Product Authentication? (2026)",
    description:
      "AuthiChain vs Scantrust compared feature-by-feature — blockchain anchoring, EU DPP compliance, pricing, and onboarding speed.",
    competitorSummary:
      "Scantrust is an established secure-QR and brand-protection platform focused on enterprise anti-counterfeiting.",
    rows: [
      {
        feature: "On-chain cryptographic anchoring",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Bitcoin L1 + Polygon finality",
        authichain: true,
        competitor: false,
      },
      {
        feature: "AI image analysis (5-agent consensus)",
        authichain: true,
        competitor: "Limited",
      },
      {
        feature: "EU Digital Product Passport export",
        authichain: true,
        competitor: true,
      },
      {
        feature: "Self-serve onboarding < 1 day",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Transparent public pricing",
        authichain: true,
        competitor: false,
      },
      {
        feature: "W3C Verifiable Credentials (you hold keys)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "NFT certificates of authenticity",
        authichain: true,
        competitor: false,
      },
      {
        feature: "No minimum enterprise contract",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Starts at",
        authichain: "$49/mo",
        competitor: "Enterprise quote",
      },
    ],
    reasons: [
      {
        title: "Tamper-Proof by Design",
        desc: "Every verification is anchored to Bitcoin L1 and Polygon — not a private database you have to trust. Scantrust relies on centralized cloud records that can be altered or lost.",
      },
      {
        title: "Live in a Day, Not a Quarter",
        desc: "Import your catalog and issue authenticated codes the same day. No sales gate, no 3–6 month integration project, no compliance consultant on retainer.",
      },
      {
        title: "Pricing You Can Actually See",
        desc: "Public plans from $49/mo with no minimum commitment. Scantrust hides pricing behind enterprise sales calls — you find out the cost after weeks of demos.",
      },
    ],
  },
  {
    slug: "circularise",
    competitor: "Circularise",
    title:
      "AuthiChain vs Circularise: Which Is Better for Product Authentication? (2026)",
    description:
      "AuthiChain vs Circularise compared — product authentication and EU DPP for every brand vs enterprise material-traceability.",
    competitorSummary:
      "Circularise is an enterprise blockchain platform focused on supply-chain transparency and material traceability for large manufacturers.",
    rows: [
      {
        feature: "Product authentication (anti-counterfeit)",
        authichain: true,
        competitor: "Limited",
      },
      {
        feature: "EU Digital Product Passport export",
        authichain: true,
        competitor: true,
      },
      {
        feature: "On-chain cryptographic anchoring",
        authichain: true,
        competitor: true,
      },
      { feature: "Bitcoin L1 finality", authichain: true, competitor: false },
      {
        feature: "AI image analysis (5-agent consensus)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Self-serve onboarding < 1 day",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Serves SMB + enterprise",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Transparent public pricing",
        authichain: true,
        competitor: false,
      },
      {
        feature: "NFT certificates of authenticity",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Starts at",
        authichain: "$49/mo",
        competitor: "Enterprise quote",
      },
    ],
    reasons: [
      {
        title: "Authentication + Compliance in One",
        desc: "Circularise specializes in material traceability for large manufacturers. AuthiChain covers both anti-counterfeit authentication and EU DPP compliance — for brands of any size.",
      },
      {
        title: "Open to Every Brand",
        desc: "No enterprise-only gate. A single-product luxury maker or a cannabis dispensary can self-serve onboard the same day as a Fortune 500 supply chain.",
      },
      {
        title: "Strongest Proof Layer",
        desc: "AI consensus plus dual anchoring on Polygon and Bitcoin L1 gives customs, auditors, and customers verifiable, tamper-proof provenance in a single scan.",
      },
    ],
  },
  {
    slug: "vechain",
    competitor: "VeChain",
    title:
      "AuthiChain vs VeChain: Which Is Better for Product Authentication? (2026)",
    description:
      "AuthiChain vs VeChain compared — turnkey product authentication vs a general-purpose L1 blockchain.",
    competitorSummary:
      "VeChain is a general-purpose enterprise L1 blockchain often used as infrastructure for supply-chain and authentication solutions.",
    rows: [
      {
        feature: "Turnkey product (no dev team required)",
        authichain: true,
        competitor: false,
      },
      { feature: "On-chain anchoring", authichain: true, competitor: true },
      { feature: "Bitcoin L1 finality", authichain: true, competitor: false },
      {
        feature: "AI image analysis (5-agent consensus)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "EU Digital Product Passport export",
        authichain: true,
        competitor: "Via partners",
      },
      {
        feature: "Self-serve onboarding < 1 day",
        authichain: true,
        competitor: false,
      },
      {
        feature: "No native token / crypto to buy",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Fiat pricing (USD, card)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "W3C Verifiable Credentials",
        authichain: true,
        competitor: "Partial",
      },
      {
        feature: "Starts at",
        authichain: "$49/mo",
        competitor: "Custom integration",
      },
    ],
    reasons: [
      {
        title: "A Product, Not a Protocol",
        desc: "VeChain is an L1 blockchain — you (or an integrator) build the authentication app on top. AuthiChain ships the finished product: scan, verify, certificate, done.",
      },
      {
        title: "No Token Volatility or Gas UX",
        desc: "Pay in USD with a card. No VET/VTHO to acquire, no wallet setup for your team or customers, no exposure to token price swings for your compliance budget.",
      },
      {
        title: "AI + Multi-Chain Assurance",
        desc: "Our goal: 5-agent AI consensus that screens every scan before it is anchored to both Polygon and Bitcoin L1, combining machine verification with the strongest settlement layer available.",
      },
    ],
  },
  {
    slug: "everledger",
    competitor: "Everledger",
    title:
      "AuthiChain vs Everledger: Which Is Better for Product Authentication? (2026)",
    description:
      "AuthiChain vs Everledger compared — self-serve, multi-industry product authentication and EU DPP export vs asset-registry provenance for diamonds, wine and luxury goods.",
    competitorSummary:
      "Everledger built blockchain provenance registries for high-value assets — diamonds, wine, fine art and luxury goods — with a registry-first model aimed at industry consortia.",
    rows: [
      {
        feature: "Self-serve signup (no consortium or sales gate)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Covers any product category",
        authichain: true,
        competitor: "High-value assets",
      },
      {
        feature: "On-chain cryptographic anchoring",
        authichain: true,
        competitor: true,
      },
      { feature: "Bitcoin L1 finality", authichain: true, competitor: false },
      {
        feature: "AI image analysis (5-agent consensus)",
        authichain: true,
        competitor: "Asset-specific",
      },
      {
        feature: "EU Digital Product Passport export",
        authichain: true,
        competitor: "Partial",
      },
      {
        feature: "W3C Verifiable Credentials (you hold keys)",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Customer-facing scan-to-verify page",
        authichain: true,
        competitor: "Via partners",
      },
      {
        feature: "Transparent public pricing",
        authichain: true,
        competitor: false,
      },
      {
        feature: "Starts at",
        authichain: "$49/mo",
        competitor: "Enterprise quote",
      },
    ],
    reasons: [
      {
        title: "Your Data Outlives Your Vendor",
        desc: "A provenance record is only as durable as the registry holding it. AuthiChain anchors the hash on public chains and issues W3C Verifiable Credentials you keep — so proof survives independently of any single company's registry.",
      },
      {
        title: "Every Category, Not Just Luxury",
        desc: "Registry-first provenance was built around diamonds, wine and fine art. AuthiChain authenticates any SKU — cannabis, pharma, parts, apparel — on the same rails, with the same one-day onboarding.",
      },
      {
        title: "No Consortium Required",
        desc: "Industry-registry models need the industry to join before the record is worth much. AuthiChain works for a single brand on day one, then composes upward as your suppliers join.",
      },
    ],
  },
];

/** Escapes text interpolated into these documents. */
function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[<>&"']/g,
    c =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

const VS_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Inter',system-ui,sans-serif;line-height:1.6}
a{color:${ACCENT};text-decoration:none}
.wrap{max-width:1040px;margin:0 auto;padding:0 1.5rem}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.5rem;border-bottom:1px solid #18181b;max-width:1040px;margin:0 auto}
.logo{font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff;font-size:1rem}
.hero{text-align:center;padding:5rem 0 3.5rem}
.badge{display:inline-block;border:1px solid ${ACCENT}55;color:${ACCENT};background:${ACCENT}12;border-radius:2rem;padding:.4rem 1rem;font-size:.65rem;font-weight:900;letter-spacing:.2em;text-transform:uppercase;margin-bottom:2rem}
h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:900;letter-spacing:-.02em;text-transform:uppercase;line-height:1.05;margin-bottom:1.5rem}
h1 .accent{color:${ACCENT}}
.lede{max-width:640px;margin:0 auto 2.5rem;color:#a1a1aa;font-size:1.02rem}
.cta{display:inline-flex;align-items:center;gap:.5rem;background:${ACCENT};color:#000;border-radius:.75rem;padding:1rem 2.25rem;font-size:.72rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
.cta.ghost{background:transparent;border:1px solid #27272a;color:#fff}
.ctas{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;border:1px solid #18181b;border-radius:1rem;overflow:hidden;margin-bottom:5rem}
th{background:#09090b;padding:1.1rem;font-size:.62rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#71717a;text-align:left}
th.ac{color:${ACCENT};text-align:center}
th.co{color:#a1a1aa;text-align:center}
td{padding:1.1rem;font-size:.86rem;color:#d4d4d8;border-top:1px solid #18181b}
td.c{text-align:center}
tr:nth-child(even) td{background:#09090b80}
.yes{color:${ACCENT};font-weight:800}
.no{color:#3f3f46;font-weight:800}
h2{font-size:clamp(1.5rem,3.5vw,2.2rem);font-weight:900;text-transform:uppercase;letter-spacing:-.02em;text-align:center;margin-bottom:1rem}
.reasons{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;margin:3rem 0 5rem}
.reason{border:1px solid #18181b;border-radius:1rem;padding:1.75rem;background:#09090b}
.reason h3{font-size:.82rem;font-weight:900;text-transform:uppercase;margin-bottom:.75rem}
.reason p{font-size:.85rem;color:#a1a1aa}
.index{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem;margin:3rem 0 5rem}
.card{border:1px solid #18181b;border-radius:1rem;padding:1.75rem;background:#09090b}
.card h3{font-size:1rem;font-weight:900;margin-bottom:.5rem}
.card p{font-size:.85rem;color:#a1a1aa;margin-bottom:1rem}
footer{border-top:1px solid #18181b;padding:3rem 1.5rem;text-align:center;color:#3f3f46;font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
`;

function shell(
  title: string,
  description: string,
  canonical: string,
  body: string
): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="https://authichain.govchain.us/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${VS_CSS}</style></head><body>
<div class="nav"><a href="/" class="logo">AuthiChain</a><a href="/vs">All comparisons</a></div>
${body}
<footer>AuthiChain &middot; Blockchain Product Authentication &middot; EU DPP Compliant &middot; Polygon &amp; Bitcoin Anchored</footer>
</body></html>`;
}

function cell(value: boolean | string): string {
  if (typeof value === "string") return esc(value);
  return value ? '<span class="yes">Yes</span>' : '<span class="no">No</span>';
}

/** Renders one head-to-head comparison page. */
export function renderVsPage(def: VsDefinition): string {
  const canonical = `https://authichain.govchain.us/vs/${def.slug}`;
  const rows = def.rows
    .map(
      r =>
        `<tr><td>${esc(r.feature)}</td><td class="c">${cell(r.authichain)}</td><td class="c">${cell(r.competitor)}</td></tr>`
    )
    .join("");
  const reasons = def.reasons
    .map(
      r =>
        `<div class="reason"><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p></div>`
    )
    .join("");

  // A BreadcrumbList mirrors what the Next page emitted via JsonLd, so the
  // worker-served page is not a downgrade for structured data.
  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://authichain.govchain.us",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Compare",
        item: "https://authichain.govchain.us/vs",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `AuthiChain vs ${def.competitor}`,
        item: canonical,
      },
    ],
  });

  return shell(
    def.title,
    def.description,
    canonical,
    `<script type="application/ld+json">${breadcrumb}</script>
<div class="wrap">
<section class="hero">
  <span class="badge">Head-to-Head Comparison</span>
  <h1>AuthiChain vs ${esc(def.competitor)}:<br><span class="accent">Which Is Better for Product Authentication?</span></h1>
  <p class="lede">${esc(def.competitorSummary)} Below is a feature-by-feature comparison so you can decide which platform fits your supply chain, budget, and compliance timeline.</p>
  <div class="ctas"><a class="cta" href="${esc(planPaymentLink("dpp_readiness") ?? "/digital-product-passport")}">Pay $299 on Stripe</a><a class="cta ghost" href="/anchor">See Live Demo</a></div>
</section>
<table>
  <thead><tr><th>Feature</th><th class="ac">AuthiChain</th><th class="co">${esc(def.competitor)}</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<h2>Why Brands Choose <span style="color:${ACCENT}">AuthiChain</span></h2>
<div class="reasons">${reasons}</div>
</div>`
  );
}

/** Renders the /vs index listing every comparison. */
export function renderVsIndex(): string {
  const cards = VS_PAGES.map(
    d =>
      `<div class="card"><h3>AuthiChain vs ${esc(d.competitor)}</h3><p>${esc(d.competitorSummary)}</p><a href="/vs/${esc(d.slug)}">Read the comparison &rarr;</a></div>`
  ).join("");

  return shell(
    "Compare AuthiChain — Product Authentication Platforms Side by Side",
    "Honest, feature-by-feature comparisons of AuthiChain against Scantrust, Circularise, VeChain and Everledger.",
    "https://authichain.govchain.us/vs",
    `<div class="wrap">
<section class="hero">
  <span class="badge">Comparisons</span>
  <h1>Compare <span class="accent">AuthiChain</span></h1>
  <p class="lede">Feature-by-feature comparisons against the platforms brands most often evaluate alongside AuthiChain.</p>
</section>
<div class="index">${cards}</div>
</div>`
  );
}

/** Looks up a comparison by slug, or null when there is no such page. */
export function findVsPage(slug: string): VsDefinition | null {
  return VS_PAGES.find(d => d.slug === slug.toLowerCase()) ?? null;
}

/** Every URL this module serves — used to build the sitemap. */
export function vsUrls(): string[] {
  return [
    "https://authichain.govchain.us/vs",
    ...VS_PAGES.map(d => `https://authichain.govchain.us/vs/${d.slug}`),
  ];
}
