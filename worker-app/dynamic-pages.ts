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
import { getCertificateByNumber, getProductById } from "../server/content-db-helpers";
import { getQronById } from "../server/identity-db-helpers";
import { products, certificates } from "../drizzle/schema";

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
    new Request(new URL("/index.html", c.req.url), c.req.raw),
  );
}

function htmlDocument(opts: {
  title: string;
  description: string;
  canonicalPath: string;
  bodyHtml: string;
}): string {
  const { title, description, canonicalPath, bodyHtml } = opts;
  return "<!doctype html>\n" +
    "<html lang=\"en\">\n" +
    "<head>\n" +
    "<meta charset=\"utf-8\">\n" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "<title>" + escapeHtml(title) + "</title>\n" +
    "<meta name=\"description\" content=\"" + escapeHtml(description) + "\">\n" +
    "<link rel=\"canonical\" href=\"" + escapeHtml(canonicalPath) + "\">\n" +
    "</head>\n" +
    "<body>\n" +
    bodyHtml + "\n" +
    "</body>\n" +
    "</html>";
}

function htmlResponse(c: Context, body: string, status: 200 | 404): Response {
  return c.html(body, status);
}

function notFoundHtml(heading: string, message: string, canonicalPath: string): string {
  return htmlDocument({
    title: heading + " | AuthiChain",
    description: message,
    canonicalPath,
    bodyHtml:
      "<main>\n" +
      "<h1>" + escapeHtml(heading) + "</h1>\n" +
      "<p>" + escapeHtml(message) + "</p>\n" +
      "<p><a href=\"/\">Return home</a></p>\n" +
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
      const revealUrl = new URL("/reveal/" + encodeURIComponent(String(qron.id)), c.req.url);
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
async function findPassportBySerial(db: ReturnType<typeof getHyperdriveDb>, serial: string) {
  const cert = await getCertificateByNumber(db, serial);
  if (cert) {
    const product = await getProductById(db, cert.productId);
    if (product) return { product, cert };
  }

  const rows = await db.select().from(products).where(eq(products.serialNumber, serial)).limit(1);
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
  if (cert.status === "active") return { label: "Verified Authentic", verified: true };
  if (cert.status === "revoked") return { label: "Certification Revoked", verified: false };
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
        notFoundHtml("Product Not Found", "No serial number was provided.", pathname),
        404,
      );
    }

    const db = getHyperdriveDb(c.env as any);
    const result = await findPassportBySerial(db, serial);

    if (!result) {
      return htmlResponse(
        c,
        notFoundHtml(
          "Product Not Found",
          "No product or certificate was found on the AuthiChain registry for \"" + serial + "\".",
          pathname,
        ),
        404,
      );
    }

    const { product, cert } = result;
    const { label, verified } = certStatusLabel(cert);
    const title = product.name + " -- Product Passport | AuthiChain";
    const description = label + ": " + product.name + (product.brand ? " by " + product.brand : "") +
      ". AuthiChain digital product passport and certification status.";

    const body =
      "<main>\n" +
      "<p data-verified=\"" + verified + "\">" + escapeHtml(label) + "</p>\n" +
      "<h1>" + escapeHtml(product.name) + "</h1>\n" +
      (product.brand ? "<p>" + escapeHtml(product.brand) + "</p>\n" : "") +
      (product.description ? "<p>" + escapeHtml(product.description) + "</p>\n" : "") +
      "<dl>\n" +
      (product.manufacturer ? "<dt>Manufacturer</dt><dd>" + escapeHtml(product.manufacturer) + "</dd>\n" : "") +
      "<dt>Serial Number</dt><dd>" + escapeHtml(serial) + "</dd>\n" +
      (cert ? "<dt>Certificate Number</dt><dd>" + escapeHtml(cert.certificateNumber) + "</dd>\n" : "") +
      "<dt>Status</dt><dd>" + escapeHtml(label) + "</dd>\n" +
      "</dl>\n" +
      "</main>";

    return htmlResponse(
      c,
      htmlDocument({ title, description, canonicalPath: pathname, bodyHtml: body }),
      200,
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
      "<form action=\"/verify\" method=\"get\">\n" +
      "<label for=\"id\">Product ID</label>\n" +
      "<input id=\"id\" name=\"id\" type=\"text\" required>\n" +
      "<button type=\"submit\">Verify</button>\n" +
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
    const rawPathSegment = url.pathname.replace(/^\/verify\/?/, "").replace(/\/+$/, "");
    const pathSegment = decodeURIComponent(rawPathSegment);
    const identifier = idParam || pathSegment || null;

    if (!identifier) {
      return htmlResponse(c, verifyPromptHtml(), 200);
    }

    const db = getHyperdriveDb(c.env as any);

    let product: any = null;
    const numericId = Number(idParam);
    if (idParam && Number.isFinite(numericId) && String(numericId) === idParam) {
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
          "No product was found on the AuthiChain registry for \"" + identifier + "\".",
          "/verify",
        ),
        404,
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
    const description = status + ": " + product.name + (product.brand ? " by " + product.brand : "") + ".";

    const body =
      "<main>\n" +
      "<p data-verified=\"" + verified + "\">" + escapeHtml(status) + "</p>\n" +
      "<h1>" + escapeHtml(product.name) + "</h1>\n" +
      (product.brand ? "<p>" + escapeHtml(product.brand) + "</p>\n" : "") +
      (product.description ? "<p>" + escapeHtml(product.description) + "</p>\n" : "") +
      "<dl>\n" +
      (product.category ? "<dt>Category</dt><dd>" + escapeHtml(product.category) + "</dd>\n" : "") +
      (product.manufacturer ? "<dt>Manufacturer</dt><dd>" + escapeHtml(product.manufacturer) + "</dd>\n" : "") +
      (product.serialNumber ? "<dt>Serial Number</dt><dd>" + escapeHtml(product.serialNumber) + "</dd>\n" : "") +
      "</dl>\n" +
      "</main>";

    return htmlResponse(
      c,
      htmlDocument({ title, description, canonicalPath: "/verify", bodyHtml: body }),
      200,
    );
  } catch (err) {
    console.error("[dynamic-pages] /verify lookup failed", err);
    return serveSpaShell(c);
  }
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

  // Stubs: /status, /grants, /gallery, /reveal/<id>, /brand/qron/artwork/<id>.
  return serveSpaShell(c);
}
