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
//
// Stubbed (serve the SPA shell; follow-ups, see task-3.3-report.md):
//   - /status, /grants, /gallery, /reveal/<id>, /brand/qron/artwork/<id>
//
// Every branch is defensive: a lookup miss is a graceful 404/redirect, and
// any unexpected error (bad env, DB failure, etc.) falls back to the SPA
// shell rather than 500ing a crawler or a user browser.

import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { getHyperdriveDb } from "../server/db";
import {
  getCertificateByNumber,
  getProductById,
} from "../server/content-db-helpers";
import { getQronById } from "../server/identity-db-helpers";
import { products, certificates } from "../drizzle/schema";
import { BRANDS, type BrandId } from "../shared/brands";

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
}): string {
  const { title, description, canonicalPath, bodyHtml } = opts;
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
    "</head>\n" +
    "<body>\n" +
    bodyHtml +
    "\n" +
    "</body>\n" +
    "</html>"
  );
}

function htmlResponse(c: Context, body: string, status: 200 | 404): Response {
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
// committed SEO slug OR a certification serial number. Our schema has no SEO
// slug table and no `certifications.serial_number` column; the closest
// analogs are certificates.certificateNumber (server/content-db-helpers.ts's
// getCertificateByNumber) and products.serialNumber. Try both so a link
// minted either way resolves.
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

    const db = getHyperdriveDb(c.env as any);
    const result = await findPassportBySerial(db, serial);

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
    headline: "Every Product Verified. Every Transaction Trusted.",
    subhead:
      "Blockchain-powered authentication with AI verification. NFT certificates, QR scanning, and supply chain transparency in minutes.",
    features: [
      {
        icon: "🔐",
        title: "ERC-721 Certificates",
        desc: "Immutable product seals on Polygon blockchain. Cryptographic proof of authenticity with full provenance.",
      },
      {
        icon: "📱",
        title: "AI QR Verification",
        desc: "5-agent consensus (Guardian, Archivist, Sentinel, Scout, Arbiter) verifies authenticity in 2.1 seconds.",
      },
      {
        icon: "📊",
        title: "Supply Chain Audit",
        desc: "22 supply chain events tracked immutably: manufacturing, customs, QA, distribution, retail receipt.",
      },
      {
        icon: "🌍",
        title: "Multi-Standard Compliance",
        desc: "EU DPP, CSRD, EUDR, FDA DSCSA, USMCA, ISO 22005. One integration covers every requirement.",
      },
      {
        icon: "⚡",
        title: "$0.004 Per Seal",
        desc: "Industry-leading pricing. No setup fees. Monthly plans from $49 (Starter) to $1,999 (Enterprise).",
      },
      {
        icon: "✅",
        title: "Zero Dependencies",
        desc: "Open protocol. Offline verification. No vendor lock-in. Run the verifier on your own machine.",
      },
    ],
    stats: [
      { value: "2.1s", label: "Verification Time" },
      { value: "5", label: "AI Agents" },
      { value: "22+", label: "Supply Events" },
    ],
    closingLine:
      "Start protecting your products today. First seal included. No credit card required.",
    primaryCta: { label: "Get Started Free", href: "/onboard" },
    secondaryCta: { label: "Book a Demo", href: "mailto:hello@authichain.com" },
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
    '<a href="' +
    escapeHtml(content.primaryCta.href) +
    '">' +
    escapeHtml(content.primaryCta.label) +
    "</a>\n" +
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
      bodyHtml: body,
    }),
    200
  );
}

// --- Dispatcher --------------------------------------------------------------

// Renders every path owned by DYNAMIC_HANDLER_PATHS (worker-app/route-manifest.ts).
// Implemented: /s (redirect), /p (product passport), /verify (verification).
// Stubbed (serve the SPA shell): /status, /grants, /gallery, /reveal,
// /brand/qron/artwork -- none were marked launch-critical at pre-flight; see
// task-3.3-report.md for follow-up scope.
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

  // Stubs: /status, /grants, /gallery, /reveal/<id>, /brand/qron/artwork/<id>.
  return serveSpaShell(c);
}
