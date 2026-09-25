// The DPP regulatory timeline is shared with the Next.js page rather than
// duplicated here: content/dpp/regulatory-timeline.json is the single source of
// truth, updated weekly by the 'EU DPP regulatory watch' Routine. esbuild
// inlines it at build time, so the worker stays self-contained at runtime.
import { tryHandleDppRoute } from "./dpp-routes";
import {
  tryHandleApiCheckoutEmailGate,
  tryHandleProtocolCheckout,
} from "./protocol-checkout";
import { tryHandleAppHost, tryHandleX402 } from "./x402-routes";
import { tryHandleMcp } from "./mcp-routes";
import { isX402DocsPath, renderX402DocsPage } from "./x402-docs-page";
import {
  isAuthenticAgenticEconomyPath,
  renderAuthenticAgenticEconomyPage,
} from "./authentic-agentic-economy-page";
import { APP_PREFIXES } from "./app-prefixes";
import { tryHandleGeneticsRoutes } from "./genetics-routes";
import { findVsPage, renderVsIndex, renderVsPage, vsUrls } from "./vs-pages.ts";
import { renderContactPage } from "./contact-page.ts";
import {
  isMadeInAmericaPath,
  isTrumarkPath,
  renderMadeInAmericaPage,
  renderTrumarkPage,
} from "./money-surfaces.ts";
import {
  MINIAPP_CANONICAL,
  tryHandleTelegramMiniApp,
} from "./telegram-miniapp.ts";
import { DESK_SITEMAP, tryHandleDesk } from "./desk.ts";
import { tryHandleLlmsTxt } from "./llms-txt.ts";
import { tryHandle402IndexVerify } from "./index402-verify.ts";
import {
  isDppManufacturerArticlePath,
  renderDppManufacturerArticle,
} from "./dpp-manufacturer-article.ts";
import {
  isBatteryPassportPath,
  renderBatteryPassportPage,
} from "./battery-passport-page.ts";
import {
  micrositeSitemapUrls,
  tryHandleMicrosite,
} from "./microsite-routes.ts";
import { icpSeoSitemapUrls } from "./icp-seo-sitemap.ts";
import { withApolloTracker } from "./apollo-tracker.ts";
import {
  listMilestones,
  milestoneStatus,
  formatMilestoneDate,
  countdownLabel,
  nextDeadline,
  mostRecentInForce,
  timelineUpdatedAt,
} from '../../../src/lib/dpp-timeline';
import { catalogPaymentLinkHtml, checkoutEmailFormHtml, CHECKOUT_EMAIL_FORM_CSS, emailCheckoutWithPaymentLinkHtml, rewriteProxiedCheckoutHtml } from "../../../src/lib/checkout-email";
import { planById, planPaymentLink, type PlanId } from "../../../src/lib/plans";
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
  tryHandleEstateIndexNow,
} from '../../_shared/estate-landing.ts';
import { tryHandleEstatePricing } from '../../_shared/estate-pricing.ts';
import { tryRedirectSeoRootCanonical } from '../../_shared/seo-hub-routes.ts';

/**
 * Escapes text interpolated into the worker's HTML. The timeline data is
 * written by an autonomous Routine, so it is treated as untrusted input even
 * though it lives in our own repository.
 */
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inlined Authichain Theme Module for Cloudflare Worker compatibility

const HTML_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Landing HTML must not be stored as /api/* (CF cache HIT was serving the
  // homepage for checkout and cron, so DPP-SMOKE-E2E never reached Stripe).
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
};

const BRANDS = {
  authichain: {
    name: 'AuthiChain',
    tagline: 'The authentic agentic economy',
    primary: '#4F46E5',
    primaryDim: '#4F46E5',
    secondary: '#7C3AED',
    bg: '#ffffff',
    bg2: '#f8fafc',
    bg3: '#f1f5f9',
    text: '#0f172a',
    textDim: '#475569',
    border: '#e2e8f0',
    borderDim: '#e2e8f0',
    glowRgba: 'transparent',
    logoMark: 'AC',
        accent: '#4F46E5',
    url: 'https://authichain.govchain.us',
  }
};

const FONTS_LINK = ESTATE_FONTS_LINK;

// SEO meta + JSON-LD. Brand-specific. Replaces what was previously a sparse
// <head> (charset/viewport/title/fonts only) — Googlebot now sees a full
// description, OG/Twitter cards, canonical, favicon, theme-color, and three
// structured-data blocks (Organization, WebSite, FAQPage).
const SEO = {
  description:
    'AuthiChain: product seals, EU DPP Readiness on Stripe checkout, and x402 pay-per-call for agents. In development: signed, publicly verifiable certificates and 5-agent consensus verification.',
  keywords:
    'authentic agentic economy, agentic economy, product authentication, digital product passport, EU DPP, x402, MCP, blockchain verification, Living QR, QRON, GovChain, StrainChain',
  ogTitle: 'AuthiChain — The authentic agentic economy',
  ogDescription:
    'Agents can pay. They still need to know if it is real. Signed seals, MCP tools, x402 at $0.05 USDC, and EU DPP Readiness on live Stripe checkout.',
  twitterTitle: 'AuthiChain — The authentic agentic economy',
  twitterDescription:
    'The authenticity layer for the agentic economy. Issue → Bind → Verify. x402 for agents. DPP Readiness for humans.',
  ogImage: 'https://authichain.govchain.us/og-image.png',
  themeColor: '#4F46E5',
  faqs: [
    {
      q: 'How does AuthiChain verify a product?',
      a: 'Issue a cryptographically signed seal, bind it to the physical item, then verify from any camera against the on-chain record.',
    },
    {
      q: 'How much does AuthiChain cost?',
      a: `The first checkout is QRON Starter at $29 at ${planPaymentLink("starter") ?? ""}. StrainChain Passport is $49 at ${planPaymentLink("strainchain_passport") ?? ""}. EU DPP Readiness stays $299 at ${planPaymentLink("dpp_readiness") ?? ""} (or enter a work email so Stripe can recover that cart). Creator is $99 at ${planPaymentLink("creator") ?? ""}. See /pricing.`,
    },
    {
      q: 'What is EU DPP Readiness?',
      a: 'A one-time readiness audit with self-serve activation and 50 workspace generations to publish a first Digital Product Passport. The $299 is credited toward AuthiChain Basic on conversion.',
    },
    {
      q: 'What else is live in the estate?',
      a: 'QRON Living QR generation on qron.space/generate, GovChain intake on govchain.us/onboard, StrainChain intake on strainchain.io/onboard, and x402 agent micropayments on /x402.',
    },
    {
      q: 'What is the authentic agentic economy?',
      a: 'Agents can already pay and call tools. They still need a machine-verifiable check that a physical product is real. AuthiChain is that check — signed seals, 5-agent consensus, MCP tools, and x402 pay-per-call verification.',
    },
  ],
};

// Brand visual assets served by the worker. SVG was chosen so a single
// vector source renders crisp at every size (favicon → 16×16, OG image
// → 1200×630). Some social platforms (Twitter, FB) prefer PNG/JPG for
// share cards — if those become important, drop a PNG into a /og.png
// route alongside this without needing other changes. Discord, Slack,
// LinkedIn, GitHub all render SVG OG images correctly.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <path d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z" fill="#1a1a2e"/>
  <path d="M32 8L12 18v14c0 12.4 8.84 24.04 20 27.6 11.16-3.56 20-15.2 20-27.6V18L32 8z" fill="#16213e"/>
  <rect x="22" y="24" width="8" height="4" rx="2" fill="#4fc3f7"/>
  <rect x="34" y="24" width="8" height="4" rx="2" fill="#4fc3f7"/>
  <rect x="28" y="22" width="4" height="8" rx="2" fill="#4fc3f7" opacity="0.7"/>
  <path d="M24 36l6 6 10-12" stroke="#00e676" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="32" cy="32" r="20" stroke="#4fc3f7" stroke-width="0.5" opacity="0.3" fill="none"/>
</svg>`;

const OG_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050507"/>
      <stop offset="100%" stop-color="#12121a"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#d4af37" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="624" width="1200" height="6" fill="#d4af37"/>
  <g stroke="#d4af37" stroke-width="2" stroke-opacity="0.4" fill="none">
    <path d="M40 40h40M40 40v40"/>
    <path d="M1160 40h-40M1160 40v40"/>
    <path d="M40 590h40M40 590v-40"/>
    <path d="M1160 590h-40M1160 590v-40"/>
  </g>
  <g transform="translate(110, 110) scale(2.6)">
    <path d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z" fill="#1a1a2e"/>
    <path d="M32 8L12 18v14c0 12.4 8.84 24.04 20 27.6 11.16-3.56 20-15.2 20-27.6V18L32 8z" fill="#16213e"/>
    <rect x="22" y="24" width="8" height="4" rx="2" fill="#4fc3f7"/>
    <rect x="34" y="24" width="8" height="4" rx="2" fill="#4fc3f7"/>
    <rect x="28" y="22" width="4" height="8" rx="2" fill="#4fc3f7" opacity="0.7"/>
    <path d="M24 36l6 6 10-12" stroke="#00e676" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="32" cy="32" r="20" stroke="#4fc3f7" stroke-width="0.5" opacity="0.3" fill="none"/>
  </g>
  <text x="110" y="385" font-family="'Bebas Neue','Helvetica Neue',Arial,sans-serif" font-size="104" font-weight="700" letter-spacing="6" fill="#f8fafc">AUTHICHAIN</text>
  <line x1="110" y1="412" x2="280" y2="412" stroke="#d4af37" stroke-width="3"/>
  <text x="110" y="468" font-family="'Outfit','Helvetica Neue',Arial,sans-serif" font-size="32" font-weight="300" fill="#94a3b8">The authentic agentic economy</text>
  <text x="110" y="510" font-family="'Outfit','Helvetica Neue',Arial,sans-serif" font-size="19" font-weight="300" fill="#94a3b8" opacity="0.75">Product seals and EU DPP readiness · Certificate contract live on Polygon · Multi-agent verification on our roadmap</text>
  <text x="1160" y="595" text-anchor="end" font-family="'JetBrains Mono','Courier New',monospace" font-size="20" letter-spacing="3" fill="#d4af37">AUTHICHAIN.COM</text>
</svg>`;

function assetResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

// __OG_PNG_B64_START__
const OG_IMAGE_PNG_B64 =
  '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' +
  'sgAAAABJRU5ErkJggg=='
;
// __OG_PNG_B64_END__

function pngResponse(b64: string): Response {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** JSON-LD Offer.url for crawlers. Payment Link only — never GET checkout. */
function catalogJsonLdOffer(id: PlanId) {
  const plan = planById(id);
  const offerUrl = planPaymentLink(id);
  if (!plan || !offerUrl) return null;
  return {
    '@type': 'Offer' as const,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    priceCurrency: 'USD',
    url: offerUrl,
  };
}

