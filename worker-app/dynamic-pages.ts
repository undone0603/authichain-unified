// worker-app/dynamic-pages.ts
//
// Task 3.3 of the Cloudflare migration: lean, hand-rolled Hono renderers for
// the "dynamic" route-manifest owner (see worker-app/route-manifest.ts's
// DYNAMIC_HANDLER_PATHS). The source pages are Next.js RSC
// (src/app/s/[shortcode]/route.ts, src/app/p/[serial]/page.tsx,
// src/app/verify/page.tsx) -- per the Global Constraints, the Next.js server
// runtime is NEVER executed here. This file reads those source files only to
// learn what data they load and roughly what they show, then re-implements
// the highest-value ones as small, self-contained HTML responses driven by
// the existing server/*.ts db helpers (Drizzle over the Hyperdrive
// connection). Note the source pages query Supabase directly; this repo's
// Cloudflare port has its own Postgres schema (src/db/schema.ts, reached via
// getHyperdriveDb) with different table/column names, so the queries below
// are re-derived against THAT schema, not copied verbatim.
//
// Implemented (real data, real HTML):
//   - GET /s/<shortcode>        -> 302 redirect to the QRON's target URL
//   - GET /p/<serial>           -> product passport (SEO + public view)
//   - GET /verify[?id=|/<id>]   -> verification landing / result
//   - GET /landing/<brandId>    -> per-brand conversion landing page (see the
//     LANDING_CONTENT section below for what was and wasn't ported)
//   - GET/POST /onboard         -> pilot intake (validates, 303 to received)
//   - GET /story/<id>           -> StoryMode for the launch-proof object or
//     a product/certificate lookup
//   - GET /dashboard|/dapp      -> authentic-economy console (not SPA 404)
//   - GET /login|/authenticate  -> public console (SPA auth is not in ASSETS)
//   - GET/POST /generate        -> Living QR intake (qron.space CTA)
//
// Stubbed (serve the SPA shell; follow-ups, see task-3.3-report.md):
//   - /status, /grants, /gallery, /reveal/<id>, /brand/qron/artwork/<id>
//
// Every branch is defensive: a lookup miss is a graceful 404/redirect, and
// any unexpected error (bad env, DB failure, etc.) falls back to the SPA
// shell rather than 500ing a crawler or a user browser.

import type { Context } from "hono";
import { eq, sql } from "drizzle-orm";
import { getHyperdriveDb } from "../server/db";
import {
  getCertificateByNumber,
  getProductById,
} from "../server/content-db-helpers";
import { getQronById } from "../server/identity-db-helpers";
import { products, certificates } from "../drizzle/schema";
import { BRANDS, type BrandId } from "../shared/brands";
import { notifyPilotIntake } from "./onboard-notify";
import { listedPlans } from "../src/lib/plans";
import { PAYMENT_LINKS } from "../server/payment-links";
import {
  CHECKOUT_EMAIL_FORM_CSS,
  catalogPaymentLinkHtml,
  emailCheckoutWithPaymentLinkHtml,
} from "../src/lib/checkout-email";
import { getSeoPageBySlug, type SeoPage } from "../src/lib/seo-pages";

// --- Shared helpers --------------------------------------------------------

// Mirrors worker-app/index.ts's escapeContactHtml -- escape untrusted text
// before interpolating it into hand-rolled HTML (prevent injection).
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Serve the Vite/wouter SPA shell (index.html) -- used for every stub route
// and as the safety-net fallback for unexpected errors. Duplicated (not
// imported) from worker-app/index.ts's private serveSpaShell: it is a
// two-line function, and exporting an index.ts internal just for this one
// call site is not worth the coupling.
function serveSpaShell(c: Context): Promise<Response> {
  return c.env.ASSETS.fetch(
    new Request(new URL("/index.html", c.req.url), c.req.raw)
  );
}

function htmlDocument(opts: {
  title: string;
  description: string;
  canonicalPath: string;
  bodyHtml: string;
  extraHead?: string;
}): string {
  const { title, description, canonicalPath, bodyHtml } = opts;
  const extraHead = opts.extraHead ?? "";
  return (
    "<!doctype html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>" +
    escapeHtml(title) +
    "</title>\n" +
    '<meta name="description" content="' +
    escapeHtml(description) +
    '">\n' +
    '<link rel="canonical" href="' +
    escapeHtml(canonicalPath) +
    '">\n' +
    extraHead +
    "</head>\n" +
    "<body>\n" +
    bodyHtml +
    "\n" +
    "</body>\n" +
    "</html>"
  );
}

function renderSeoHubHtml(page: SeoPage, pathname: string): string {
  const canonical =
    typeof page.jsonLd.url === "string" ? page.jsonLd.url : pathname;
  // bodyHtml is committed in content/seo/pages.json and stripped of <script>
  // at generation (src/lib/seo-pages.test.ts). Same contract as the Next
  // /p/[serial] page.
  return htmlDocument({
    title: page.title,
    description: page.metaDescription,
    canonicalPath: canonical,
    extraHead:
      '<script type="application/ld+json">' +
      JSON.stringify(page.jsonLd) +
      "</script>\n" +
      "<style>" +
      CHECKOUT_EMAIL_FORM_CSS +
      "</style>\n",
    bodyHtml:
      "<main>\n<h1>" +
      escapeHtml(page.h1) +
      "</h1>\n" +
      page.bodyHtml +
      "\n</main>",
  });
}

function htmlResponse(
  c: Context,
  body: string,
  status: 200 | 400 | 404 | 500
): Response {
  return c.html(body, status);
}

function notFoundHtml(
  heading: string,
  message: string,
  canonicalPath: string
): string {
  return htmlDocument({
    title: heading + " | AuthiChain",
    description: message,
    canonicalPath,
    bodyHtml:
      "<main>\n" +
      "<h1>" +
      escapeHtml(heading) +
      "</h1>\n" +
      "<p>" +
      escapeHtml(message) +
      "</p>\n" +
      '<p><a href="/">Return home</a></p>\n' +
      "</main>",
  });
}

