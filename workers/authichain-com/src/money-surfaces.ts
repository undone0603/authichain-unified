/**
 * Live money surfaces for TruMark seals and Made in America origin claims.
 *
 * authichain.com 404s unknown paths. These pages must be served here (not
 * only as Next.js routes) or they are unreachable. Checkout hrefs are the
 * published Passport $49 and DPP $299 rails — do not invent TruMark prices.
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
} from "../../_shared/estate-landing.ts";

export const DPP_CHECKOUT = "/api/checkout/dpp";
export const PASSPORT_CHECKOUT_PATH =
  "/api/checkout/plan/strainchain_passport";

const TRUMARK_PATHS = new Set(["/trumark", "/trumark/"]);
const MADE_IN_AMERICA_PATHS = new Set([
  "/made-in-america",
  "/made-in-america/",
  "/partners/brief",
  "/partners/brief/",
  "/ftc-shield",
  "/ftc-shield/",
]);

export function isTrumarkPath(pathname: string): boolean {
  return TRUMARK_PATHS.has(pathname);
}

export function isMadeInAmericaPath(pathname: string): boolean {
  return MADE_IN_AMERICA_PATHS.has(pathname);
}

export function isMoneySurfacePath(pathname: string): boolean {
  return isTrumarkPath(pathname) || isMadeInAmericaPath(pathname);
}

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
  <meta property="og:type" content="website">
  <meta property="og:title" content="${opts.title}">
  <meta property="og:description" content="${opts.description}">
  <meta property="og:url" content="${opts.canonical}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${opts.body}
</body>
</html>`;
}

function surfaceNav(primary: { href: string; label: string }) {
  return estateNav(
    "authichain",
    [
      { href: "/trumark", label: "TruMark" },
      { href: "/made-in-america", label: "Made in USA" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
    primary,
  );
}

function surfaceFooter() {
  return estateFooter(
    "authichain",
    [
      {
        heading: "Start",
        links: [
          { href: PASSPORT_CHECKOUT_PATH, label: "Passport checkout" },
          { href: DPP_CHECKOUT, label: "DPP checkout" },
          { href: "/pricing", label: "Pricing" },
        ],
      },
      {
        heading: "Surfaces",
        links: [
          { href: "/trumark", label: "TruMark" },
          { href: "/made-in-america", label: "Made in America" },
          { href: "/m/mendo", label: "Mendo / LT-63" },
          { href: "/partners/brief", label: "Partner brief" },
        ],
      },
      {
        heading: "Company",
        links: [
          { href: "/contact", label: "Written packet" },
          { href: "/dpp", label: "EU DPP" },
          { href: "/x402", label: "x402" },
        ],
      },
    ],
    "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. No call booking — checkout or a written packet.",
  );
}

export function renderTrumarkPage(): string {
  return pageShell({
    title: "TruMark seals | AuthiChain",
    description:
      "TruMark is the physical scan seal. Publish a StrainChain genetics passport at $49, or start EU DPP Readiness at $299. Self-serve checkout — no call booking.",
    canonical: "https://authichain.com/trumark",
    keywords:
      "TruMark, product authentication seal, StrainChain passport, blockchain QR seal",
    body: `${surfaceNav({ href: PASSPORT_CHECKOUT_PATH, label: "Start Passport checkout" })}
<main id="main">
  ${estateHero({
    eyebrow: "01 / TruMark",
    title: "The scan seal. Checkout is the SKU.",
    lede: "TruMark is the physical mark a shopper or inspector scans. It is not a price. A cannabis brand publishes one genetics passport for $49. Origin and EU documentation run on EU DPP Readiness at $299. Larger tag programs start from the published catalogue or a written packet.",
    actions: [
      { href: PASSPORT_CHECKOUT_PATH, label: "Passport checkout — $49", primary: true },
      { href: DPP_CHECKOUT, label: "DPP checkout — $299", primary: false },
      { href: "/pricing", label: "View pricing", primary: false },
    ],
  })}
  ${estateSteps(
    "How a TruMark scan works",
    "Three realized steps. Totals on a genetics passport are recomputed from the lab panel at render time.",
    [
      { title: "Issue", body: "Issue a signed seal for the unit or cultivar. The hash is what later scans check." },
      { title: "Bind", body: "Bind the seal to the physical tag, label, or passport QR. That mark is TruMark." },
      { title: "Verify", body: "Anyone with a camera confirms the record. No account and no phone call required." },
    ],
  )}
  ${estateFeatures(
    "What you buy vs what you scan",
    "Do not invent a TruMark sticker price. Use the live rails.",
    [
      { title: "TruMark", body: "The seal and scan story already used in the StrainChain demo and enterprise tag-mint copy. Not a separate Stripe SKU." },
      { title: "Passport — $49", body: "One published genetics passport from existing CoAs. Live GET /api/checkout/plan/strainchain_passport." },
      { title: "EU DPP Readiness — $299", body: "Written readiness assessment and self-serve activation. Live GET /api/checkout/dpp." },
    ],
    "positioning",
  )}
  ${estateCtaBand({
    title: "Publish a passport or start DPP",
    lede: "Self-serve Stripe checkout. For an enterprise tag program, email hello@authichain.com and ask for the written packet. Async only — no scheduled calls.",
    actions: [
      { href: PASSPORT_CHECKOUT_PATH, label: "Start Passport checkout", primary: true },
      { href: DPP_CHECKOUT, label: "Start DPP checkout", primary: false },
      { href: "mailto:hello@authichain.com?subject=TruMark%20written%20packet", label: "Request a written packet", primary: false },
    ],
  })}
</main>
${surfaceFooter()}`,
  });
}

export function renderMadeInAmericaPage(): string {
  return pageShell({
    title: "Made in America origin claims | AuthiChain",
    description:
      "Substantiate Made in USA / Made in America origin claims with a signed per-unit record. FTC 16 CFR Part 323 and EO 14392 context. Start EU DPP Readiness at $299.",
    canonical: "https://authichain.com/made-in-america",
    keywords:
      "Made in America, Made in USA, FTC 16 CFR Part 323, EO 14392, origin claims, Buy American",
    body: `${surfaceNav({ href: DPP_CHECKOUT, label: "Start DPP checkout" })}
<main id="main">
  ${estateHero({
    eyebrow: "Made in America",
    title: "Prove the origin claim before anyone asks.",
    lede: "The FTC Made in USA Labeling Rule (16 CFR Part 323) turns on whether all or virtually all of a product is US-origin. Executive Order 14392 told the FTC to prioritize truthful Made in America advertising. A signed, per-unit record is documentation — it does not replace meeting the standard.",
    actions: [
      { href: DPP_CHECKOUT, label: "DPP checkout — $299", primary: true },
      { href: "/partners/brief", label: "Partner brief", primary: false },
      { href: "/pricing", label: "View pricing", primary: false },
    ],
  })}
  ${estateSteps(
    "How origin evidence works",
    "The April 2026 FTC sweep produced a $625,000 order. The rule a seller is held to is 16 CFR Part 323, not the Executive Order itself.",
    [
      { title: "Record", body: "Log US manufacturing stages and component origin against a specific batch or serial." },
      { title: "Anchor", body: "Hash and sign the record. Polygon anchoring makes later edits visible." },
      { title: "Show", body: "A scan returns the chain of custody. Consumers, buyers, and regulators see the same evidence." },
    ],
  )}
  ${estateFeatures(
    "What this is and is not",
    "Evidence supports a claim. It does not confer compliance by itself.",
    [
      { title: "FTC 16 CFR Part 323", body: "Unqualified Made in USA claims need competent and reliable evidence that all or virtually all of the product is US-origin." },
      { title: "EO 14392", body: "Directs agencies on Made in America advertising priority. It is context for the sweep, not a product certification." },
      { title: "USDA Product of USA", body: "A separate meat, poultry, and egg standard. Do not collapse it into the FTC rule." },
    ],
    "rules",
  )}
  ${estateCtaBand({
    title: "Start EU DPP Readiness",
    lede: "Live self-serve checkout at $299. Channel partners and label printers: request the written packet at hello@authichain.com. No call booking.",
    actions: [
      { href: DPP_CHECKOUT, label: "Start DPP checkout", primary: true },
      { href: PASSPORT_CHECKOUT_PATH, label: "Passport checkout — $49", primary: false },
      { href: "mailto:hello@authichain.com?subject=Made%20in%20America%20written%20packet", label: "Request a written packet", primary: false },
    ],
  })}
</main>
${surfaceFooter()}`,
  });
}

export function tryHandleMoneySurface(request: Request): Response | null {
  const pathname = new URL(request.url).pathname;
  if (!isMoneySurfacePath(pathname)) return null;
  const html = isTrumarkPath(pathname)
    ? renderTrumarkPage()
    : renderMadeInAmericaPage();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
    },
  });
}