function seoMeta(): string {
  const url = BRANDS.authichain.url;
  const title = `${BRANDS.authichain.name} — ${BRANDS.authichain.tagline}`;
  const ld = (obj: object) =>
    `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/script/gi, '<\\/script')}</script>`;
  const makesOffer = (
    [
      'starter',
      'strainchain_passport',
      'creator',
      'dpp_readiness',
    ] as const
  )
    .map(catalogJsonLdOffer)
    .filter((o): o is NonNullable<typeof o> => o !== null);
  return `
  <meta name="description" content="${SEO.description}">
  <meta name="keywords" content="${SEO.keywords}">
  <meta name="theme-color" content="${SEO.themeColor}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}/">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${BRANDS.authichain.name}">
  <meta property="og:title" content="${SEO.ogTitle}">
  <meta property="og:description" content="${SEO.ogDescription}">
  <meta property="og:url" content="${url}/">
  <meta property="og:image" content="${SEO.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${SEO.twitterTitle}">
  <meta name="twitter:description" content="${SEO.twitterDescription}">
  <meta name="twitter:image" content="${SEO.ogImage}">
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRANDS.authichain.name,
    url,
    logo: `${url}/favicon.svg`,
    description: SEO.description,
    slogan: 'The authentic agentic economy',
    sameAs: [
      'https://twitter.com/authichain',
      'https://www.linkedin.com/company/authichain',
      'https://github.com/AuthiChain2026',
    ],
    makesOffer,
  })}
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRANDS.authichain.name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  })}
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SEO.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })}`;
}

function svgLogo(brand: keyof typeof BRANDS, size = 36) {
  const b = BRANDS[brand];
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <path d="M12,22 L18,12 L24,22 M14.5,19 L21.5,19" stroke="${b.primary}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M20,14 Q26,16 24,22" stroke="${b.secondary}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
    </svg>`;
}

function cssVars(_brand: keyof typeof BRANDS) {
  return estateCssVars('authichain');
}

const BASE_CSS = ESTATE_BASE_CSS + `
.estate-verify {
  padding: 56px 20px;
}
.estate-verify .wrap { max-width: 1120px; }
.estate-verify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 24px 0;
}
.estate-verify-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
`;

function communityHub(_brand: keyof typeof BRANDS) {
  return estateFeatures(
    "Ecosystem utilities",
    "QRON sits beside AuthiChain certificates when you need a living QR. Bitcoin Ordinals provenance for high-value certificates is in development.",
    [
      { title: "$QRON token", body: "Polygon ERC-20 (1B supply). Speculative utility — not a payment rail. Live agent pay is $0.05 Circle USDC on Base. Living QR packs are Stripe on qron.space." },
      { title: "Bitcoin Ordinals", body: "On our roadmap: Bitcoin Ordinals inscriptions for certificates." },
      { title: "Living QR", body: "Generate a signed, redirectable QR on qron.space when packaging needs a scannable identity." },
    ],
    "community",
  );
}

function foundersVision() {
  return `
<section class="estate-section" style="background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
  <div class="wrap" style="max-width:760px">
    <p class="section-tag">What is live</p>
    <h2>Realized capability, not a pitch deck</h2>
    <p class="section-sub">AuthiChain issues seals and binds them to products, and every scan is logged against the serial. Public verification is in development. The money path is EU DPP Readiness.</p>
  </div>
</section>`;
}

function howItWorks() {
  return estateSteps(
    "How it works",
    "Three steps that already exist on this estate. No new product surface.",
    [
      { title: "Issue", body: "Issue a seal for the product. AuthiChain's certificate contract is live on Polygon https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE. In development: Ed25519-signed certificates anchored to that contract." },
      { title: "Bind", body: "Bind the seal to the physical item — a Living QR, a passport, or a package label that can change destination without a reprint." },
      { title: "Verify", body: "Every scan is logged against the serial. Our goal: anyone with a camera can confirm authenticity against the public on-chain record. Goal: flag duplicate scans, cloned or copied seals, and unexpected scan locations for a serial." },
    ],
    "how",
  );
}

function estatePillars() {
  return estateFeatures(
    "Estate pillars",
    "Sister brands convert on paths that already work. No invented customer logos.",
    [
      { title: "QRON", body: "Living QR codes that still scan. Generate on qron.space/generate — the first-dollar path for packaging and labels." },
      { title: "GovChain", body: "Federal contract intelligence intake. Start on govchain.us/onboard. This page does not promise a live government mint." },
      { title: "StrainChain", body: "Seed-to-sale provenance and genetics passports. Start on strainchain.io/onboard. Totals are derived from lab panels, not transcribed." },
    ],
    "pillars",
  );
}

function techStack() {
  return estateFeatures(
    "What AuthiChain already does",
    "Claims limited to capabilities that are live on this estate.",
    [
      { title: "Signed seals", body: "Digital seals backed by AuthiChain's certificate contract, live on Polygon https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE. Our goal: tamper-evident seals with a signed certificate anyone can verify." },
      { title: "EU DPP Readiness", body: "Live $299 Stripe Payment Link from the published plan catalogue, or enter a work email for recoverable checkout. Credited toward AuthiChain Basic on conversion." },
      { title: "Agent pay (x402)", body: "Secondary money path. Funded agents verify a product for $0.05 USDC on Base. Public docs at /x402." },
    ],
    "technology",
  );
}

function originMoneySurfaces() {
  return `
<section class="estate-section" id="origin">
  <div class="wrap">
    <p class="section-tag">Money surfaces</p>
    <h2>TruMark seals and Made in America claims</h2>
    <p class="section-sub">Live self-serve paths. TruMark is the scan seal, not a SKU. Origin claims are documentation under FTC 16 CFR Part 323. Mendo / LT-63 is the genetics passport. No call booking.</p>
    <div class="estate-grid">
      <article class="estate-card card">
        <h3>TruMark</h3>
        <p>Physical scan seal already used in the StrainChain demo and enterprise tag-mint copy. Cannabis brands publish one genetics passport.</p>
        <div class="estate-actions" style="margin-top:1rem">
          <a class="btn btn-primary" href="/trumark">TruMark brief</a>
          ${checkoutEmailFormHtml({
            action: "/api/checkout/plan/strainchain_passport",
            label: "Passport checkout — $49",
            inputId: "origin-trumark-email",
            formId: "origin-trumark-checkout",
          })}
          ${catalogPaymentLinkHtml({
            planId: "strainchain_passport",
            label: "Pay $49 on Stripe",
          })}
        </div>
      </article>
      <article class="estate-card card">
        <h3>Made in America</h3>
        <p>Signed per-unit origin evidence for Made in USA labels. Partner brief at /partners/brief. EU DPP Readiness is the live checkout.</p>
        <div class="estate-actions" style="margin-top:1rem">
          <a class="btn btn-primary" href="/made-in-america">Made in USA brief</a>
          ${checkoutEmailFormHtml({
            action: "/api/checkout/dpp",
            label: "DPP checkout — $299",
            inputId: "origin-musa-email",
            formId: "origin-musa-checkout",
          })}
          ${catalogPaymentLinkHtml({
            planId: "dpp_readiness",
            label: "Pay $299 on Stripe",
          })}
        </div>
      </article>
      <article class="estate-card card">
        <h3>Mendo / LT-63</h3>
        <p>Genetics library is live. The Mendo campaign microsite goes straight to Passport $49 checkout.</p>
        <div class="estate-actions" style="margin-top:1rem">
          <a class="btn btn-primary" href="/m/mendo">Mendo microsite</a>
          ${checkoutEmailFormHtml({
            action: "/api/checkout/plan/strainchain_passport",
            label: "Passport checkout — $49",
            inputId: "origin-mendo-email",
            formId: "origin-mendo-checkout",
          })}
          ${catalogPaymentLinkHtml({
            planId: "strainchain_passport",
            label: "Pay $49 on Stripe",
          })}
        </div>
      </article>
    </div>
  </div>
</section>`;
}

function marketReality() {
  return `
<section class="estate-section" id="compliance">
  <div class="wrap">
    <p class="section-tag">Regulatory context</p>
    <h2>EU Digital Product Passport</h2>
    <p class="section-sub">EU ESPR requires a machine-readable product passport for goods sold in Europe, phased in by category. AuthiChain issues the certificate and the DPP audit path without claiming another company's logo as a customer.</p>
    <div class="estate-actions">
      ${checkoutEmailFormHtml({
        action: "/api/checkout/dpp",
        label: "Start DPP checkout",
        inputId: "compliance-dpp-email",
        formId: "compliance-dpp-checkout",
      })}
      ${catalogPaymentLinkHtml({
        planId: "dpp_readiness",
        label: "Pay $299 on Stripe",
      })}
      <a class="btn btn-outline" href="/digital-product-passport">Read the DPP brief</a>
      <a class="btn btn-outline" href="/anchor">Anchor a product</a>
    </div>
  </div>