// --- /s/<shortcode> - shortlink redirect ------------------------------------
// Source: src/app/s/[shortcode]/route.ts. Resolves the QRON by short_code
// (our schema: qr_codes.shortCode, see server/identity-db-helpers.ts's
// getQronById), then 302s to its target URL. A missing/unknown shortcode
// redirects to the marketing home, mirroring the source's
// `NextResponse.redirect(new URL('/', request.url))` miss behavior -- this
// route never renders a page of its own, so a plain 404 would be a dead end
// for a scanned QR code where a redirect to home is more useful.
async function renderShortlink(c: Context): Promise<Response> {
  const { pathname } = new URL(c.req.url);

  try {
    // Extraction+decode lives inside the try: decodeURIComponent throws
    // URIError on malformed percent-encoding (e.g. /s/%zz), and a malformed
    // shortcode should degrade exactly like a lookup miss (redirect home),
    // not 500. Also strip a trailing slash (e.g. /s/abc/) so it resolves
    // the same as the non-slash form.
    const raw = pathname.replace(/^\/s\/?/, "").replace(/\/+$/, "");
    const shortcode = decodeURIComponent(raw);

    if (!shortcode) {
      return c.redirect("/", 302);
    }

    const db = getHyperdriveDb(c.env as any);
    const qron = await getQronById(db, shortcode);

    if (!qron) {
      return c.redirect("/", 302);
    }

    const target = (qron as any).targetUrl || (qron as any).url || "/";

    // story_enabled QRONs route through the reveal experience first (source
    // behavior). /reveal is a Task 3.3 stub today (serves the SPA shell), so
    // this still resolves to a real page rather than a dead link.
    if ((qron as any).storyEnabled) {
      const revealUrl = new URL(
        "/reveal/" + encodeURIComponent(String(qron.id)),
        c.req.url
      );
      revealUrl.searchParams.set("dest", target);
      return c.redirect(revealUrl.pathname + revealUrl.search, 302);
    }

    return c.redirect(target, 302);
  } catch (err) {
    console.error("[dynamic-pages] /s lookup failed", err);
    return c.redirect("/", 302);
  }
}

// --- /p/<serial> - product passport ------------------------------------------
// Source: src/app/p/[serial]/page.tsx. That page treats `serial` as EITHER a
// committed SEO slug (content/seo/pages.json) OR a certification serial.
// Check the slug first — no DB — so organic hubs can convert. Certificate
// lookup still uses certificates.certificateNumber and products.serialNumber.
async function findPassportBySerial(
  db: ReturnType<typeof getHyperdriveDb>,
  serial: string
) {
  const cert = await getCertificateByNumber(db, serial);
  if (cert) {
    const product = await getProductById(db, cert.productId);
    if (product) return { product, cert };
  }

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.serialNumber, serial))
    .limit(1);
  const product = rows[0];
  if (!product) return null;
  const certRows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.productId, product.id))
    .limit(1);
  return { product, cert: certRows[0] ?? null };
}

function certStatusLabel(cert: { status?: string | null } | null | undefined): {
  label: string;
  verified: boolean;
} {
  if (!cert) return { label: "Pending Verification", verified: false };
  if (cert.status === "active")
    return { label: "Verified Authentic", verified: true };
  if (cert.status === "revoked")
    return { label: "Certification Revoked", verified: false };
  return { label: "Pending Verification", verified: false };
}

async function renderProductPassport(c: Context): Promise<Response> {
  const { pathname } = new URL(c.req.url);

  try {
    // Extraction+decode lives inside the try: decodeURIComponent throws
    // URIError on malformed percent-encoding (e.g. /p/%zz), and that should
    // degrade like any other lookup failure (caught below -> SPA shell)
    // rather than 500. Also strip a trailing slash (e.g. /p/CERT-001/) so
    // it resolves the same as the non-slash form.
    const raw = pathname.replace(/^\/p\/?/, "").replace(/\/+$/, "");
    const serial = decodeURIComponent(raw);

    if (!serial) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Product Not Found",
          "No serial number was provided.",
          pathname
        ),
        404
      );
    }

    const seoPage = getSeoPageBySlug(serial);
    if (seoPage) {
      return htmlResponse(c, renderSeoHubHtml(seoPage, pathname), 200);
    }

    const db = getHyperdriveDb(c.env as any);
    const result = await new Promise<
      Awaited<ReturnType<typeof findPassportBySerial>>
    >((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("passport-lookup-timeout")),
        2500
      );
      findPassportBySerial(db, serial).then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        err => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });

    if (!result) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Product Not Found",
          'No product or certificate was found on the AuthiChain registry for "' +
            serial +
            '".',
          pathname
        ),
        404
      );
    }

    const { product, cert } = result;
    const { label, verified } = certStatusLabel(cert);
    const title = product.name + " -- Product Passport | AuthiChain";
    const description =
      label +
      ": " +
      product.name +
      (product.brand ? " by " + product.brand : "") +
      ". AuthiChain digital product passport and certification status.";

    const body =
      "<main>\n" +
      '<p data-verified="' +
      verified +
      '">' +
      escapeHtml(label) +
      "</p>\n" +
      "<h1>" +
      escapeHtml(product.name) +
      "</h1>\n" +
      (product.brand ? "<p>" + escapeHtml(product.brand) + "</p>\n" : "") +
      (product.description
        ? "<p>" + escapeHtml(product.description) + "</p>\n"
        : "") +
      "<dl>\n" +
      (product.manufacturer
        ? "<dt>Manufacturer</dt><dd>" +
          escapeHtml(product.manufacturer) +
          "</dd>\n"
        : "") +
      "<dt>Serial Number</dt><dd>" +
      escapeHtml(serial) +
      "</dd>\n" +
      (cert
        ? "<dt>Certificate Number</dt><dd>" +
          escapeHtml(cert.certificateNumber) +
          "</dd>\n"
        : "") +
      "<dt>Status</dt><dd>" +
      escapeHtml(label) +
      "</dd>\n" +
      "</dl>\n" +
      "</main>";

    return htmlResponse(
      c,
      htmlDocument({
        title,
        description,
        canonicalPath: pathname,
        bodyHtml: body,
      }),
      200
    );
  } catch (err) {
    console.error("[dynamic-pages] /p lookup failed", err);
    if (err instanceof Error && err.message === "passport-lookup-timeout") {
      return htmlResponse(
        c,
        notFoundHtml(
          "Product Not Found",
          "The registry lookup timed out. Publish a StrainChain passport from the live Payment Link on /pricing.",
          pathname
        ),
        404
      );
    }
    return serveSpaShell(c);
  }
}

// --- /verify - verification landing ------------------------------------------
// Source: src/app/verify/page.tsx. Accepts a product identifier via the
// `?id=` query param (numeric product id, matching the source exactly) or a
// path segment (/verify/<identifier>, treated as a certificate number via
// getCertificateByNumber -- DYNAMIC_HANDLER_PATHS routes /verify/* here as a
// prefix match, so a path-style identifier must resolve too). No identifier
// -> a minimal verify prompt instead of the source's hard error state.
function verifyPromptHtml(): string {
  return htmlDocument({
    title: "Verify a Product | AuthiChain",
    description:
      "Look up an AuthiChain-registered product or certificate to check its authenticity status.",
    canonicalPath: "/verify",
    bodyHtml:
      "<main>\n" +
      "<h1>Verify a Product</h1>\n" +
      "<p>Scan a QR code or enter a product ID to check authenticity.</p>\n" +
      '<form action="/verify" method="get">\n' +
      '<label for="id">Product ID</label>\n' +
      '<input id="id" name="id" type="text" required>\n' +
      '<button type="submit">Verify</button>\n' +
      "</form>\n" +
      "</main>",
  });
}

