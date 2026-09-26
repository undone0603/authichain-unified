/**
 * Public manufacturer article: EU DPP / product authentication positioning.
 *
 * authichain.com 404s unknown paths. This page must be served here (not only
 * as a content/ markdown draft) or it is unreachable. Checkout CTA is the
 * live DPP checkout rail — do not invent a demo calendar or AuthiChain Inc.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCtaBand,
  estateCssVars,
  estateFooter,
  estateHero,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";

export const DPP_CHECKOUT = "https://authichain.com/checkout/dpp_readiness";
export const DPP_MANUFACTURER_ARTICLE_PATH = "/blog/eu-dpp-manufacturer";
export const DPP_MANUFACTURER_ARTICLE_CANONICAL = `https://authichain.com${DPP_MANUFACTURER_ARTICLE_PATH}`;

const ARTICLE_PATHS = new Set([
  DPP_MANUFACTURER_ARTICLE_PATH,
  `${DPP_MANUFACTURER_ARTICLE_PATH}/`,
]);

export function isDppManufacturerArticlePath(pathname: string): boolean {
  return ARTICLE_PATHS.has(pathname);
}

const ARTICLE_CSS = `
.article-wrap { max-width: 760px; }
.article-prose p, .article-prose li { color: var(--text); line-height: 1.7; }
.article-prose p { margin: 0 0 1rem; }
.article-prose h2 { margin: 2.25rem 0 0.75rem; font-size: 1.45rem; }
.article-prose h3 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
.article-prose ul { margin: 0 0 1.25rem 1.2rem; }
.article-prose li { margin: 0.35rem 0; }
.article-prose table { width: 100%; border-collapse: collapse; margin: 1.25rem 0 1.75rem; font-size: 0.95rem; }
.article-prose th, .article-prose td { border: 1px solid var(--border); padding: 10px 12px; text-align: left; vertical-align: top; }
.article-prose th { background: var(--bg2); font-weight: 650; }
.article-prose blockquote { margin: 1.5rem 0; padding: 12px 16px; border-left: 3px solid var(--accent); background: var(--accent-soft); }
.article-note { font-size: 0.92rem; color: var(--text-dim); }
`;

function pageShell(opts: {
  title: string;
  description: string;
  canonical: string;
  keywords: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <meta name="description" content="${opts.description}">
  <meta name="keywords" content="${opts.keywords}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${opts.canonical}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${opts.title}">
  <meta property="og:description" content="${opts.description}">
  <meta property="og:url" content="${opts.canonical}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: opts.canonical,
    publisher: {
      "@type": "Organization",
      name: "AuthiChain",
      url: "https://authichain.com",
    },
  }).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    ${ARTICLE_CSS}
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${opts.body}
</body>
</html>`;
}

export function renderDppManufacturerArticle(): string {
  return pageShell({
    title:
      "Why AuthiChain Is Built for Digital Product Passports, Product Authentication, and Brand Protection",
    description:
      "A manufacturer-focused perspective on EU digital product passport readiness and item-level identity.",
    canonical: DPP_MANUFACTURER_ARTICLE_CANONICAL,
    keywords:
      "digital product passport platform, blockchain product authentication, brand protection, anti-counterfeit verification, QR code product provenance, EU DPP manufacturers",
    body: `${estateNav(
      "authichain",
      [
        { href: "/dpp", label: "EU DPP" },
        { href: "/pricing", label: "Pricing" },
        { href: "/contact", label: "Contact" },
      ],
      { href: "/pricing", label: "View pricing" }
    )}
<main id="main">
  ${estateHero({
    eyebrow:
      "Digital Product Passports · Brand Protection · Blockchain Authentication",
    title:
      "Why AuthiChain is built for the next generation of product trust infrastructure",
    lede: "Digital product passports are moving from concept to requirement. Brands now need a way to authenticate products, preserve provenance, support compliance narratives, and give every scan a consumer-facing trust experience.",
    emailCheckout: {
      action: DPP_CHECKOUT,
      label: "Start DPP checkout",
    },
    actions: [{ href: "/pricing", label: "View pricing", primary: false }],
  })}
  <section class="estate-section" id="article">
    <div class="wrap article-wrap article-prose">
      <h2>What this article covers</h2>
      <ul>
        <li>Why item-level identity matters for anti-counterfeit and traceability.</li>
        <li>How AuthiChain can position itself as a more agile, product-first platform.</li>
      </ul>
      <table>
        <thead><tr><th>Focus</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><th>1 product</th><td>1 digital identity with verifiable history</td></tr>
          <tr><th>1 scan</th><td>A single QR or touchpoint can connect verification, provenance, and engagement</td></tr>
          <tr><th>1 platform</th><td>Authentication, traceability, and digital passport experiences should live together</td></tr>
        </tbody>
      </table>

      <h2>Market context — Product trust is becoming a systems problem</h2>
      <p>Modern brands are under pressure from counterfeit risk, fragmented supplier data, sustainability scrutiny, and customer demand for proof rather than promises. That changes authentication from a packaging feature into a core data infrastructure problem.</p>
      <p>A credible digital product passport must connect physical goods to persistent digital records, preserve important events across the product lifecycle, and expose the right information to the right audience at the right moment.</p>
      <p>The technical challenge is not just storing data; it is establishing a trustworthy product identity that can survive handoffs, audits, resale, and consumer verification.</p>
      <p class="article-note">Regulatory peg (first-party plan notes, not legal advice): EU batteries DPP obligations ramp toward <strong>18 Feb 2027</strong> (Battery Regulation Art. 77); DPP Registry context mid-2026. Confirm against current Commission / ESPR materials before any compliance claim in outbound mail.</p>

      <h2>Early provenance registries (2016–2023)</h2><p>Everledger (2016–2023) was an early blockchain provenance company, best known for diamonds. Its operating companies entered liquidation in 2023.</p>

      <h2>Strategic angle — Sell outcomes, not “we also use blockchain”</h2>
      <p>The strongest positioning is not “we also use blockchain.” The stronger message is that AuthiChain helps a brand:</p>
      <ol>
        <li><strong>Authentication</strong> — Give every item a verifiable identity linked to a secure digital record.</li>
        <li><strong>Traceability</strong> — Capture manufacturing, logistics, ownership, and product lifecycle events.</li>
        <li><strong>Compliance readiness</strong> — Structure product data so it can support evolving digital passport and regulatory demands.</li>
        <li><strong>Consumer trust</strong> — Turn each verification scan into a proof point, not a dead-end serial number check.</li>
      </ol>
      <p>Instead of treating trust as a back-office reporting layer, AuthiChain frames it as a live product interface. A scanned code should not just reference a database entry; it should prove the item, expose its story, and create a trusted connection between brand, buyer, and product lifecycle data.</p>

      <h2>Positioning summary</h2>
      <p>AuthiChain wins when the story is simple: give each product a trusted identity, make every scan meaningful, and let the passport experience carry authentication, provenance, and engagement together.</p>
      <blockquote>“From provenance records to product-facing trust interfaces, the next competitive layer is not only traceability. It is usability.”</blockquote>
    </div>
  </section>
  ${estateCtaBand({
    title: "Build your product passport stack on AuthiChain",
    lede: "If your brand needs verifiable authentication, QR-linked product identity, and a digital product passport foundation that can scale into traceability and compliance, start with the live DPP checkout. Enter a work email so Stripe can recover the cart. Self-serve; no demo calendar required.",
    emailCheckout: {
      action: DPP_CHECKOUT,
      label: "Start DPP checkout",
    },
    actions: [
      { href: "/pricing", label: "View pricing", primary: false },
      {
        href: "/pricing",
        label: "Genetics passport — $49",
        primary: false,
      },
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
      heading: "Read",
      links: [
        { href: DPP_MANUFACTURER_ARTICLE_PATH, label: "Manufacturer article" },
        { href: "/dpp", label: "EU DPP" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/contact", label: "Contact" },
        { href: "/x402", label: "x402" },
      ],
    },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. No call booking — checkout or a written packet."
)}`,
  });
}

export function tryHandleDppManufacturerArticle(
  request: Request
): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isDppManufacturerArticlePath(new URL(request.url).pathname)) return null;
  return new Response(renderDppManufacturerArticle(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}