</section>`;
}

function ecosystemFooter() {
  return estateFooter(
    "authichain",
    [
      {
        heading: "Start",
        links: [
          { href: "/pricing", label: "DPP checkout" },
          { href: "/pricing", label: "Pricing" },
          { href: "/onboard", label: "Onboard" },
          { href: "/dashboard", label: "Dashboard" },
        ],
      },
      {
        heading: "Estate",
        links: [
          { href: "https://qron.space/generate", label: "Generate Living QR" },
          { href: "https://govchain.us/onboard", label: "GovChain onboard" },
          { href: "https://strainchain.io/onboard", label: "StrainChain onboard" },
        ],
      },
      {
        heading: "Company",
        links: [
          { href: "/contact", label: "Contact" },
          { href: "/trumark", label: "TruMark" },
          { href: "/made-in-america", label: "Made in America" },
          { href: "/m/mendo", label: "Mendo / LT-63" },
          { href: "/partners/brief", label: "Partner brief" },
          { href: "/digital-product-passport", label: "EU DPP" },
          { href: "/authentic-agentic-economy", label: "Authentic agentic economy" },
          { href: "/x402", label: "Agent pay (x402)" },
          { href: "/vs", label: "Compare" },
        ],
      },
    ],
    'Polygon · ERC-721 contract <a href="https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE" target="_blank" rel="noopener">https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE</a> · EU DPP',
  );
}

const BRAND = 'authichain';
const b = BRANDS[BRAND];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${b.name} — ${b.tagline}</title>
  ${seoMeta()}
  ${FONTS_LINK}
  <style>
    ${cssVars(BRAND)}
    ${BASE_CSS}
  </style>
</head>
<body>
  ${estateSkipLink()}
  <div class="banner">The first checkout is the $29 signed pack. <a href="${escHtml(planPaymentLink("starter") ?? "#hero")}">Buy the $29 pack</a>. EU DPP Readiness stays on the form below.</div>
  ${estateNav(
    "authichain",
    [
      { href: "/trumark", label: "TruMark" },
      { href: "/made-in-america", label: "Made in USA" },
      { href: "/authentic-agentic-economy", label: "Agentic economy" },
      { href: "/pricing", label: "Pricing" },
      { href: "/x402", label: "x402" },
      { href: "/contact", label: "Contact" },
    ],
    { href: "/pricing", label: "View pricing" },
  )}
  <main id="main">
  ${estateHero({
    eyebrow: "The authentic agentic economy",
    title: "Issue seals. Bind products. Verify anywhere.",
    lede: "The first checkout on this page is the $29 signed pack. EU DPP Readiness remains $299 on the form below, or enter a work email so Stripe can recover that cart.",
    lead: {
      href: planPaymentLink("starter") ?? "#hero",
      label: "Buy the $29 signed pack",
    },
    emailCheckout: {
      action: "/api/checkout/dpp",
      label: "Start DPP checkout — $299",
    },
    actions: [
      { href: "/pricing", label: "View pricing", primary: false },
      { href: "/onboard", label: "Onboard", primary: false },
    ],
  })}
  ${estateTrust([
    { value: "Ed25519", label: "Signed seals" },
    { value: "Polygon", label: "Contract deployed" },
    { value: "$299", label: "EU DPP Readiness" },
    { value: "x402", label: "Agent micropayments" },
  ])}

  <section class="estate-verify" id="registry" aria-labelledby="registry-heading">
    <div class="wrap">
      <h2 id="registry-heading">Certificate registry</h2>
      <p class="section-sub">AuthiChain's certificate contract is live on Polygon <a href="https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE" target="_blank" rel="noopener">https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE</a>. We're building a public certificate lookup where you enter a cert ID to confirm authenticity.</p>
      <div class="estate-verify-grid">
        <div class="estate-card"><strong>On our roadmap</strong><span class="stat-label">Goal: multi-agent verification in under 2.1 seconds</span></div>
      </div>
      <div class="estate-verify-actions">
        <label class="sr-only" for="ac-cert-input">Certificate ID</label>
        <input id="ac-cert-input" class="estate-field" type="text" placeholder="Enter cert ID to verify…">
        <button type="button" class="btn btn-primary" onclick="acVerify()">Verify</button>
        <a class="btn btn-outline" href="/api/authichain/certificates" target="_blank" rel="noopener">Browse registry (in development)</a>
      </div>
      <div id="ac-verify-result" style="margin-top:1rem;display:none"></div>
    </div>
  </section>
  <style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}</style>

  <script>
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function acVerify(){
    var id=(document.getElementById('ac-cert-input').value||'').trim();
    var el=document.getElementById('ac-verify-result');
    if(!id){el.style.display='none';return;}
    el.style.display='block';
    el.innerHTML='<p style="color:var(--text-dim)">Verifying…</p>';
    fetch('/api/authichain/cert/'+encodeURIComponent(id))
      .then(r=>r.json()).then(function(d){
        if(d.is_authentic){
          el.innerHTML='<div class="estate-card" style="border-color:#15803d">'
            +'<div style="font-size:1.1rem;font-weight:700;color:#15803d;margin-bottom:.5rem">Authentic product</div>'
            +'<div style="color:var(--text-dim);font-size:.9rem"><b style="color:var(--text)">'+esc(d.certificate.brand)+'</b> — '+esc(d.certificate.product_name)+'</div>'
            +'<div style="color:var(--text-dim);font-size:.85rem;margin-top:.4rem">SKU: '+esc(d.certificate.sku||'—')+' · Issued: '+esc((d.certificate.issued_at||'').slice(0,10))+' · Scans: '+esc(String(d.certificate.scan_count))+'</div>'
            +'</div>';
        } else {
          el.innerHTML='<div class="estate-card" style="border-color:#b91c1c">'
            +'<div style="font-size:1.1rem;font-weight:700;color:#b91c1c">'+(d.error||'Certificate not verified')+'</div>'
            +'</div>';
        }
      }).catch(function(){
        el.innerHTML='<div style="color:#b91c1c">Verification failed — please try again</div>';
      });
  }
  </script>

  ${howItWorks()}
  ${estateFeatures(
    "The authentic agentic economy",
    "Agents can pay. They still need to know if the product is real. <a href=\"/authentic-agentic-economy\">Read the brief</a> — seals, MCP tools, and x402 at $0.05 USDC on Base. In development: 5-agent consensus verification.",
    [
      { title: "Identity", body: "Every product gets a seal. AuthiChain's certificate contract is deployed on Polygon https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE; public certificate lookup for people and agents is in development." },
      { title: "Verification", body: "Our goal: five agents reach weighted consensus in under 2.1 seconds. MCP tools will expose that check to any model that can call AuthiChain." },
      { title: "Settlement", body: "Humans enroll EU DPP Readiness on Stripe. Funded agents pay $0.05 USDC per verification on the live x402 rail." },
    ],
    "agentic",
  )}
  ${estatePillars()}
  ${techStack()}
  ${originMoneySurfaces()}
  ${foundersVision()}
  ${communityHub(BRAND)}
  ${marketReality()}
  ${estateCtaBand({
    title: "Start EU DPP Readiness",
    lede: "Enter a work email so abandoned-checkout recovery can reach you. Onboard and dashboard stay available. x402 is the secondary agent-pay rail.",
    emailCheckout: {
      action: "/api/checkout/dpp",
      label: "Start DPP checkout",
    },
    actions: [
      { href: "/pricing", label: "View pricing", primary: false },
      { href: "/x402", label: "x402 agent pay", primary: false },
    ],
  })}
  </main>
  ${ecosystemFooter()}
</body>
</html>`;