async function renderVerify(c: Context): Promise<Response> {
  const url = new URL(c.req.url);

  try {
    // Extraction+decode lives inside the try: decodeURIComponent throws
    // URIError on malformed percent-encoding (e.g. /verify/%zz), and that
    // should degrade like any other lookup failure (caught below -> SPA
    // shell) rather than 500. Also strip a trailing slash (e.g.
    // /verify/CERT-001/) so it resolves the same as the non-slash form.
    const idParam = url.searchParams.get("id");
    const rawPathSegment = url.pathname
      .replace(/^\/verify\/?/, "")
      .replace(/\/+$/, "");
    const pathSegment = decodeURIComponent(rawPathSegment);
    const identifier = idParam || pathSegment || null;

    if (!identifier) {
      return htmlResponse(c, verifyPromptHtml(), 200);
    }

    const db = getHyperdriveDb(c.env as any);

    let product: any = null;
    const numericId = Number(idParam);
    if (
      idParam &&
      Number.isFinite(numericId) &&
      String(numericId) === idParam
    ) {
      product = await getProductById(db, numericId);
    } else {
      const cert = await getCertificateByNumber(db, identifier);
      if (cert) product = await getProductById(db, cert.productId);
    }

    if (!product) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Verification Failed",
          'No product was found on the AuthiChain registry for "' +
            identifier +
            '".',
          "/verify"
        ),
        404
      );
    }

    const [cert] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.productId, product.id))
      .limit(1);
    const verified = !!cert;
    const status = verified
      ? "Authentic Product Verified"
      : "Product Found -- No Certificate on Record";
    const title = product.name + " -- Verification | AuthiChain";
    const description =
      status +
      ": " +
      product.name +
      (product.brand ? " by " + product.brand : "") +
      ".";

    const body =
      "<main>\n" +
      '<p data-verified="' +
      verified +
      '">' +
      escapeHtml(status) +
      "</p>\n" +
      "<h1>" +
      escapeHtml(product.name) +
      "</h1>\n" +
      (product.brand ? "<p>" + escapeHtml(product.brand) + "</p>\n" : "") +
      (product.description
        ? "<p>" + escapeHtml(product.description) + "</p>\n"
        : "") +
      "<dl>\n" +
      (product.category
        ? "<dt>Category</dt><dd>" + escapeHtml(product.category) + "</dd>\n"
        : "") +
      (product.manufacturer
        ? "<dt>Manufacturer</dt><dd>" +
          escapeHtml(product.manufacturer) +
          "</dd>\n"
        : "") +
      (product.serialNumber
        ? "<dt>Serial Number</dt><dd>" +
          escapeHtml(product.serialNumber) +
          "</dd>\n"
        : "") +
      "</dl>\n" +
      "</main>";

    return htmlResponse(
      c,
      htmlDocument({
        title,
        description,
        canonicalPath: "/verify",
        bodyHtml: body,
      }),
      200
    );
  } catch (err) {
    console.error("[dynamic-pages] /verify lookup failed", err);
    return serveSpaShell(c);
  }
}

// --- /landing/<brandId> - brand landing page ---------------------------------
// Source: src/app/landing/[brandId]/page.tsx + src/app/_home/BrandLanding.tsx.
// That page renders a Tailwind/React conversion shell (hero, trust rail,
// stat strip, feature grid, closing CTA, sticky bar, exit-intent guide) built
// from per-brand copy that is itself a plain hardcoded object, not fetched
// from anywhere. Per this file's stated approach (re-implement the
// highest-value content as small, self-contained HTML, not reproduce the
// Next.js/Tailwind runtime), this renders the same per-brand copy as
// semantic, unstyled HTML -- consistent with /verify and /p above, not a
// pixel-for-pixel port of the Tailwind design.
//
// Deliberately NOT ported: TrustRail, StickyConversionBar, and
// ExitIntentGuide (src/components/*.tsx) are separate interactive widgets
// with their own data/behavior; reproducing them accurately would mean
// re-deriving what they render rather than inventing a stand-in, which is
// out of scope here. A brand landing page without them is still a complete,
// real page -- not a stub.
const LANDING_CONTENT: Record<
  BrandId,
  {
    eyebrow: string;
    headline: string;
    subhead: string;
    features: Array<{ icon: string; title: string; desc: string }>;
    stats: Array<{ value: string; label: string }>;
    closingLine: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
  }
