/**
 * Public positioning page at /authentic-agentic-economy.
 *
 * AuthiChain's own brand is "the Authentic Economy". The industry term is
 * "the agentic economy". This page is the join: agents can already pay and
 * call tools; they still need a machine-verifiable check that a physical
 * product, passport, or claim is real. Only live estate capabilities are
 * claimed. External papers are labeled as context, not AuthiChain research.
 */

import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCtaBand,
  estateCssVars,
  estateFeatures,
  estateFooter,
  estateHero,
  estateNav,
  estateSkipLink,
  estateSteps,
  estateTrust,
} from "../../_shared/estate-landing.ts";

export const AUTHENTIC_AGENTIC_ECONOMY_PATHS = [
  "/authentic-agentic-economy",
  "/authentic-agentic-economy/",
] as const;

export const AUTHENTIC_AGENTIC_ECONOMY = {
  canonicalPath: "/authentic-agentic-economy",
  canonicalUrl: "https://authichain.com/authentic-agentic-economy",
  title: "The authentic agentic economy — AuthiChain",
  description:
    "AuthiChain is the authentic agentic economy: signed seals, 5-agent consensus, MCP tools, and x402 pay-per-call so agents can trust physical products.",
} as const;

export function isAuthenticAgenticEconomyPath(pathname: string): boolean {
  return (AUTHENTIC_AGENTIC_ECONOMY_PATHS as readonly string[]).includes(
    pathname
  );
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

const PAGE_CSS = `${estateCssVars("authichain")}
${ESTATE_BASE_CSS}
.sources { padding: 56px 20px; }
.sources .wrap { max-width: 1120px; }
.sources ul { list-style: none; display: grid; gap: 12px; margin-top: 24px; }
.sources li { border: 1px solid var(--border); border-radius: var(--radius); padding: 1.15rem 1.25rem; background: var(--bg); }
.sources li a { font-weight: 600; }
.sources .cite { display: block; color: var(--text-dim); font-size: .92rem; margin-top: .35rem; }
`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://authichain.com/#organization",
      name: "AuthiChain",
      url: "https://authichain.com",
      slogan: "The authentic agentic economy",
      description: AUTHENTIC_AGENTIC_ECONOMY.description,
    },
    {
      "@type": "WebPage",
      "@id": `${AUTHENTIC_AGENTIC_ECONOMY.canonicalUrl}#webpage`,
      url: AUTHENTIC_AGENTIC_ECONOMY.canonicalUrl,
      name: AUTHENTIC_AGENTIC_ECONOMY.title,
      description: AUTHENTIC_AGENTIC_ECONOMY.description,
      isPartOf: { "@id": "https://authichain.com/#organization" },
    },
    {
      "@type": "Article",
      headline: "The authentic agentic economy",
      description: AUTHENTIC_AGENTIC_ECONOMY.description,
      url: AUTHENTIC_AGENTIC_ECONOMY.canonicalUrl,
      author: { "@type": "Organization", name: "AuthiChain" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the authentic agentic economy?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Agents can already pay and call tools. They still need a machine-verifiable check that a physical product, passport, or claim is real. AuthiChain is that check: signed seals, 5-agent consensus, MCP tools, and x402 pay-per-call verification.",
          },
        },
        {
          "@type": "Question",
          name: "How do agents pay AuthiChain?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Funded agents verify a product for $0.05 USDC on Base via the live x402 rail — not Polygon $QRON. Unpaid POST /api/x402 returns HTTP 402. Public docs are at /x402. The human money path remains EU DPP Readiness on Stripe.",
          },
        },
        {
          "@type": "Question",
          name: "Does this replace a Digital Product Passport for people?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Humans still enroll and activate DPP Readiness. The same certificate is what an agent should query before it transacts, so the passport is machine-readable rather than a PDF for humans only.",
          },
        },
      ],
    },
  ],
};

function sources(): string {
  const items: Array<{ href: string; title: string; cite: string }> = [
    {
      href: "https://arxiv.org/abs/2602.14219",
      title:
        "The Agent Economy: A Blockchain-Based Foundation for Autonomous AI Agents",
      cite: "Xu (2026), arXiv:2602.14219. Identity, MCP tooling, and settlement as layers an agent economy needs — not an AuthiChain paper.",
    },
    {
      href: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6068907",
      title: "Digital Product Passports as Agentic Supply Chain Infrastructure",
      cite: "Teikari & Fuenmayor (2026), SSRN 6068907. DPPs have to be machine-queryable or purchasing agents cannot trust sustainability and authenticity claims.",
    },
    {
      href: "https://github.com/erc-8004/erc-8004-contracts/blob/master/ERC8004SPEC.md",
      title: "ERC-8004: Trustless Agents",
      cite: "On-chain identity, reputation, and validation registries for agents. AuthiChain's product certificates are the physical-world authenticity counterpart, not an ERC-8004 implementation claim.",
    },
    {
      href: "https://www.galaxy.com/insights/research/zero-human-companies-ai-agents-defi-crypto",
      title: "Agentic Capital Markets / zero-human companies",
      cite: "Galaxy (2026). Agents as economic actors still need a fact layer before they spend. AuthiChain is that layer for physical goods.",
    },
    {
      href: "https://authichain.govchain.us/x402",
      title: "AuthiChain x402 agent pay (live)",
      cite: "Estate capability: $0.05 USDC on Base per verification. Health at GET /api/x402/health. Unpaid POST returns HTTP 402.",
    },
  ];
  const lis = items
    .map(
      it =>
        `<li><a href="${esc(it.href)}">${esc(it.title)}</a><span class="cite">${esc(it.cite)}</span></li>`
    )
    .join("");
  return `<section class="sources estate-section" id="sources">
  <div class="wrap">
    <p class="section-tag">Sources</p>
    <h2>Public research this category sits in</h2>
    <p class="section-sub">These are not AuthiChain whitepapers. They describe the gap: agents need identity, settlement, and a way to check physical-world claims. AuthiChain ships the authenticity check.</p>
    <ul>${lis}</ul>
  </div>
</section>`;
}