const ANCHOR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anchor a Product — AuthiChain</title>
<meta name="description" content="Anchor any physical product to the blockchain in 30 seconds. Free, no account required. SHA-256 fingerprint + permanent certificate.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#c9a227">
<meta property="og:title" content="Anchor a Product — AuthiChain">
<meta property="og:description" content="Blockchain certificate in 30 seconds. Free. No account.">
<meta property="og:image" content="https://authichain.govchain.us/og-image.png">
<meta property="og:url" content="https://authichain.govchain.us/anchor">
<meta name="twitter:card" content="summary_large_image">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050507;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
a{color:#c9a227;text-decoration:none}
a:hover{text-decoration:underline}
.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid rgba(201,162,39,.15)}
.nav-logo{font-size:1.1rem;font-weight:700;letter-spacing:.05em;color:#f8fafc}
.nav-logo span{color:#c9a227}
.wrap{max-width:680px;margin:0 auto;padding:3rem 1.5rem 6rem}
h1{font-size:clamp(1.8rem,5vw,2.8rem);font-weight:800;margin-bottom:.5rem;line-height:1.15}
h1 span{color:#c9a227}
.sub{color:#94a3b8;margin-bottom:2.5rem;font-size:1rem;line-height:1.6}
.card{background:#0a0a0f;border:1px solid rgba(201,162,39,.2);border-radius:1rem;padding:2rem}
label{display:block;font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:.5rem}
input,textarea,select{width:100%;padding:.75rem 1rem;background:#12121a;border:1px solid rgba(255,255,255,.1);border-radius:.5rem;color:#f8fafc;font-size:.95rem;outline:none;transition:border-color .2s;margin-bottom:1.25rem;font-family:inherit}
input:focus,textarea:focus,select:focus{border-color:rgba(201,162,39,.5)}
textarea{resize:vertical;min-height:80px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:500px){.row{grid-template-columns:1fr}}
.btn{display:block;width:100%;padding:.9rem;background:linear-gradient(135deg,#c9a227,#a8891f);color:#000;font-weight:700;font-size:1rem;border:none;border-radius:.5rem;cursor:pointer;letter-spacing:.03em;transition:opacity .2s}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.5;cursor:not-allowed}
.steps{display:flex;gap:.75rem;margin-bottom:2rem;flex-wrap:wrap}
.step{display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:#94a3b8;background:#0a0a0f;border:1px solid rgba(255,255,255,.06);border-radius:2rem;padding:.35rem .85rem}
.step-num{width:20px;height:20px;border-radius:50%;background:rgba(201,162,39,.15);border:1px solid rgba(201,162,39,.4);color:#c9a227;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center}
.step.active .step-num{background:#c9a227;color:#000}
.step.done .step-num{background:#22c55e;color:#000}
.hash-preview{font-family:monospace;font-size:.75rem;color:#94a3b8;word-break:break-all;background:#12121a;border-radius:.4rem;padding:.5rem .75rem;margin-top:-.75rem;margin-bottom:1.25rem}
.result{display:none;margin-top:2rem;background:#0a0a0f;border:1px solid #22c55e;border-radius:1rem;padding:2rem;text-align:center}
.cert-id{font-family:monospace;font-size:1.6rem;font-weight:700;color:#c9a227;letter-spacing:.1em;margin:1rem 0}
.cert-link{display:inline-block;padding:.6rem 1.5rem;background:rgba(34,197,94,.1);border:1px solid #22c55e;border-radius:.5rem;color:#22c55e;font-weight:600;margin:.5rem .25rem}
.cert-link:hover{background:rgba(34,197,94,.2);text-decoration:none}
.qr-wrap{margin:1.5rem auto;display:flex;justify-content:center}
.qr-wrap img{border-radius:.5rem;border:4px solid #fff}
.note{color:#94a3b8;font-size:.8rem;margin-top:1.5rem;line-height:1.6}
.privacy{background:rgba(201,162,39,.05);border:1px solid rgba(201,162,39,.15);border-radius:.5rem;padding:.75rem 1rem;margin-top:1.5rem;font-size:.82rem;color:#94a3b8;line-height:1.5}
.err{color:#ef4444;font-size:.9rem;margin-top:.5rem;display:none}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">AUTHI<span>CHAIN</span></a>
  <a href="/onboard" style="font-size:.85rem;padding:.45rem 1rem;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.3);border-radius:.4rem;color:#c9a227;font-weight:600">Sign In</a>
</nav>
<div class="wrap">
  <h1>Anchor a Product to the <span>Blockchain</span></h1>
  <p class="sub">Generate a cryptographic certificate of authenticity in 30 seconds. Free, permanent, no account required. Your data is hashed in-browser before being sent.</p>

  <div class="steps">
    <div class="step active" id="s1"><span class="step-num">1</span> Enter details</div>
    <div class="step" id="s2"><span class="step-num">2</span> Hash &amp; sign</div>
    <div class="step" id="s3"><span class="step-num">3</span> Certificate issued</div>
  </div>

  <div class="card">
    <div class="row">
      <div>
        <label>Product Name *</label>
        <input id="f-name" type="text" placeholder="e.g. Air Jordan 1 Retro" maxlength="200">
      </div>
      <div>
        <label>Brand *</label>
        <input id="f-brand" type="text" placeholder="e.g. Nike" maxlength="100">
      </div>
    </div>
    <div class="row">
      <div>
        <label>SKU / Serial</label>
        <input id="f-sku" type="text" placeholder="Optional" maxlength="100">
      </div>
      <div>
        <label>Industry</label>
        <select id="f-industry">
          <option value="general">General</option>
          <option value="luxury">Luxury Goods</option>
          <option value="fashion">Fashion &amp; Apparel</option>
          <option value="electronics">Electronics</option>
          <option value="pharma">Pharmaceuticals</option>
          <option value="food">Food &amp; Beverage</option>
          <option value="art">Art &amp; Collectibles</option>
          <option value="sports">Sports Memorabilia</option>
          <option value="cosmetics">Cosmetics &amp; Beauty</option>
          <option value="auto">Automotive Parts</option>
          <option value="cannabis">Cannabis &amp; Hemp</option>
        </select>
      </div>
    </div>
    <label>Description</label>
    <textarea id="f-desc" placeholder="Optional — color, size, edition, condition…" maxlength="2000"></textarea>
    <div id="hash-row" style="display:none">
      <label>SHA-256 Fingerprint (generated in-browser)</label>
      <div class="hash-preview" id="hash-display"></div>
    </div>
    <div class="err" id="f-err"></div>
    <div class="privacy">
      Your product details are hashed in your browser using SHA-256 before being sent. Only the fingerprint + your chosen metadata is stored. We do not collect personal data.
    </div>
    <button class="btn" id="anchor-btn" onclick="doAnchor()" style="margin-top:1.5rem">Generate Certificate &rarr;</button>
  </div>

  <div class="result" id="result">
    <div style="font-size:2rem;margin-bottom:.5rem">&#x2705;</div>
    <div style="font-weight:700;font-size:1.15rem;margin-bottom:.25rem">Certificate Anchored</div>
    <div class="cert-id" id="cert-id-display"></div>
    <div class="qr-wrap"><img id="qr-img" src="" alt="QR code" width="160" height="160"></div>
    <div>
      <a class="cert-link" id="cert-link" href="#">View Certificate &rarr;</a>
    </div>
    <div class="note">
      This certificate ID is permanent and publicly verifiable at<br>
      <strong style="color:#f8fafc">authichain.com/cert/&lt;ID&gt;</strong><br><br>
      Share the QR code with buyers, customs agents, or insurers. Anyone who scans it can instantly verify your product.
    </div>
  </div>

  <div style="margin-top:3rem;border-top:1px solid rgba(255,255,255,.06);padding-top:2rem">
    <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem">AuthiChain vs. alternatives</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;font-size:.85rem">
      <div style="background:#0a0a0f;border:1px solid rgba(201,162,39,.2);border-radius:.5rem;padding:1rem">
        <div style="color:#c9a227;font-weight:700;margin-bottom:.35rem">AuthiChain</div>
        <div style="color:#94a3b8;line-height:1.6">Free tier. 30-second setup. Public certificate URL. No enterprise contract.</div>
      </div>
      <div style="background:#0a0a0f;border:1px solid rgba(255,255,255,.06);border-radius:.5rem;padding:1rem">
        <div style="font-weight:700;margin-bottom:.35rem;color:#555">AURA (LVMH)</div>
        <div style="color:#555;line-height:1.6">Consortium-only. LVMH/Prada/Richemont brands. No public access.</div>
      </div>
      <div style="background:#0a0a0f;border:1px solid rgba(255,255,255,.06);border-radius:.5rem;padding:1rem">
        <div style="font-weight:700;margin-bottom:.35rem;color:#555">MediLedger</div>
        <div style="color:#555;line-height:1.6">Pharma only. EDI integration required. Six-figure setup.</div>
      </div>
      <div style="background:#0a0a0f;border:1px solid rgba(255,255,255,.06);border-radius:.5rem;padding:1rem">
        <div style="font-weight:700;margin-bottom:.35rem;color:#555">IBM Food Trust</div>
        <div style="color:#555;line-height:1.6">Enterprise SaaS. Supply chain integration required.</div>
      </div>
    </div>
  </div>
</div>

<script>
async function doAnchor() {
  var btn = document.getElementById('anchor-btn');
  var err = document.getElementById('f-err');
  var name = document.getElementById('f-name').value.trim();
  var brand = document.getElementById('f-brand').value.trim();
  var desc = document.getElementById('f-desc').value.trim();
  var sku = document.getElementById('f-sku').value.trim();
  var industry = document.getElementById('f-industry').value;

  err.style.display = 'none';
  if (!name) { err.textContent = 'Product name is required.'; err.style.display = 'block'; return; }
  if (!brand) { err.textContent = 'Brand is required.'; err.style.display = 'block'; return; }

  btn.disabled = true;
  btn.textContent = 'Generating fingerprint…';
  document.getElementById('s1').classList.remove('active');
  document.getElementById('s2').classList.add('active');

  try {
    var payload = name + '|' + brand + '|' + (sku || '') + '|' + (desc || '');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    var hash = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
    document.getElementById('hash-display').textContent = hash;
    document.getElementById('hash-row').style.display = 'block';

    btn.textContent = 'Anchoring to blockchain…';
    document.getElementById('s2').classList.remove('active');
    document.getElementById('s2').classList.add('done');
    document.getElementById('s3').classList.add('active');

    var res = await fetch('https://api.authichain.com/api/v1/anchor', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name:name,brand:brand,description:desc,sku:sku,industry:industry,hash:hash})
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Anchor failed');

    document.getElementById('s3').classList.remove('active');
    document.getElementById('s3').classList.add('done');

    var certId = data.id;
    var certUrl = data.certUrl || ('https://authichain.govchain.us/cert/' + certId);
    document.getElementById('cert-id-display').textContent = certId;
    document.getElementById('cert-link').href = certUrl;
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(certUrl);
    document.getElementById('qr-img').src = qrUrl;
    document.getElementById('result').style.display = 'block';
    document.getElementById('result').scrollIntoView({behavior:'smooth',block:'start'});
    btn.textContent = 'Anchored! Generate Another →';
    btn.disabled = false;
    btn.onclick = function(){ location.reload(); };
  } catch(e) {
    err.textContent = e.message || 'Something went wrong. Please try again.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Generate Certificate →';
    document.getElementById('s2').classList.remove('active','done');
    document.getElementById('s1').classList.add('active');
    document.getElementById('s3').classList.remove('active','done');
  }
}
</script>
</body>
</html>`;

function certPage(certId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Certificate \${certId} — AuthiChain</title>
<meta name="description" content="Verify blockchain certificate \${certId} on AuthiChain. Cryptographic proof of product authenticity.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#c9a227">
<meta property="og:title" content="AuthiChain Certificate \${certId}">
<meta property="og:description" content="Blockchain-anchored product certificate. Verify authenticity instantly.">
<meta property="og:image" content="https://authichain.govchain.us/og-image.png">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050507;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
a{color:#c9a227;text-decoration:none}
.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid rgba(201,162,39,.15)}
.nav-logo{font-size:1.1rem;font-weight:700;letter-spacing:.05em;color:#f8fafc}
.nav-logo span{color:#c9a227}
.wrap{max-width:600px;margin:0 auto;padding:3rem 1.5rem 6rem;text-align:center}
.cert-card{background:#0a0a0f;border:2px solid rgba(201,162,39,.35);border-radius:1.25rem;padding:2.5rem;text-align:left;position:relative;overflow:hidden}
.cert-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#c9a227,#00ffd1)}
.cert-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(34,197,94,.1);border:1px solid #22c55e;border-radius:2rem;padding:.3rem .9rem;font-size:.8rem;font-weight:600;color:#22c55e;margin-bottom:1.5rem}
.cert-id{font-family:monospace;font-size:1.5rem;font-weight:700;color:#c9a227;letter-spacing:.08em;margin-bottom:1.5rem}
.field{margin-bottom:1.1rem}
.field-label{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.25rem}
.field-value{font-size:.95rem;color:#f8fafc;word-break:break-word}
.hash{font-family:monospace;font-size:.72rem;color:#94a3b8;word-break:break-all}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:1.5rem 0}
.qr-section{text-align:center;margin-top:1.5rem}
.qr-section img{border-radius:.5rem;border:3px solid #fff}
.actions{display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center;margin-top:2rem}
.btn-outline{padding:.6rem 1.4rem;border:1px solid rgba(201,162,39,.4);border-radius:.5rem;color:#c9a227;font-weight:600;font-size:.9rem}
.btn-outline:hover{background:rgba(201,162,39,.1)}
.status-loading{padding:4rem;text-align:center;color:#94a3b8}
.status-err{padding:4rem;text-align:center}
.ts{font-size:.75rem;color:#555}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">AUTHI<span>CHAIN</span></a>
  <a href="/anchor" style="font-size:.85rem;padding:.45rem 1rem;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.3);border-radius:.4rem;color:#c9a227;font-weight:600">Anchor a Product</a>
</nav>
<div class="wrap">
  <h1 style="font-size:1.6rem;font-weight:800;margin-bottom:.5rem">Product Certificate</h1>
  <p style="color:#94a3b8;margin-bottom:2rem;font-size:.9rem">Blockchain-anchored proof of authenticity</p>
  <div id="main"><div class="status-loading">Fetching certificate…</div></div>
</div>
<script>
(function(){
  var id = \${JSON.stringify(certId)};
  var el = document.getElementById('main');
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  fetch('https://api.authichain.com/api/v1/cert/'+encodeURIComponent(id))
    .then(function(r){return r.json()})
    .then(function(data){
      if(!data.success||!data.certificate){
        el.innerHTML='<div class="status-err"><div style="font-size:3rem;margin-bottom:1rem">&#x26A0;</div><div style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem">Certificate Not Found</div><div style="color:#94a3b8;margin-bottom:1.5rem">'+esc(id)+'</div><a href="/anchor" style="color:#c9a227;border:1px solid rgba(201,162,39,.4);border-radius:.5rem;padding:.6rem 1.4rem;font-weight:600">Anchor a Product</a></div>';
        return;
      }
      var c=data.certificate;
      var certUrl='https://authichain.govchain.us/cert/'+esc(id);
      var qrUrl='https://api.qrserver.com/v1/create-qr-code/?size=140x140&data='+encodeURIComponent('https://authichain.govchain.us/cert/'+id);
      var ts=c.ts?new Date(c.ts).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'';
      el.innerHTML='<div class="cert-card">'
        +'<div class="cert-badge">&#x2714; Anchored &amp; Verified</div>'
        +'<div class="cert-id">'+esc(c.id)+'</div>'
        +(c.name?'<div class="field"><div class="field-label">Product</div><div class="field-value">'+esc(c.name)+'</div></div>':'')
        +(c.brand?'<div class="field"><div class="field-label">Brand</div><div class="field-value">'+esc(c.brand)+'</div></div>':'')
        +(c.sku?'<div class="field"><div class="field-label">SKU / Serial</div><div class="field-value">'+esc(c.sku)+'</div></div>':'')
        +(c.industry&&c.industry!=='general'?'<div class="field"><div class="field-label">Industry</div><div class="field-value" style="text-transform:capitalize">'+esc(c.industry)+'</div></div>':'')
        +(c.description?'<div class="field"><div class="field-label">Description</div><div class="field-value">'+esc(c.description)+'</div></div>':'')
        +'<hr class="divider">'
        +'<div class="field"><div class="field-label">SHA-256 Fingerprint</div><div class="hash">'+esc(c.hash||'')+'</div></div>'
        +(ts?'<div class="field" style="margin-top:.75rem"><div class="field-label">Anchored</div><div class="ts">'+esc(ts)+'</div></div>':'')
        +'<div class="qr-section"><img src="'+qrUrl+'" alt="QR code" width="140" height="140"><div style="font-size:.75rem;color:#94a3b8;margin-top:.6rem">Scan to verify</div></div>'
        +'</div>'
        +'<div class="actions">'
        +'<a class="btn-outline" href="/anchor">Anchor Another</a>'
        +'<a class="btn-outline" href="/onboard" style="border-color:rgba(0,255,209,.3);color:#00ffd1">Get Full Certificate</a>'
        +'</div>';
    })
    .catch(function(e){
      el.innerHTML='<div class="status-err"><div style="font-size:3rem;margin-bottom:1rem">&#x26A0;</div><div style="font-size:1.1rem;font-weight:700;color:#ef4444">Failed to load</div><div style="color:#94a3b8;margin-top:.5rem">'+esc(e.message)+'</div></div>';
    });
})();
<\/script>
</body>
</html>`;
}

// Public landing page for the open verification protocol (Apache-2.0, in
// protocol/ on the public repo). The CTA of the Product Hunt launch points
// here. Every claim on this page is checkable by a reader in under a minute —
// no user counts, no certifications, nothing unsubstantiated.
const PROTOCOL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Verification Protocol — AuthiChain</title>
<meta name="description" content="An open specification and a zero-dependency reference verifier for product provenance. Check a signed record and its on-chain anchor offline, in one command, with no account. Apache-2.0.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#c9a227">
<meta property="og:title" content="Open Verification Protocol — AuthiChain">
<meta property="og:description" content="Verify product provenance yourself. Offline, one command, no account. Apache-2.0.">
<meta property="og:image" content="https://authichain.govchain.us/og-image.png">
<meta property="og:url" content="https://authichain.govchain.us/protocol">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"TechArticle","headline":"AuthiChain Verification Specification","description":"An open specification and reference verifier for product provenance, licensed Apache-2.0.","license":"https://www.apache.org/licenses/LICENSE-2.0","url":"https://authichain.govchain.us/protocol"}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050507;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;line-height:1.65}
a{color:#c9a227;text-decoration:none}
a:hover{text-decoration:underline}
.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid rgba(201,162,39,.15)}
.nav-logo{font-size:1.1rem;font-weight:700;letter-spacing:.05em;color:#f8fafc}
.nav-logo span{color:#c9a227}
.wrap{max-width:720px;margin:0 auto;padding:3rem 1.5rem 6rem}
h1{font-size:2.1rem;line-height:1.2;letter-spacing:-.02em;margin-bottom:1rem}
h2{font-size:1.15rem;margin:2.5rem 0 .75rem;letter-spacing:.02em}
p{color:#cbd5e1;margin-bottom:1rem}
.lede{font-size:1.1rem;color:#e2e8f0}
.badge{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c9a227;border:1px solid rgba(201,162,39,.35);border-radius:999px;padding:.3rem .7rem;margin-bottom:1.25rem}
pre{background:#0c0c11;border:1px solid rgba(201,162,39,.18);border-radius:10px;padding:1rem;overflow-x:auto;margin:1rem 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem;color:#e2e8f0}
ul{margin:0 0 1rem 1.1rem;color:#cbd5e1}
li{margin-bottom:.5rem}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin:2rem 0 1rem}
.btn{display:inline-block;padding:.7rem 1.15rem;border-radius:8px;font-weight:600;font-size:.92rem;border:1px solid rgba(201,162,39,.4);color:#c9a227}
.btn.primary{background:#c9a227;color:#050507;border-color:#c9a227}
.btn:hover{text-decoration:none;opacity:.9}
.note{border-left:2px solid rgba(201,162,39,.4);padding:.25rem 0 .25rem 1rem;color:#94a3b8;font-size:.92rem;margin:1.5rem 0}
footer{border-top:1px solid rgba(201,162,39,.15);padding:2rem 1.5rem;text-align:center;color:#64748b;font-size:.85rem}
</style>
</head>
<body>
<nav class="nav"><a class="nav-logo" href="/">AUTHI<span>CHAIN</span></a><a href="/anchor">Anchor a product</a></nav>
<div class="wrap">
  <div class="badge">Apache-2.0 &middot; v0.1.0 draft</div>
  <h1>Verify it yourself.</h1>
  <p class="lede">Most &ldquo;verified authentic&rdquo; badges resolve to a vendor&rsquo;s server saying <em>trust me</em>. That doesn&rsquo;t solve the trust problem, it relocates it.</p>
  <p>The AuthiChain verification protocol is an open specification with a reference verifier you run on your own machine. No account, no API key, no network calls to us.</p>

  <pre><code>node verifier.mjs record.json anchor.json

{ "verdict": "verified", "reasons": [], "checks": { "signature": true, "anchorHash": true } }</code></pre>

  <p>Zero dependencies &mdash; Node builtins only. It checks an Ed25519 signature over a JCS-canonicalised W3C Verifiable Credential, then checks that the record&rsquo;s hash matches what was committed on-chain.</p>

  <div class="cta">
    <a class="btn primary" href="https://github.com/undone0603/authichain-unified/tree/main/protocol">Read the spec</a>
    <a class="btn" href="https://github.com/undone0603/authichain-unified/blob/main/protocol/verifier.mjs">Run the verifier</a>
    <a class="btn" href="https://github.com/undone0603/authichain-unified/blob/main/protocol/LICENSE">View the license</a>
  </div>

  <h2>Three verdicts. No partial credit.</h2>
  <ul>
    <li><code>verified</code> &mdash; signature valid; anchor present, well formed, mainnet, hash matches</li>
    <li><code>valid-unanchored</code> &mdash; signature valid; no anchor supplied</li>
    <li><code>invalid</code> &mdash; any required check failed</li>
  </ul>
  <p>There is deliberately no score in this layer. A score is a product feature; a verdict is what a verifier owes you.</p>

  <h2>Two rules we learned the hard way</h2>
  <p>Both exist because this codebase shipped violations of them, and both are enforced by tests you can read:</p>
  <ul>
    <li><strong>A testnet anchor is not proof.</strong> Rejected unless the caller explicitly opts in.</li>
    <li><strong>A malformed transaction hash is rejected, not displayed.</strong> Render a truncated hash and you have published something that looks like proof and links nowhere.</li>
  </ul>

  <h2>Built on existing standards</h2>
  <p>W3C Verifiable Credentials 2.0, GS1 Digital Link for item identity, CAIP-2 for chain identifiers, RFC 8785 for canonicalisation. Not a private format &mdash; adoption follows compatibility.</p>

  <h2>Claim conformance</h2>
  <pre><code>node conformance/run.mjs --strict -- &lt;your command&gt;</code></pre>
  <p>28 fixtures, any language. All must pass. The suite is itself validated against deliberately broken implementations, so it demonstrably can fail.</p>

  <div class="note">
    v0.1.0 is a draft and not yet stable. There is no revocation mechanism &mdash; a record signed by a compromised key stays cryptographically valid. And a signature proves who asserted something, never that it is true: an issuer can sign a false statement and this layer will correctly report <code>verified</code>. Defending against that lives above the specification, not in it.
  </div>

  <p>Independent implementations are the point. If a fixture looks wrong, that is more valuable to find than a bug in a verifier &mdash; open an issue.</p>
</div>
<footer>&copy; 2026 AuthiChain &middot; The protocol is Apache-2.0; the platform is not. <a href="/">Home</a></footer>
</body>
</html>`;

const dppHtml = (now: Date) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EU Digital Product Passport Compliance | AuthiChain</title>
  <meta name="description" content="AuthiChain EU Digital Product Passport readiness tooling. Our goal: one integration for ESPR, EUDR, and CSRD.">
  <meta name="keywords" content="EU Digital Product Passport, DPP compliance, digital product passport 2026, DPP blockchain, ESPR regulation, EU battery regulation, supply chain compliance, product passport">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="https://authichain.govchain.us/digital-product-passport">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="theme-color" content="#c9a227">
  <meta property="og:type" content="website">
  <meta property="og:title" content="EU Digital Product Passport Compliance | AuthiChain">
  <meta property="og:description" content="EU DPP readiness tooling. On our roadmap: offline verification with no account required.">
  <meta property="og:url" content="https://authichain.govchain.us/digital-product-passport">
  <meta property="og:image" content="https://authichain.govchain.us/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="EU Digital Product Passport | AuthiChain">
  <meta name="twitter:description" content="EU DPP readiness tooling. On our roadmap: offline verification with no account required.">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"EU Digital Product Passport Compliance","url":"https://authichain.govchain.us/digital-product-passport","description":"AuthiChain provides EU Digital Product Passport readiness tooling for brands and is building toward passport certificates on its Polygon contract.","provider":{"@type":"Organization","name":"AuthiChain","url":"https://authichain.govchain.us"}}</script>
  ${FONTS_LINK}
  <style>
    ${cssVars(BRAND)}
    ${BASE_CSS}
    .dpp-timeline { display: grid; gap: 0; max-width: 700px; margin: 0 auto; }
    .dpp-phase { display: grid; grid-template-columns: 140px 1fr; gap: 0; align-items: stretch; }
    .dpp-date { font-family: var(--mono); font-size: 12px; color: var(--primary); padding: 14px 16px 14px 0; border-right: 2px solid var(--border); text-align: right; line-height: 1.4; }
    .dpp-content { padding: 14px 0 14px 20px; }
    .dpp-phase-title { font-weight: 600; font-size: 15px; color: var(--text); margin-bottom: 2px; }
    .dpp-phase-sub { font-size: 13px; color: var(--text-dim); }
    .dpp-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); margin-left: -25px; margin-right: 15px; vertical-align: middle; flex-shrink: 0; }
    .dpp-phase.live .dpp-date { color: #22c55e; }
    .dpp-phase.live .dpp-dot { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
    .dpp-phase.urgent .dpp-date { color: #f59e0b; }
    .dpp-phase.urgent .dpp-dot { background: #f59e0b; }
    .feature-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-top: 40px; }
    .feature-item { background: var(--bg2); border: 1px solid var(--border-dim); border-radius: 12px; padding: 24px; }
    .feature-icon { font-size: 28px; margin-bottom: 12px; }
    .feature-title { font-weight: 600; font-size: 16px; margin-bottom: 8px; }
    .feature-desc { font-size: 14px; color: var(--text-dim); line-height: 1.6; }
    .badge-live { display: inline-block; background: rgba(34,197,94,.15); border: 1px solid #22c55e; color: #22c55e; font-family: var(--mono); font-size: 11px; padding: 3px 10px; border-radius: 20px; margin-bottom: 16px; letter-spacing: .05em; }
    .industries { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 32px; }
    .industry-card { background: var(--bg2); border: 1px solid var(--border-dim); border-radius: 10px; padding: 20px; }
    .industry-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .industry-deadline { font-family: var(--mono); font-size: 12px; color: var(--primary); }
    .checkout-email-form { display:flex; flex-direction:column; align-items:stretch; gap:8px; max-width:22rem; margin:0 auto; text-align:left; }
    .checkout-email-label { display:flex; flex-direction:column; gap:6px; font-size:.85rem; font-weight:600; color:var(--text-dim); }
    .checkout-email-form input[type="email"] { padding:10px 12px; border:1px solid var(--border-dim); border-radius:8px; font:inherit; background:var(--bg2); color:var(--text); }
    .checkout-email-hint { font-size:.82rem; color:var(--text-dim); margin:0; }
    .checkout-email-form button.btn { border:0; cursor:pointer; font:inherit; }
    .dpp-cancelled { display:none; max-width:36rem; margin:0 auto 16px; padding:12px 16px; border:1px solid #f59e0b; border-radius:10px; background:rgba(245,158,11,.12); color:#fbbf24; font-size:.92rem; }
    .dpp-cancelled.is-visible { display:block; }
  </style>
</head>
<body>
  <nav>
    <a class="nav-logo" href="/">
      ${svgLogo(BRAND)}
      <span class="nav-logo-text">AUTHI<span>CHAIN</span></span>
    </a>
    <div class="nav-links">
      <a class="nav-link" href="/">Home</a>
      <a class="nav-link" href="/pricing">Pricing</a>
      <a class="nav-link" href="/x402">Agent pay</a>
      <a class="btn btn-primary btn-sm" id="nav-dpp-cta" href="${escHtml(planPaymentLink("dpp_readiness") ?? "#hero")}">Start DPP Audit — $299</a>
    </div>
  </nav>

  <section class="hero" id="hero" style="min-height:70vh">
    <div class="hero-content">
      <div class="badge-live">● ${(() => { const m = mostRecentInForce(now) ?? listMilestones()[0]; return m.badge ? escHtml(m.badge.toUpperCase()) : `${escHtml(m.label.toUpperCase())} — ${escHtml(countdownLabel(m, now).toUpperCase())}`; })()}</div>
      <h1 class="hero-title" style="font-size: clamp(2.4rem, 6vw, 4.5rem)">
        EU DIGITAL<br><span class="accent">PRODUCT PASSPORT</span>
      </h1>
      <p class="hero-sub" style="max-width:600px">
        ESPR (Regulation (EU) 2024/1781) requires a digital product passport for product groups the EU designates, starting with the first ones in its working plan. Batteries have their own passport under Regulation (EU) 2023/1542 from 18 February 2027. The law is technology-neutral, and AuthiChain is building passport tooling that meets its requirements for data integrity and verifiability (in development).
      </p>
      <div id="dpp-cancelled-banner" class="dpp-cancelled">Checkout was not finished. Leave a work email so Stripe can send a recovery link if this session expires.</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:32px">
        ${catalogPaymentLinkHtml({
          planId: "dpp_readiness",
          label: "Pay $299 on Stripe",
          className: "btn btn-primary",
        })}
        ${checkoutEmailFormHtml({
          action: "/protocol/checkout/dpp",
          label: "Start Your DPP Readiness Audit — $299",
          formId: "dpp-checkout-form",
          inputId: "dpp-email",
          buttonClass: "btn btn-outline",
        })}
        <a class="btn btn-outline" href="mailto:hello@authichain.com?subject=DPP%20written%20packet">Request a written packet</a>
      </div>
      <p style="max-width:520px;margin:16px auto 0;font-size:0.92rem;line-height:1.5;opacity:0.75">
        Pay once → automatic provisioning → self-serve activation → publish your first DPP.
        The $299 is credited in full toward AuthiChain Basic if you move forward.
      </p>
    </div>
  </section>
  <script>
  (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
      var visitId = params.get('visit_id') || localStorage.getItem('dpp_visit_id');
      if (!visitId) {
        visitId = 'dpp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      }
      try { localStorage.setItem('dpp_visit_id', visitId); } catch (e0) {}
      var q = new URLSearchParams();
      q.set('visit_id', visitId);
      keys.forEach(function (k) {
        var v = params.get(k);
        if (v) q.set(k, v);
      });
      if (document.referrer) q.set('referrer', document.referrer.slice(0, 512));
      var source = params.get('utm_source') || params.get('source') || 'direct';
      q.set('source', source);
      function decorateForm(form) {
        if (!form) return;
        function setHidden(name, value) {
          var el = form.querySelector('input[name="'+name+'"]');
          if (!el) {
            el = document.createElement('input');
            el.type = 'hidden';
            el.name = name;
            form.appendChild(el);
          }
          el.value = value;
        }
        q.forEach(function (value, key) {
          if (key === 'email') return;
          setHidden(key, value);
        });
        var input = form.querySelector('input[name="email"]');
        try {
          var saved = localStorage.getItem('dpp_checkout_email');
          if (saved && input && !input.value) input.value = saved;
        } catch (e2) {}
        form.addEventListener('submit', function () {
          if (input && input.value) {
            try { localStorage.setItem('dpp_checkout_email', input.value.trim()); } catch (e3) {}
          }
        });
      }
      document.querySelectorAll('form.checkout-email-form').forEach(decorateForm);
      if (params.get('cancelled') === '1' || params.get('need_email') === '1') {
        var banner = document.getElementById('dpp-cancelled-banner');
        if (banner) {
          if (params.get('need_email') === '1') {
            banner.textContent = 'Enter a work email so Stripe can recover this cart. Checkout does not start without it.';
          }
          banner.classList.add('is-visible');
        }
        var emailInput = document.getElementById('dpp-email');
        if (emailInput) emailInput.focus();
      }
      // attributed_visit — best-effort; never blocks CTA
      fetch('/api/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: visitId,
          stage: 'visit_landing_page',
          source: ['gov_engine','linkedin_post','reddit_post','seo','direct','email','affiliate'].indexOf(source) >= 0 ? source : 'direct',
          event_type: 'dpp_loop:attributed_visit',
          metadata: {
            offer: 'dpp_readiness_2026',
            loop_stage: 'attributed_visit',
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign'),
            referrer: document.referrer || null,
            path: location.pathname
          }
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  })();
  </script>

  <section class="section" id="regulation">
    <div class="container">
      <div class="section-label">REGULATION TIMELINE</div>
      <h2 class="section-title">When Does Your Industry Need DPP?</h2>
      <p class="section-sub">ESPR rolls out in phases. ${nextDeadline(now) ? `Next: ${escHtml(nextDeadline(now)!.label)} — ${escHtml(countdownLabel(nextDeadline(now)!, now))}.` : 'All published deadlines are now in force.'} Reviewed ${escHtml(timelineUpdatedAt())}.</p>

      <div class="dpp-timeline" style="margin-top:48px">
        ${listMilestones().map((m) => {
          const status = milestoneStatus(m, now);
          const cls = status === 'in-force' ? 'live' : (status === 'imminent' && m.urgent ? 'urgent' : '');
          const [head, tail] = formatMilestoneDate(m).split(/,\s|–/);
          return `
        <div class="dpp-phase ${cls}">
          <div class="dpp-date">${escHtml(head.toUpperCase())}${tail ? `<br>${escHtml(tail)}` : ''}</div>
          <div class="dpp-content">
            <span class="dpp-dot"></span>
            <span class="dpp-phase-title">${escHtml(m.label)}</span>
            <div class="dpp-phase-sub">${escHtml(m.detail)}${m.hideStatus ? '' : ` <a href="${escHtml(m.source)}" rel="noopener noreferrer" target="_blank" style="color:inherit;text-decoration:underline">${escHtml(countdownLabel(m, now))}</a>`}</div>
          </div>
        </div>`;
        }).join('')}
      </div>
    </div>
  </section>

  <section class="section" id="solution" style="background:var(--bg2)">
    <div class="container">
      <div class="section-label">THE AUTHICHAIN SOLUTION</div>
      <h2 class="section-title">One Integration. Every Standard.</h2>
      <p class="section-sub">AuthiChain is building passport tooling on its certificate contract, live on Polygon <a href="https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE" target="_blank" rel="noopener">https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE</a>. Our goal: the certificate NFT serves as the passport, with no retrofitting or middleware.</p>

      <div class="feature-row">
        <div class="feature-item">
          <div class="feature-icon">🔗</div>
          <div class="feature-title">ERC-721 certificates (in development)</div>
          <div class="feature-desc">The certificate contract is live on Polygon <a href="https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE" target="_blank" rel="noopener">https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE</a>. We're building per-product certificates that carry passport data such as materials, carbon footprint, recycled content, supplier chain, and repair information.</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📱</div>
          <div class="feature-title">QR Scan → Instant Passport</div>
          <div class="feature-desc">A QR code on the label links to the product's passport record, and every scan is logged against the serial. Our goal: consumers, regulators, and resellers all see the same on-chain record.</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📊</div>
          <div class="feature-title">Audit-Ready Exports</div>
          <div class="feature-desc">One-click compliance exports for EU CSRD, EUDR, FDA DSCSA, USMCA, and ISO 22005. Formatted for EU customs authorities and DPP registry submission.</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">⛓️</div>
          <div class="feature-title">Supply chain events</div>
          <div class="feature-desc">Provenance events from manufacturing to retail receipt. On our roadmap: anchoring all 22 supply-chain events on Polygon.</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🤖</div>
          <div class="feature-title">AI provenance verification (in development)</div>
          <div class="feature-desc">Our goal: 5-agent consensus (Guardian, Archivist, Sentinel, Scout, Arbiter) that will verify authenticity in under 2.1 seconds. Goal: counterfeit detection built into every verification.</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🌍</div>
          <div class="feature-title">Multi-Standard Coverage</div>
          <div class="feature-desc">Our goal: a single AuthiChain integration that supports ESPR, EUDR, and CSRD.</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="industries">
    <div class="container">
      <div class="section-label">INDUSTRIES SERVED</div>
      <h2 class="section-title">Industries we're building for</h2>
      <div class="industries">
        <div class="industry-card"><div class="industry-name">⚡ EV Batteries</div><div class="industry-deadline">Mandatory ${escHtml(formatMilestoneDate(listMilestones().find((m) => m.id === 'batteries') ?? listMilestones()[0]))}</div></div>
        <div class="industry-card"><div class="industry-name">👗 Fashion &amp; Textiles</div><div class="industry-deadline">Mandatory 2028–29</div></div>
        <div class="industry-card"><div class="industry-name">💊 Pharmaceuticals</div><div class="industry-deadline">FDA DSCSA + DPP</div></div>
        <div class="industry-card"><div class="industry-name">💻 Electronics</div><div class="industry-deadline">Mandatory 2027</div></div>
        <div class="industry-card"><div class="industry-name">💎 Luxury Goods</div><div class="industry-deadline">Product authenticity + DPP</div><div class="industry-deadline">Goal: counterfeit detection for luxury goods</div></div>
        <div class="industry-card"><div class="industry-name">🌿 Cannabis</div><div class="industry-deadline">State + EU compliance</div></div>
      </div>
    </div>
  </section>

  <section class="section cta-section" style="background: linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%); text-align:center">
    <div class="container" style="max-width:700px">
      <h2 class="section-title">Start DPP Compliance Today</h2>
      <p class="section-sub">Start with a written readiness assessment for your product line. Checkout is self-serve.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:32px">
        ${catalogPaymentLinkHtml({
          planId: "dpp_readiness",
          label: "Pay $299 on Stripe",
          className: "btn btn-primary",
        })}
        ${checkoutEmailFormHtml({
          action: "/protocol/checkout/dpp",
          label: "Start DPP Readiness Audit — $299",
          formId: "dpp-checkout-form-footer",
          inputId: "dpp-email-footer",
          buttonClass: "btn btn-outline",
        })}
      </div>
      <p style="margin-top:16px; font-size:13px; color:var(--text-dim)">Work email enables Stripe abandoned-cart recovery if you leave checkout unfinished.</p>
    </div>
  </section>

  ${ecosystemFooter()}
</body>
</html>`;

/**
 * APP_WORKER: a Cloudflare Service Binding to `authichain-edge-router`
 * (worker-app/index.ts) — the native-Cloudflare replacement for the old
 * Vercel deployment (authichain-unified.vercel.app, which no longer exists;
 * see git history for context). A service binding invokes the target Worker
 * directly inside Cloudflare's network (no public fetch, no DNS, no extra
 * hop), and is undefined only in local `wrangler dev` runs that don't wire
 * it up — hence the fallback path below.
 *
 * IMPORTANT — this binding is declared in wrangler.toml but this repo does
 * not deploy it live as part of landing this change: confirm
 * `authichain-edge-router` is actually deployed and its D1/KV/Hyperdrive
 * bindings point at production data before this proxy target is exercised
 * in production. Until then, requests will 500 (Cloudflare returns an error
 * for an unbound/misconfigured service binding) rather than silently
 * falling back to Vercel — which is intentional: Vercel is gone, so a loud
 * failure here is more honest than a silent black hole.
 */
interface Env {
  APP_WORKER?: { fetch: (request: Request) => Promise<Response> };
  /** Next app worker (authichain-app): paid x402 verify is forwarded here. */
  VERIFY_APP?: { fetch: (request: Request) => Promise<Response> };
  /** Test-only override. Live default is 4000ms. */
  APP_WORKER_TIMEOUT_MS?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
  X402_PAY_TO?: string;
  X402_FACILITATOR_URL?: string;
  X402_NETWORK?: string;
  X402_CHAIN_ID?: string;
  X402_USDC_ASSET?: string;
  X402_PRICE_USD?: string;
  X402_DAILY_CAP_USD?: string;
}

const APP_WORKER_TIMEOUT_MS_DEFAULT = 4000;

function appWorkerTimeoutMs(env: Env): number {
  const n = Number(env.APP_WORKER_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : APP_WORKER_TIMEOUT_MS_DEFAULT;
}

/** Live Hyperdrive lookups on unknown /p/<serial> hang; crawlers wait forever. */
function passportLookupTimeoutResponse(pathname: string): Response {
  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Passport not found · AuthiChain</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Inter',system-ui,sans-serif;line-height:1.6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
h1{font-size:1.25rem;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;margin:.75rem 0 .5rem}
p{color:#a1a1aa;margin-bottom:1rem}
code{background:#09090b;border:1px solid #27272a;border-radius:.375rem;padding:.15rem .45rem;font-size:.85rem;color:#d4d4d8;word-break:break-all}
.links{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem}
a.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:.75rem;font-size:.7rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;background:#00FFD1;color:#000;text-decoration:none}
a.btn.ghost{background:transparent;border:1px solid #27272a;color:#fff}
${CHECKOUT_EMAIL_FORM_CSS}
.checkout-email-form{margin:1.25rem auto;text-align:left}
</style></head><body><main>
<h1>No passport at this URL</h1>
<p><code>${escapeHtml(pathname)}</code> is not a published product passport.</p>
${emailCheckoutWithPaymentLinkHtml({
  action: "/api/checkout/plan/strainchain_passport",
  label: "Publish a passport — $49",
  formId: "p-timeout-passport",
  inputId: "p-timeout-passport-email",
})}
${catalogPaymentLinkHtml({ planId: "dpp_readiness", label: "EU DPP Readiness — $299" })}
<div class="links"><a class="btn ghost" href="/">Home</a><a class="btn ghost" href="/dpp">EU DPP</a></div>
</main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Proxy APP_WORKER and rewrite stale one-click checkout <a href> to the
 * published Payment Links. GET /api/checkout without email is already
 * bounced; this covers HTML that still points at those URLs
 * (/p SEO hubs, /landing/*) until edge-router deploys.
 */
async function proxyAppWorker(request: Request, env: Env): Promise<Response> {
  if (!env.APP_WORKER) {
    return new Response("App worker not bound (local dev)", { status: 502 });
  }
  const pathname = new URL(request.url).pathname;
  const timeoutMs = appWorkerTimeoutMs(env);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const proxied = await Promise.race([
      env.APP_WORKER.fetch(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("APP_WORKER_TIMEOUT")),
          timeoutMs
        );
      }),
    ]);
    return rewriteProxiedCheckoutHtml(proxied);
  } catch (err) {
    if (pathname === "/p" || pathname.startsWith("/p/")) {
      return passportLookupTimeoutResponse(pathname);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Escapes text interpolated into the 404 document. */
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Answers an unknown path with a real 404.
 *
 * This worker used to end with an unconditional `return new Response(HTML)`, so
 * every unmatched URL — a typo, a retired campaign link, an invented /vs slug, a
 * malformed /cert id — answered 200 with the homepage. Nothing downstream could
 * tell a live page from a dead one: crawlers indexed phantom URLs, link checkers
 * reported clean, and the sitemap could claim anything without being wrong.
 */
function notFound(pathname: string): Response {
  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>404 — Not Found · AuthiChain</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Inter',system-ui,sans-serif;line-height:1.6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
.code{font-size:clamp(3rem,12vw,6rem);font-weight:900;color:#00FFD1;line-height:1}
h1{font-size:1.25rem;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;margin:.75rem 0 .5rem}
p{color:#a1a1aa;margin-bottom:1rem}
code{background:#09090b;border:1px solid #27272a;border-radius:.375rem;padding:.15rem .45rem;font-size:.85rem;color:#d4d4d8;word-break:break-all}
.links{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem}
a.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:.75rem;font-size:.7rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;background:#00FFD1;color:#000;text-decoration:none}
a.btn.ghost{background:transparent;border:1px solid #27272a;color:#fff}
${CHECKOUT_EMAIL_FORM_CSS}
.checkout-email-form{margin:1.25rem auto;text-align:left}
</style></head><body><main>
<div class="code">404</div>
<h1>This page does not exist</h1>
<p><code>${escapeHtml(pathname)}</code> is not a page on authichain.com.</p>
${emailCheckoutWithPaymentLinkHtml({
  action: "/api/checkout/plan/strainchain_passport",
  label: "Publish a passport — $49",
  formId: "404-passport",
  inputId: "404-passport-email",
})}
${catalogPaymentLinkHtml({ planId: "dpp_readiness", label: "EU DPP Readiness — $299" })}
<div class="links"><a class="btn" href="/">Home</a><a class="btn ghost" href="/pricing">Pricing</a><a class="btn ghost" href="/x402">x402</a></div>
</main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function handleAuthichainCom(request: Request, env: Env) {
    const url = new URL(request.url);
    // Primary site host is authichain.govchain.us. www.authichain.com still
    // 301s to the primary host; the apex and the primary host both serve the
    // site directly (never bounce the primary host).
    if (url.hostname === 'www.authichain.com') {
      url.hostname = 'authichain.govchain.us';
      return Response.redirect(url.toString(), 301);
    }
    const hostMicrosite = tryHandleMicrosite(request);
    if (hostMicrosite && url.hostname !== 'authichain.com' && url.hostname !== 'authichain.govchain.us') return hostMicrosite;
    const appHost = tryHandleAppHost(request);
    if (appHost) return appHost;
    const p = url.pathname;
    if (p === '/og-image.png' || p === '/og.png') {
      return pngResponse(OG_IMAGE_PNG_B64);
    }
    if (p === '/og-image.svg' || p === '/og.svg') {
      return assetResponse(OG_IMAGE_SVG);
    }
    if (p === '/favicon.svg' || p === '/favicon.ico' || p === '/favicon.png') {
      return assetResponse(FAVICON_SVG);
    }
    if (p === '/apple-touch-icon.svg' || p === '/apple-touch-icon.png' || p === '/apple-touch-icon-precomposed.png') {
      return assetResponse(FAVICON_SVG);
    }
    if (p === '/sitemap.xml') {
      // Only URLs this worker (or APP_WORKER) actually serves. /about, /book,
      // /authichain, /authichain/technology and /authichain/pilots were listed
      // here for months with no handler in this worker and no entry in
      // worker-app/route-manifest.ts, so each one resolved to the homepage at
      // 200 — a sitemap promising five pages that did not exist.
      const staticUrls = [
        { loc: 'https://authichain.govchain.us/', freq: 'weekly', pri: '1.0' },
        { loc: 'https://authichain.govchain.us/pricing', freq: 'weekly', pri: '0.95' },
        { loc: 'https://authichain.govchain.us/onboard', freq: 'weekly', pri: '0.95' },
        { loc: 'https://authichain.govchain.us/anchor', freq: 'weekly', pri: '0.95' },
        { loc: 'https://authichain.govchain.us/verify', freq: 'weekly', pri: '0.95' },
        { loc: 'https://authichain.govchain.us/protocol', freq: 'weekly', pri: '0.95' },
        { loc: 'https://authichain.govchain.us/digital-product-passport', freq: 'weekly', pri: '0.9' },
        { loc: 'https://authichain.govchain.us/genetics', freq: 'weekly', pri: '0.85' },
        { loc: 'https://authichain.govchain.us/genetics/mendo-love-farms', freq: 'weekly', pri: '0.85' },
        { loc: 'https://authichain.govchain.us/passport', freq: 'weekly', pri: '0.85' },
        { loc: 'https://authichain.govchain.us/dpp', freq: 'weekly', pri: '0.9' },
        { loc: 'https://authichain.govchain.us/trumark', freq: 'weekly', pri: '0.85' },
        { loc: 'https://authichain.govchain.us/made-in-america', freq: 'weekly', pri: '0.85' },
        ...micrositeSitemapUrls().map((loc) => ({ loc, freq: 'weekly', pri: '0.84' })),
        { loc: 'https://authichain.govchain.us/partners/brief', freq: 'weekly', pri: '0.8' },
        { loc: 'https://authichain.govchain.us/x402', freq: 'weekly', pri: '0.8' },
        { loc: 'https://authichain.govchain.us/.well-known/x402', freq: 'weekly', pri: '0.7' },
        { loc: 'https://authichain.govchain.us/blog/eu-dpp-manufacturer', freq: 'weekly', pri: '0.85' },
        ...icpSeoSitemapUrls().map((loc) => ({ loc, freq: 'weekly', pri: '0.82' })),
        { loc: 'https://authichain.govchain.us/authentic-agentic-economy', freq: 'weekly', pri: '0.85' },
        { loc: 'https://authichain.govchain.us/llms.txt', freq: 'weekly', pri: '0.7' },
        { loc: 'https://authichain.govchain.us/mcp', freq: 'weekly', pri: '0.7' },
        { loc: 'https://authichain.govchain.us/openapi.json', freq: 'weekly', pri: '0.65' },
        { loc: MINIAPP_CANONICAL, freq: 'weekly', pri: '0.8' },
        ...DESK_SITEMAP.map((path) => ({ loc: `https://authichain.govchain.us${path}`, freq: 'weekly' as const, pri: '0.8' })),
        { loc: 'https://authichain.govchain.us/contact', freq: 'monthly', pri: '0.7' },
      ];
      const vs = vsUrls().map((loc) => ({ loc, freq: 'monthly', pri: '0.8' }));
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticUrls, ...vs]
        .map((u) => `<url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
        .join('')}</urlset>`;
      return new Response(sitemap, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
    }
    if (p === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nSitemap: https://authichain.govchain.us/sitemap.xml\n# https://authichain.govchain.us/llms.txt\n# https://authichain.govchain.us/openapi.json\n# https://authichain.govchain.us/.well-known/x402\n', { headers: { 'Content-Type': 'text/plain' } });
    }
    const llms = tryHandleLlmsTxt(request);
    if (llms) return llms;
    const index402Verify = tryHandle402IndexVerify(request);
    if (index402Verify) return index402Verify;
    const indexNow = tryHandleEstateIndexNow(request);
    if (indexNow) return indexNow;
    const pricing = tryHandleEstatePricing(request, "authichain");
    if (pricing) return pricing;
    if (isBatteryPassportPath(p)) {
      return new Response(renderBatteryPassportPage(), {
        headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    if (isDppManufacturerArticlePath(p)) {
      return new Response(renderDppManufacturerArticle(), {
        headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    if (p === '/dapp' || p.startsWith('/dapp/')) {
      // Was a redirect to the Vercel deployment; the app now lives on this
      // same domain via the APP_WORKER service binding, so redirect same-origin.
      return Response.redirect(new URL('/dashboard', url).toString(), 302);
    }
    if (p === '/demo/strainchain' || p === '/demo/strainchain/') {
      return Response.redirect(new URL('/trumark', url).toString(), 302);
    }
    if (p === '/partners' || p === '/partners/') {
      return Response.redirect(new URL('/made-in-america', url).toString(), 302);
    }
    if (p === '/gov-gift' || p === '/gov-gift/' || p === '/apex-packet' || p === '/apex-packet/') {
      return Response.redirect('https://govchain.us/gift', 302);
    }
    if (p === '/demo' || p.startsWith('/demo/')) {
      return Response.redirect(new URL('/pricing', url).toString(), 302);
    }
    if (isTrumarkPath(p) || isMadeInAmericaPath(p)) {
      const html = isTrumarkPath(p) ? renderTrumarkPage() : renderMadeInAmericaPage();
      return new Response(html, {
        headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const microsite = tryHandleMicrosite(request);
    if (microsite) return microsite;
    const miniapp = tryHandleTelegramMiniApp(request);
    if (miniapp) return miniapp;
    const desk = tryHandleDesk(request);
    if (desk) return desk;

    const genetics = tryHandleGeneticsRoutes(request);
    if (genetics) return genetics;
    if (p === '/digital-product-passport' || p === '/dpp') {
      return new Response(dppHtml(new Date()), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // TODO(wonder): restyle from Wonder artboard tokens once the owner opens
    // the editor. Page markup is semantic; tokens live in x402-docs-page.ts.
    if (isX402DocsPath(p)) {
      return new Response(renderX402DocsPage(), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (isAuthenticAgenticEconomyPath(p)) {
      return new Response(renderAuthenticAgenticEconomyPage(), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const dppPage = tryHandleDppRoute(request);
    if (dppPage) return dppPage;
    const checkout = await tryHandleProtocolCheckout(request, env);
    if (checkout) return checkout;
    // Intercept before APP_PREFIXES — live sister sites still one-click
    // https://authichain.com/api/checkout/*, which APP_WORKER opens as
    // anonymous Stripe sessions. Bounce GET without ?email= here so an
    // authichain-com deploy stops those carts even if APP_WORKER is stale.
    const checkoutGate = tryHandleApiCheckoutEmailGate(request);
    if (checkoutGate) return checkoutGate;
    // Intercept before APP_PREFIXES — /api otherwise proxies to APP_WORKER
    // and unmounted GET /api/x402 and /api/mcp answer an empty ASSETS 404.
    const x402 = await tryHandleX402(request, env, env.VERIFY_APP);
    if (x402) return x402;
    const mcp = await tryHandleMcp(request, env, env.VERIFY_APP);
    if (mcp) return mcp;
    if (p === '/protocol' || p === '/spec') {
      return new Response(PROTOCOL_HTML, { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (p === '/anchor') {
      return new Response(ANCHOR_HTML, { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (p.startsWith('/cert/')) {
      const certId = p.slice('/cert/'.length).trim().toUpperCase();
      if (certId && /^AC-[0-9A-F]{8}$/i.test(certId)) {
        return new Response(certPage(certId), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }
    // Landing pages: /landing/:brandId — dynamic brand landing pages.
    // Handled by worker-app's renderLanding (worker-app/dynamic-pages.ts),
    // registered in DYNAMIC_HANDLER_PATHS (worker-app/route-manifest.ts).
    if (p === '/landing' || p.startsWith('/landing/')) {
      return proxyAppWorker(request, env);
    }
    // Proxy app routes to the native Cloudflare app Worker (authichain-edge-router,
    // see worker-app/index.ts) via a service binding, replacing the old Vercel
    // proxy (authichain-unified.vercel.app no longer exists — see the Env/
    // APP_WORKER doc comment above this file's `export default`).
    // Prefixes must NOT have a trailing slash so the startsWith check works correctly
    // (e.g. '/api/' would make p.startsWith('/api/'+ '/') = p.startsWith('/api//') which never matches).
    if (p === '/contact') {
      return new Response(renderContactPage(), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (p === '/vs' || p === '/vs/') {
      return new Response(renderVsIndex(), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (p.startsWith('/vs/')) {
      const def = findVsPage(p.slice('/vs/'.length).replace(/\/$/, ''));
      if (def) {
        return new Response(renderVsPage(def), { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // An unknown competitor slug is a 404, not the /vs index — otherwise every
      // invented slug would answer 200 and the sitemap would be unfalsifiable.
      return notFound(p);
    }
    if (APP_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/'))) {
      return proxyAppWorker(request, env);
    }
    const seoRedirect = tryRedirectSeoRootCanonical(request);
    if (seoRedirect) return seoRedirect;
    if (p !== '/') return notFound(p);
    return new Response(HTML, { headers: { ...HTML_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(request: Request, env: Env) {
    return withApolloTracker(request, await handleAuthichainCom(request, env));
  },
};