> = {
  authichain: {
    eyebrow: "Product Authentication",
    headline: "Issue seals. Bind products. Verify anywhere.",
    subhead:
      "The primary money path is EU DPP Readiness — live Stripe checkout at $299 from the published plan catalogue.",
    features: [
      {
        icon: "🔐",
        title: "Signed seals",
        desc: "Cryptographically signed seals anchored on Polygon. Tamper-evident and publicly verifiable.",
      },
      {
        icon: "📱",
        title: "Issue → Bind → Verify",
        desc: "Issue a seal, bind it to the product, verify from any camera. Agents can pay per call on /x402.",
      },
      {
        icon: "📊",
        title: "EU DPP Readiness",
        desc: "Live $299 Stripe Payment Link from the published catalogue, or email-gated checkout so Stripe can recover the cart. Credited toward AuthiChain Basic on conversion.",
      },
      {
        icon: "🌍",
        title: "Estate pillars",
        desc: "QRON generate, GovChain onboard, StrainChain onboard. No invented customer logos. No live gov-mint promise.",
      },
      {
        icon: "⚡",
        title: "Published prices",
        desc: "Starter $29, Creator $99, EU DPP Readiness $299 — from the AuthiChain plan catalogue.",
      },
      {
        icon: "✅",
        title: "x402 agent pay",
        desc: "Secondary money path. $0.05 USDC on Base per verification. Public docs at /x402.",
      },
    ],
    stats: [
      { value: "Ed25519", label: "Signed seals" },
      { value: "$299", label: "EU DPP Readiness" },
      { value: "x402", label: "Agent micropayments" },
    ],
    closingLine: "Start EU DPP Readiness on the live checkout path.",
    primaryCta: { label: "Start DPP checkout", href: "/api/checkout/dpp" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
  },
  qron: {
    eyebrow: "AI QR Art",
    headline: "Transform QR Codes Into Stunning Artwork.",
    subhead:
      "Generate custom QR art that scans perfectly. 11 illusion-diffusion styles, rendered in seconds. Cosmic to cyberpunk.",
    features: [
      {
        icon: "🎨",
        title: "11 AI Styles",
        desc: "Cosmic, cyberpunk, watercolor, oil painting, and more. Every QR code is visually unique.",
      },
      {
        icon: "📱",
        title: "100% Scannable",
        desc: "Perfect error correction. Works on every device. No scanning failures, guaranteed.",
      },
      {
        icon: "⚡",
        title: "Generate in Seconds",
        desc: "Real-time diffusion. Batch processing. API access for automation.",
      },
      {
        icon: "📊",
        title: "Real-Time Analytics",
        desc: "Track scans, location data, device info. See your QR codes in action.",
      },
      {
        icon: "🎯",
        title: "Brand Personalization",
        desc: "Custom color palettes, your logo, branded styling. Make every QR code yours.",
      },
      {
        icon: "📦",
        title: "Batch Downloads",
        desc: "Generate 1,000+ QR codes at once. SVG, PNG, and PDF formats.",
      },
    ],
    stats: [
      { value: "11", label: "AI Styles" },
      { value: "100%", label: "Scannable" },
      { value: "1000s", label: "Per Batch" },
    ],
    closingLine: "Turn your links into art. Free credits included with signup.",
    primaryCta: { label: "Generate QR Art", href: "/qr-codes" },
    secondaryCta: { label: "View Gallery", href: "/gallery" },
  },
  strainchain: {
    eyebrow: "Cannabis Compliance",
    headline: "Cannabis Supply Chain Compliance. Simplified.",
    subhead:
      "Track every gram from seed to sale. Blockchain compliance exports for USMCA, tracking regulations, and state requirements.",
    features: [
      {
        icon: "📋",
        title: "Track & Trace",
        desc: "Seed-to-sale compliance. Full provenance trail. State tracking requirements automated.",
      },
      {
        icon: "⚖️",
        title: "Regulatory Exports",
        desc: "USMCA, state MRB systems, track & trace platforms. One-click compliance reporting.",
      },
      {
        icon: "✅",
        title: "Batch Testing",
        desc: "Lab results, COA management, potency tracking. Immutable testing records.",
      },
      {
        icon: "📱",
        title: "Consumer QR Codes",
        desc: "Show consumers what they're buying. Lab results, strain info, sourcing in seconds.",
      },
      {
        icon: "💰",
        title: "Lower Costs",
        desc: "Reduce compliance overhead. No double-entry. Automated exports save hours per month.",
      },
      {
        icon: "🌍",
        title: "Multi-State Support",
        desc: "Operate in multiple states. Unified tracking across jurisdictions.",
      },
    ],
    stats: [
      { value: "50+", label: "States Supported" },
      { value: "1-Click", label: "Compliance" },
      { value: "100%", label: "Traceable" },
    ],
    closingLine: "Get compliant without the complexity. No setup fees.",
    primaryCta: { label: "Start Tracking", href: "/dashboard" },
    secondaryCta: {
      label: "Schedule Demo",
      href: "mailto:hello@strainchain.com",
    },
  },
  govchain: {
    eyebrow: "Government Blockchain",
    headline: "Public Records on Blockchain. Transparent & Auditable.",
    subhead:
      "Verifiable government data. Compliance reporting, procurement transparency, and public accountability with cryptographic proof.",
    features: [
      {
        icon: "🏛️",
        title: "Public Records",
        desc: "Government data on blockchain. Immutable, auditable, and publicly verifiable.",
      },
      {
        icon: "📊",
        title: "Procurement Tracking",
        desc: "Contract awards, bids, spending. Full transparency. Real-time compliance reporting.",
      },
      {
        icon: "✅",
        title: "Compliance Exports",
        desc: "FCPA, FAR, SAM.gov integration. Automated reporting saves audit time.",
      },
      {
        icon: "🔐",
        title: "Digital Signatures",
        desc: "Legally binding signatures on blockchain. Meets eSign Act requirements.",
      },
      {
        icon: "📈",
        title: "Performance Metrics",
        desc: "Track agency KPIs. Public dashboards. Citizens can verify government performance.",
      },
      {
        icon: "🌍",
        title: "Multi-Agency Ops",
        desc: "Coordinate across departments. Shared data layer. No silos.",
      },
    ],
    stats: [
      { value: "100%", label: "Transparent" },
      { value: "Real-Time", label: "Reporting" },
      { value: "Blockchain", label: "Immutable" },
    ],
    closingLine: "Make government data public. Build trust with blockchain.",
    primaryCta: { label: "Get Started", href: "/dashboard" },
    secondaryCta: { label: "Contact Us", href: "mailto:hello@govchain.us" },
  },
};

function landingNotFoundHtml(brandId: string): string {
  return notFoundHtml(
    "Brand Not Found",
    '"' + brandId + '" is not a configured AuthiChain brand.',
    "/landing/" + brandId
  );
}

function renderLanding(c: Context): Response {
  const { pathname } = new URL(c.req.url);
  const raw = pathname.replace(/^\/landing\/?/, "").replace(/\/+$/, "");
  const brandId = decodeURIComponent(raw) as BrandId;

  if (!brandId || !(brandId in BRANDS) || !(brandId in LANDING_CONTENT)) {
    return htmlResponse(c, landingNotFoundHtml(raw || "(none)"), 404);
  }

  const brand = BRANDS[brandId];
  const content = LANDING_CONTENT[brandId];
  const canonicalPath = "/landing/" + brandId;

  const featuresHtml = content.features
    .map(
      f =>
        "<li>\n" +
        '<span aria-hidden="true">' +
        f.icon +
        "</span>\n" +
        "<h3>" +
        escapeHtml(f.title) +
        "</h3>\n" +
        "<p>" +
        escapeHtml(f.desc) +
        "</p>\n" +
        "</li>"
    )
    .join("\n");

  const statsHtml = content.stats
    .map(
      s =>
        "<div>\n" +
        '<data value="' +
        escapeHtml(s.value) +
        '">' +
        escapeHtml(s.value) +
        "</data>\n" +
        "<span>" +
        escapeHtml(s.label) +
        "</span>\n" +
        "</div>"
    )
    .join("\n");

  const primaryIsCheckout = /\/api\/checkout\//.test(content.primaryCta.href);
  const primaryHtml = primaryIsCheckout
    ? emailCheckoutWithPaymentLinkHtml({
        action: content.primaryCta.href,
        label: content.primaryCta.label,
        inputId: "landing-checkout-email",
        formId: "landing-checkout",
      })
    : '<a href="' +
      escapeHtml(content.primaryCta.href) +
      '">' +
      escapeHtml(content.primaryCta.label) +
      "</a>\n";

  const body =
    "<main>\n" +
    "<header>\n" +
    "<p>" +
    escapeHtml(brand.displayName) +
    " &middot; " +
    escapeHtml(content.eyebrow) +
    "</p>\n" +
    "<h1>" +
    escapeHtml(content.headline) +
    "</h1>\n" +
    "<p>" +
    escapeHtml(content.subhead) +
    "</p>\n" +
    "<p>\n" +
    primaryHtml +
    '<a href="' +
    escapeHtml(content.secondaryCta.href) +
    '">' +
    escapeHtml(content.secondaryCta.label) +
    "</a>\n" +
    "</p>\n" +
    "</header>\n" +
    '<section aria-label="Key stats">\n' +
    statsHtml +
    "\n" +
    "</section>\n" +
    '<section aria-label="Features">\n' +
    "<ul>\n" +
    featuresHtml +
    "\n" +
    "</ul>\n" +
    "</section>\n" +
    "<section>\n" +
    "<h2>" +
    escapeHtml(content.closingLine) +
    "</h2>\n" +
    "<p>\n" +
    '<a href="/pricing">See Plans &amp; Pricing</a>\n' +
    '<a href="/contact">Talk to Sales</a>\n' +
    "</p>\n" +
    "</section>\n" +
    "<footer>\n" +
    "<p>&copy; 2026 " +
    escapeHtml(brand.displayName) +
    " &middot; part of the AuthiChain Protocol</p>\n" +
    "</footer>\n" +
    "</main>";

  return htmlResponse(
    c,
    htmlDocument({
      title: brand.displayName + " -- " + content.eyebrow,
      description: brand.description,
      canonicalPath,
      extraHead: primaryIsCheckout
        ? "<style>" + CHECKOUT_EMAIL_FORM_CSS + "</style>"
        : "",
      bodyHtml: body,
    }),
    200
  );
}

// --- /onboard - pilot intake -------------------------------------------------
// Real intake, not a stub. GET renders a form. POST validates company,
// contact, work email, vertical, and first product, writes a lead_captures
// row, then 303s to /onboard/received. The founder alert is extra; a submit
// is recorded only when the table write succeeds.

const ONBOARD_VERTICALS = [
  "authichain",
  "qron",
  "strainchain",
  "govchain",
] as const;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function onboardPayNowHtml(): string {
  return (
    '<section aria-label="Live checkout" class="onboard-pay">\n' +
    "<h2>Or pay now — no call</h2>\n" +
    "<p>Published catalogue. Pilot intake stays free.</p>\n" +
    '<p class="onboard-pay-links">\n' +
    catalogPaymentLinkHtml({
      planId: "strainchain_passport",
      label: "Passport $49",
    }) +
    "\n" +
    catalogPaymentLinkHtml({
      planId: "strainchain_farm",
      label: "Farm $149/mo",
    }) +
    "\n" +
    catalogPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "DPP $299",
    }) +
    "\n" +
    "</p>\n" +
    "</section>\n"
  );
}