/** Renders the authentic agentic economy page. */
export function renderAuthenticAgenticEconomyPage(): string {
  const p = AUTHENTIC_AGENTIC_ECONOMY;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(p.canonicalUrl)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#4F46E5">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(p.canonicalUrl)}">
<meta property="og:image" content="https://authichain.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<script type="application/ld+json">${JSON.stringify(JSON_LD).replace(/<\/script/gi, "<\\/script")}</script>
${ESTATE_FONTS_LINK}
<style>
${PAGE_CSS}
</style>
</head>
<body>
${estateSkipLink()}
${estateNav(
  "authichain",
  [
    { href: "/authentic-agentic-economy", label: "Agentic economy" },
    { href: "/x402", label: "x402" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
  ],
  { href: "/pricing", label: "View pricing" }
)}
<main id="main">
${estateHero({
  eyebrow: "The authentic agentic economy",
  title: "Agents can pay. They still need to know if it is real.",
  lede: "AuthiChain is the authenticity layer for the agentic economy: signed seals on Polygon, 5-agent consensus, MCP tools, and x402 pay-per-call verification. The human money path is EU DPP Readiness — live Stripe checkout at $299.",
  emailCheckout: {
    action: "https://authichain.com/checkout/dpp_readiness",
    label: "Start DPP checkout — $299",
  },
  actions: [
    { href: "/x402", label: "x402 agent pay", primary: false },
    { href: "/onboard", label: "Onboard", primary: false },
  ],
})}
${estateTrust([
  { value: "Ed25519", label: "Signed seals" },
  { value: "Polygon", label: "On-chain anchor" },
  { value: "$0.05", label: "x402 per verify" },
])}
${estateFeatures(
  "What is live on this estate",
  "Claims limited to capabilities that already run. No invented customer logos, no promised mint that is not deployed.",
  [
    {
      title: "Signed seals",
      body: "Cryptographic digital seals anchored on Polygon. Tamper-evident and publicly verifiable from /anchor and the certificate registry.",
    },
    {
      title: "5-agent consensus",
      body: "Guardian, Archivist, Sentinel, Scout, and Arbiter reach weighted consensus in 2.1 seconds. A single compromised reading does not stand alone.",
    },
    {
      title: "MCP tools",
      body: "The in-repo AuthiChain MCP server lets an agent verify authenticity, classify a product, and request a paid verification. Distribution is the MCP surface, not a new product.",
    },
    {
      title: "x402 agent pay",
      body: "Secondary money path. Funded agents verify a product for $0.05 USDC on Base. Unpaid POST /api/x402 returns HTTP 402. Public docs at /x402.",
    },
    {
      title: "EU DPP Readiness",
      body: "Primary human money path. EU DPP Readiness is $299 on the published Stripe Payment Link, or enter a work email so Stripe can recover the cart. Credited toward AuthiChain Basic on conversion.",
    },
    {
      title: "Machine-readable passports",
      body: "A Digital Product Passport that only a person can read is invisible to purchasing agents. The same AuthiChain certificate is what an agent should query before it transacts.",
    },
  ],
  "live"
)}
${estateSteps(
  "How an agent uses AuthiChain",
  "Three realized steps. Wallet funding and KYC stay with the legal owner of the paying wallet.",
  [
    {
      title: "Call",
      body: "The agent hits MCP verify tools or POST /api/x402 with a seal or product identifier. No API key is required for the unpaid 402 challenge.",
    },
    {
      title: "Pay",
      body: "If the call is metered, the edge returns HTTP 402 with the Base USDC requirement. The agent settles $0.05 and retries with X-PAYMENT.",
    },
    {
      title: "Act",
      body: "A signed authenticity result is the input to the agent's next action — accept the goods, refuse the listing, or escalate to a human.",
    },
  ],
  "how"
)}
${sources()}
${estateCtaBand({
  title: "Start on a live path",
  lede: "Humans enroll DPP Readiness. Agents pay per verification on x402. Same authenticity layer. Enter a work email so Stripe can recover the cart.",
  emailCheckout: {
    action: "https://authichain.com/checkout/dpp_readiness",
    label: "Start DPP checkout",
  },
  actions: [
    { href: "/x402", label: "x402 agent pay", primary: false },
    { href: "/pricing", label: "View pricing", primary: false },
  ],
})}
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: "/pricing", label: "DPP checkout" },
        { href: "/pricing", label: "Pricing" },
        { href: "/onboard", label: "Onboard" },
      ],
    },
    {
      heading: "Agents",
      links: [
        {
          href: "/authentic-agentic-economy",
          label: "Authentic agentic economy",
        },
        { href: "/x402", label: "x402 agent pay" },
        { href: "/protocol", label: "Open protocol" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/contact", label: "Contact" },
        { href: "/digital-product-passport", label: "EU DPP" },
        { href: "/vs", label: "Compare" },
      ],
    },
  ],
  "Polygon · ERC-721 · x402 · EU DPP"
)}
</body>
</html>`;
}