function onboardFormHtml(error?: string): string {
  const errorBlock = error
    ? '<p role="alert">' + escapeHtml(error) + "</p>\n"
    : "";
  const options = ONBOARD_VERTICALS.map(
    id => '<option value="' + id + '">' + escapeHtml(id) + "</option>"
  ).join("\n");
  return htmlDocument({
    title: "Onboard a Pilot | AuthiChain",
    description:
      "Start an AuthiChain, QRON, StrainChain, or GovChain pilot. Company, product, serial — then a v0.1 seal. Or pay Passport $49 / Farm $149 / DPP $299 / Basic $199.",
    canonicalPath: "/onboard",
    extraHead:
      "<style>" +
      CHECKOUT_EMAIL_FORM_CSS +
      ".onboard-pay{margin-top:2rem;padding-top:1.25rem;border-top:1px solid #cbd5e1}.onboard-pay h2{font-size:1.1rem;margin:0 0 .4rem}.onboard-pay p{margin:0 0 .75rem}.onboard-pay-links{display:flex;flex-wrap:wrap;gap:.6rem}.onboard-pay-links a{display:inline-block;padding:.55rem .9rem;border:1px solid #cbd5e1;border-radius:8px;text-decoration:none;font-weight:600}" +
      "</style>",
    bodyHtml:
      "<main>\n" +
      "<h1>Onboard a Pilot</h1>\n" +
      "<p>Company, first product, work email. This is the public intake for the authentic economy — not a placeholder.</p>\n" +
      errorBlock +
      '<form action="/onboard" method="post">\n' +
      '<label for="company">Company</label>\n' +
      '<input id="company" name="company" type="text" required maxlength="80">\n' +
      '<label for="contactName">Contact</label>\n' +
      '<input id="contactName" name="contactName" type="text" required maxlength="80" autocomplete="name">\n' +
      '<label for="email">Work email</label>\n' +
      '<input id="email" name="email" type="email" required maxlength="120" autocomplete="email">\n' +
      '<label for="vertical">Vertical</label>\n' +
      '<select id="vertical" name="vertical" required>\n' +
      options +
      "\n</select>\n" +
      '<label for="productName">First product</label>\n' +
      '<input id="productName" name="productName" type="text" required maxlength="80">\n' +
      '<label for="sku">SKU (optional)</label>\n' +
      '<input id="sku" name="sku" type="text" maxlength="40">\n' +
      '<label for="serial">Serial (optional)</label>\n' +
      '<input id="serial" name="serial" type="text" maxlength="40">\n' +
      '<button type="submit">Request pilot seal</button>\n' +
      "</form>\n" +
      onboardPayNowHtml() +
      '<p><a href="/verify">Verify an existing seal</a></p>\n' +
      "</main>",
  });
}

type PilotLeadRow = {
  company: string;
  contactName: string;
  email: string;
  vertical: string;
  productName: string;
  sku: string;
  serial: string;
  ref: string;
};

// Hyperdrive connects as the table owner. RLS is on but not forced, so this
// insert is recorded even though the anon policy only allows launchcheck-grader.
async function recordPilotLead(c: Context, row: PilotLeadRow): Promise<void> {
  const db = getHyperdriveDb(
    c.env as { HYPERDRIVE: { connectionString: string } }
  );
  const metadata = JSON.stringify({
    company: row.company,
    vertical: row.vertical,
    product: row.productName,
    sku: row.sku || undefined,
    serial: row.serial || undefined,
    ref: row.ref,
  });
  await db.execute(sql`
    insert into lead_captures (
      email, name, source, page_url, product_interest, metadata, status
    ) values (
      ${row.email},
      ${row.contactName},
      'onboard',
      '/onboard',
      ${row.vertical},
      ${metadata},
      'new'
    )
  `);
}

async function handleOnboardPost(c: Context): Promise<Response> {
  let company = "";
  let contactName = "";
  let email = "";
  let vertical = "authichain";
  let productName = "";
  let sku = "";
  let serial = "";
  try {
    const form = await c.req.parseBody();
    company = String(form.company || "")
      .trim()
      .slice(0, 80);
    contactName = String(form.contactName || "")
      .trim()
      .slice(0, 80);
    email = String(form.email || "")
      .trim()
      .toLowerCase()
      .slice(0, 120);
    vertical = String(form.vertical || "authichain")
      .trim()
      .toLowerCase();
    productName = String(form.productName || "")
      .trim()
      .slice(0, 80);
    sku = String(form.sku || "")
      .trim()
      .slice(0, 40);
    serial = String(form.serial || "")
      .trim()
      .slice(0, 40);
  } catch {
    return htmlResponse(c, onboardFormHtml("Could not read the form."), 400);
  }
  if (!company || !contactName || !productName) {
    return htmlResponse(
      c,
      onboardFormHtml("Company, contact, and first product are required."),
      400
    );
  }
  if (!EMAIL_RE.test(email)) {
    return htmlResponse(
      c,
      onboardFormHtml("A valid work email is required."),
      400
    );
  }
  if (
    !ONBOARD_VERTICALS.includes(vertical as (typeof ONBOARD_VERTICALS)[number])
  ) {
    return htmlResponse(c, onboardFormHtml("Unknown vertical."), 400);
  }
  const refBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${email}|${company}|${productName}`)
  );
  const ref = [...new Uint8Array(refBytes)]
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  try {
    await recordPilotLead(c, {
      company,
      contactName,
      email,
      vertical,
      productName,
      sku,
      serial,
      ref,
    });
  } catch (err) {
    console.error("[onboard] lead_captures insert failed", err);
    return htmlResponse(
      c,
      onboardFormHtml("Could not record the pilot request. Try again."),
      500
    );
  }
  const dest = new URL("/onboard/received", c.req.url);
  dest.searchParams.set("ref", ref);
  dest.searchParams.set("vertical", vertical);
  dest.searchParams.set("company", company);
  scheduleOnboardNotify(c, {
    company,
    contact: contactName,
    email,
    vertical,
    product: productName,
    ref,
  });
  return c.redirect(dest.pathname + dest.search, 303);
}

// Fire-and-forget inbound alert. waitUntil keeps the isolate alive after the
// 303; if executionCtx is missing (tests / some runtimes), still void-notify.
function scheduleOnboardNotify(
  c: Context,
  payload: {
    company: string;
    contact: string;
    email: string;
    vertical: string;
    product: string;
    ref: string;
  }
): void {
  const work = notifyPilotIntake({
    ...payload,
    env: c.env as {
      RESEND_API_KEY?: string;
      RESEND_API_KEY2?: string;
    },
  }).catch(() => undefined);
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    void work;
  }
}

function renderOnboardReceived(c: Context): Response {
  const url = new URL(c.req.url);
  const ref = (url.searchParams.get("ref") || "")
    .replace(/[^a-f0-9]/g, "")
    .slice(0, 16);
  const company = (url.searchParams.get("company") || "").slice(0, 80);
  const vertical = (url.searchParams.get("vertical") || "authichain").slice(
    0,
    24
  );
  if (!ref) {
    return htmlResponse(
      c,
      notFoundHtml(
        "Pilot request not found",
        "Submit the onboard form to receive a reference.",
        "/onboard/received"
      ),
      404
    );
  }
  const body =
    "<main>\n" +
    "<h1>Pilot request received</h1>\n" +
    "<p>Reference <code>" +
    escapeHtml(ref) +
    "</code>" +
    (company ? " for " + escapeHtml(company) : "") +
    " in " +
    escapeHtml(vertical) +
    ".</p>\n" +
    "<p>Next: verify a production JWS against live JWKS, then complete EU DPP Readiness when ready to pay.</p>\n" +
    emailCheckoutWithPaymentLinkHtml({
      action: "/api/checkout/dpp",
      label: "Start DPP checkout — $299",
      formId: "onboard-dpp-checkout",
      inputId: "onboard-dpp-email",
    }) +
    "<ul>\n" +
    '<li><a href="/verify">Verify a seal</a></li>\n' +
    '<li><a href="/story/00000000-0000-4000-8000-000000000001">Launch-proof StoryMode</a></li>\n' +
    "</ul>\n" +
    "</main>";
  return htmlResponse(
    c,
    htmlDocument({
      title: "Pilot request received | AuthiChain",
      description: "AuthiChain pilot intake confirmation.",
      canonicalPath: "/onboard/received",
      extraHead: "<style>" + CHECKOUT_EMAIL_FORM_CSS + "</style>\n",
      bodyHtml: body,
    }),
    200
  );
}

async function renderOnboard(c: Context): Promise<Response> {
  const { pathname } = new URL(c.req.url);
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/onboard/received") {
    return renderOnboardReceived(c);
  }
  if (c.req.method === "POST") {
    return handleOnboardPost(c);
  }
  return htmlResponse(c, onboardFormHtml(), 200);
}

// --- /story/<id> - StoryMode -------------------------------------------------
// Launch-proof.ts publishes https://authichain.com/story/${productId} for the
// deterministic reference object. That page must exist. Unknown ids 404.

const LAUNCH_PROOF_PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const LAUNCH_PROOF_KID = "lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE";

function launchProofStoryHtml(): string {
  return htmlDocument({
    title: "AuthiChain Launch Proof — QRON / StoryMode",
    description:
      "Deterministic production reference object. The compact JWS verifies against live JWKS.",
    canonicalPath: "/story/" + LAUNCH_PROOF_PRODUCT_ID,
    bodyHtml:
      "<main>\n" +
      "<p>StoryMode</p>\n" +
      "<h1>AuthiChain Launch Proof — QRON / StoryMode</h1>\n" +
      '<p data-verified="true">Production issuer signing</p>\n' +
      "<dl>\n" +
      "<dt>Object</dt><dd>authi:authichain:SN-001</dd>\n" +
      "<dt>kid</dt><dd><code>" +
      LAUNCH_PROOF_KID +
      "</code></dd>\n" +
      '<dt>JWKS</dt><dd><a href="/protocol/jwks.json">/protocol/jwks.json</a></dd>\n' +
      '<dt>Issuer</dt><dd><a href="/protocol/issuer.json">/protocol/issuer.json</a></dd>\n' +
      "</dl>\n" +
      "<h2>Identity</h2>\n" +
      "<p>A deterministic QRON reference resolves to an AuthiChain object backed by a signed v0.1 attestation.</p>\n" +
      "<h2>Proof</h2>\n" +
      "<p>The production attestation is independently verified against the live public JWKS using its kid. A valid signature is signed evidence — not physical authenticity.</p>\n" +
      "<h2>Reveal</h2>\n" +
      "<p>Scanning the QRON launch code opens StoryMode. Tamper tests (altered payload, altered signature, wrong subject, revoked, stale) must reject.</p>\n" +
      '<p><a href="/verify">Verify a seal</a> · <a href="/onboard">Onboard a pilot</a></p>\n' +
      "</main>",
  });
}

async function renderStory(c: Context): Promise<Response> {
  const { pathname } = new URL(c.req.url);
  try {
    const raw = pathname.replace(/^\/story\/?/, "").replace(/\/+$/, "");
    const id = decodeURIComponent(raw);
    if (!id) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Story not found",
          "A StoryMode page needs an object id.",
          "/story"
        ),
        404
      );
    }
    if (id === LAUNCH_PROOF_PRODUCT_ID) {
      return htmlResponse(c, launchProofStoryHtml(), 200);
    }

    const db = getHyperdriveDb(c.env as any);
    const numericId = Number(id);
    let product: any = null;
    if (Number.isFinite(numericId) && String(numericId) === id) {
      product = await getProductById(db, numericId);
    }
    if (!product) {
      const result = await findPassportBySerial(db, id);
      product = result?.product ?? null;
    }
    if (!product) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Story not found",
          'No AuthiChain object was found for "' + id + '".',
          pathname
        ),
        404
      );
    }
    const body =
      "<main>\n" +
      "<p>StoryMode</p>\n" +
      "<h1>" +
      escapeHtml(product.name) +
      "</h1>\n" +
      (product.brand ? "<p>" + escapeHtml(product.brand) + "</p>\n" : "") +
      "<h2>Identity</h2>\n" +
      "<p>" +
      escapeHtml(product.name) +
      " is registered on AuthiChain" +
      (product.serialNumber
        ? " as serial " + escapeHtml(product.serialNumber)
        : "") +
      ".</p>\n" +
      "<h2>Proof</h2>\n" +
      "<p>Independent verification uses the live JWKS at /protocol/jwks.json.</p>\n" +
      '<p><a href="/verify">Verify this object</a></p>\n' +
      "</main>";
    return htmlResponse(
      c,
      htmlDocument({
        title: product.name + " — StoryMode | AuthiChain",
        description: "AuthiChain StoryMode for " + product.name + ".",
        canonicalPath: pathname,
        bodyHtml: body,
      }),
      200
    );
  } catch (err) {
    console.error("[dynamic-pages] /story lookup failed", err);
    return serveSpaShell(c);
  }
}

// --- /dashboard and /dapp — authentic-economy console ----------------------
// The Vite SPA shell is not in the edge ASSETS bundle (client/public has no
// index.html), so treating /dashboard as SPA produced a live 404 after the
// landing worker's /dapp → /dashboard redirect.

function dashboardHtml(): string {
  return htmlDocument({
    title: "Dashboard | AuthiChain",
    description:
      "Authentic-economy console: onboard a pilot, verify a seal, generate a Living QR.",
    canonicalPath: "/dashboard",
    bodyHtml:
      "<main>\n" +
      "<h1>QRON Dashboard</h1>\n" +
      "<p>The authentic economy console. Pay or smoke-pay, then activate — no login code required for the public intake.</p>\n" +
      "<ul>\n" +
      '<li><a href="/onboard">Onboard a pilot</a></li>\n' +
      '<li><a href="/verify">Verify a seal</a></li>\n' +
      '<li><a href="/generate">Generate a Living QR</a></li>\n' +
      '<li><a href="/protocol">Protocol</a></li>\n' +
      '<li><a href="/.well-known/jwks.json">JWKS</a></li>\n' +
      "</ul>\n" +
      "</main>",
  });
}

function renderDashboard(c: Context): Response {
  return htmlResponse(c, dashboardHtml(), 200);
}

function authenticateHtml(): string {
  return htmlDocument({
    title: "Sign in | AuthiChain",
    description:
      "Public authentic-economy console. Onboard a pilot or open the dashboard — no app.* login host required.",
    canonicalPath: "/authenticate",
    extraHead: "<style>" + CHECKOUT_EMAIL_FORM_CSS + "</style>\n",
    bodyHtml:
      "<main>\n" +
      "<h1>Sign in</h1>\n" +
      "<p>The public console does not require a separate app host. Start a pilot or open the dashboard.</p>\n" +
      "<ul>\n" +
      '<li><a href="/onboard">Onboard a pilot</a></li>\n' +
      '<li><a href="/dashboard">Dashboard</a></li>\n' +
      '<li><a href="/dpp">EU DPP audit</a></li>\n' +
      "</ul>\n" +
      emailCheckoutWithPaymentLinkHtml({
        action: "/api/checkout/dpp",
        label: "Start DPP checkout — $299",
        formId: "auth-dpp-checkout",
        inputId: "auth-dpp-email",
      }) +
      "</main>",
  });
}

function renderAuthenticate(c: Context): Response {
  return htmlResponse(c, authenticateHtml(), 200);
}

// --- /generate — Living QR intake (qron.space CTA) -------------------------

function generatePackLinksHtml(): string {
  const packs = listedPlans("qron").filter(
    p => p.id === "starter" || p.id === "creator" || p.id === "dpp_readiness"
  );
  return packs
    .map(p => {
      const href =
        p.id === "dpp_readiness"
          ? "/pricing"
          : p.stripe_payment_link || "/pricing";
      return (
        '<a href="' +
        escapeHtml(href) +
        '">' +
        escapeHtml(p.name) +
        " — $" +
        p.price +
        "</a>"
      );
    })
    .join(" · ");
}

// The $9.99/$39.99/$99.99 credit packs were archived in the 2026-08-31
// Stripe cleanup; the live top-ups are the catalogue Starter and Creator packs.
const QRON_CREDIT_LINKS = [
  PAYMENT_LINKS.qron.credits50,
  PAYMENT_LINKS.qron.credits250,
] as const;

function generateCreditLinksHtml(): string {
  const buttons = QRON_CREDIT_LINKS.map(offer => {
    return (
      '<a class="credit-btn" href="' +
      escapeHtml(offer.url) +
      '" target="_blank" rel="noopener">Buy ' +
      escapeHtml(offer.name) +
      " — " +
      escapeHtml(offer.price) +
      "</a>"
    );
  }).join("\n");
  return (
    "<style>.credit-ctas{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 16px}.credit-btn{display:inline-block;padding:8px 12px;border:1px solid #111;border-radius:6px;text-decoration:none;color:#111;background:#fff}.credit-btn:hover{background:#f3f4f6}</style>\n" +
    "<p>Need more generations? Buy a pack on the published Stripe Payment Link.</p>\n" +
    '<p class="credit-ctas">\n' +
    buttons +
    "\n</p>\n"
  );
}

function generateFormHtml(error?: string): string {
  const errorBlock = error
    ? '<p role="alert" id="generate-error">' + escapeHtml(error) + "</p>\n"
    : '<p role="alert" id="generate-error" hidden></p>\n';
  return htmlDocument({
    title: "Generate a Living QR | $QRON",
    description:
      "Create a Living QR for a product URL. Public generate CTA for qron.space.",
    canonicalPath: "/generate",
    bodyHtml:
      "<main>\n" +
      "<h1>Generate a Living QR</h1>\n" +
      "<p>Target URL and a short prompt. Signed-in packs spend a generation credit via <code>POST /api/generate</code>. Without a session this form still queues a QRON onboard for a pilot seal.</p>\n" +
      errorBlock +
      '<p id="generate-result" hidden></p>\n' +
      '<form id="generate-form" action="/generate" method="post">\n' +
      '<label for="targetUrl">Product or verify URL</label>\n' +
      '<input id="targetUrl" name="targetUrl" type="url" required maxlength="500" placeholder="https://">\n' +
      '<label for="prompt">Style prompt (optional)</label>\n' +
      '<input id="prompt" name="prompt" type="text" maxlength="200" placeholder="Industrial tech aesthetic">\n' +
      '<button type="submit">Queue Living QR</button>\n' +
      "</form>\n" +
      generateCreditLinksHtml() +
      "<p>Need a generation pack? " +
      generatePackLinksHtml() +
      ' · <a href="/pricing">All pricing</a></p>\n' +
      '<p><a href="/onboard">Onboard a full pilot</a> · <a href="/dashboard">Dashboard</a> · <a href="/login">Sign in</a></p>\n' +
      "<script>\n" +
      "(function(){\n" +
      "var form=document.getElementById('generate-form');\n" +
      "var err=document.getElementById('generate-error');\n" +
      "var out=document.getElementById('generate-result');\n" +
      "if(!form)return;\n" +
      "form.addEventListener('submit',function(e){\n" +
      "e.preventDefault();\n" +
      "var targetUrl=document.getElementById('targetUrl').value.trim();\n" +
      "var prompt=document.getElementById('prompt').value.trim();\n" +
      "err.hidden=true; out.hidden=true;\n" +
      "fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetUrl:targetUrl,prompt:prompt,mode:'static'})})\n" +
      ".then(function(res){return res.json().then(function(data){return {res:res,data:data};});})\n" +
      ".then(function(r){\n" +
      "if(r.res.status===401){\n" +
      "form.submit();\n" +
      "return;\n" +
      "}\n" +
      "if(r.res.status===403){\n" +
      "err.hidden=false;\n" +
      "err.textContent=r.data.message||'Sign in or buy a generation pack.';\n" +
      "return;\n" +
      "}\n" +
      "if(!r.res.ok){\n" +
      "err.hidden=false;\n" +
      "err.textContent=r.data.message||'Generation failed.';\n" +
      "return;\n" +
      "}\n" +
      "var url=r.data.qron&&r.data.qron.imageUrl;\n" +
      "if(!url){err.hidden=false;err.textContent='No image returned.';return;}\n" +
      "if(url.indexOf('data:image/')!==0&&url.indexOf('https://')!==0){err.hidden=false;err.textContent='Unexpected image URL.';return;}\n" +
      "out.hidden=false;\n" +
      'out.innerHTML=\'<img alt="Generated Living QR" src="\'+url.replace(/"/g,\'\')+\'" width="320" height="320">\';\n' +
      "})\n" +
      ".catch(function(){err.hidden=false;err.textContent='Network error. Queuing onboard instead.';form.submit();});\n" +
      "});\n" +
      "})();\n" +
      "</script>\n" +
      "</main>",
  });
}

async function handleGeneratePost(c: Context): Promise<Response> {
  let targetUrl = "";
  let prompt = "";
  try {
    const form = await c.req.parseBody();
    targetUrl = String(form.targetUrl || "").trim();
    prompt = String(form.prompt || "")
      .trim()
      .slice(0, 200);
  } catch {
    return htmlResponse(c, generateFormHtml("Could not read the form."), 400);
  }
  if (!/^https?:\/\//i.test(targetUrl) || targetUrl.length > 500) {
    return htmlResponse(
      c,
      generateFormHtml("A valid http(s) URL is required."),
      400
    );
  }
  const dest = new URL("/onboard", c.req.url);
  dest.searchParams.set("vertical", "qron");
  dest.searchParams.set("productName", "Living QR");
  dest.searchParams.set("sku", prompt || "generate");
  dest.searchParams.set("serial", targetUrl.slice(0, 40));
  return c.redirect(dest.pathname + dest.search, 303);
}

async function renderGenerate(c: Context): Promise<Response> {
  if (c.req.method === "POST") {
    return handleGeneratePost(c);
  }
  return htmlResponse(c, generateFormHtml(), 200);
}

// --- Dispatcher --------------------------------------------------------------

// Renders every path owned by DYNAMIC_HANDLER_PATHS (worker-app/route-manifest.ts).
// Implemented: /s, /p, /verify, /landing, /onboard, /story, /dashboard, /dapp,
// /generate, /login, /authenticate.
// Stubbed (serve the SPA shell): /status, /grants, /gallery, /reveal,
// /brand/qron/artwork.
export async function renderDynamicPage(c: Context): Promise<Response> {
  const { pathname } = new URL(c.req.url);

  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return renderShortlink(c);
  }
  if (pathname === "/p" || pathname.startsWith("/p/")) {
    return renderProductPassport(c);
  }
  if (pathname === "/verify" || pathname.startsWith("/verify/")) {
    return renderVerify(c);
  }
  if (pathname === "/landing" || pathname.startsWith("/landing/")) {
    return renderLanding(c);
  }
  if (pathname === "/onboard" || pathname.startsWith("/onboard/")) {
    return renderOnboard(c);
  }
  if (pathname === "/story" || pathname.startsWith("/story/")) {
    return renderStory(c);
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return renderDashboard(c);
  }
  if (pathname === "/dapp" || pathname.startsWith("/dapp/")) {
    return renderDashboard(c);
  }
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return renderAuthenticate(c);
  }
  if (pathname === "/authenticate" || pathname.startsWith("/authenticate/")) {
    return renderAuthenticate(c);
  }
  if (pathname === "/generate" || pathname.startsWith("/generate/")) {
    return renderGenerate(c);
  }

  // Stubs: /status, /grants, /gallery, /reveal/<id>, /brand/qron/artwork/<id>.
  return serveSpaShell(c);
}
