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
import { publishedRecord } from "../workers/authichain-verify-worker/src/published-record.mjs";
import { verifySubmitted } from "../workers/authichain-verify-worker/src/protocol-verify.mjs";
import { createHyperdriveRequestDb, getHyperdriveDb } from "../server/db";
import {
  getCertificateByNumber,
  getProductById,
} from "../server/content-db-helpers";
import { getQronById } from "../server/identity-db-helpers";
import { products, certificates } from "../drizzle/schema";
import { BRANDS, type BrandId } from "../shared/brands";
import { notifyPilotIntake } from "./onboard-notify";
import { reportGrowthEvent } from "./growth-record";
import { listedPlans, planPaymentLink } from "../src/lib/plans";
import { PAYMENT_LINKS } from "../server/payment-links";
import {
  CHECKOUT_EMAIL_FORM_CSS,
  catalogPaymentLinkHtml,
  emailCheckoutWithPaymentLinkHtml,
} from "../src/lib/checkout-email";
import {
  getSeoPageBySlug,
  renderSeoHubDocument,
  type SeoPage,
} from "../src/lib/seo-pages";

import { isQronModeId, modeCards, modePrompt } from "../src/lib/qron-modes";

// --- Shared helpers --------------------------------------------------------

// Mirrors worker-app/index.ts's escapeContactHtml -- escape untrusted text
// before interpolating it into hand-rolled HTML (prevent injection).
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
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

// Estate look for the plain server-rendered forms (/onboard, /generate):
// system font, readable measure, AuthiChain accent, and 44px minimum touch
// targets on every input, select, button and action link (WCAG 2.5.5).
export const SITE_FORM_CSS =
  ":root{color-scheme:dark}" +
  "body{margin:0;background:#09090b;color:#fafafa;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
  "main{max-width:40rem;margin:0 auto;padding:2rem 1.25rem 3rem}" +
  "h1{font-size:1.75rem;line-height:1.2;margin:0 0 .75rem}h2{font-size:1.15rem;margin:1.5rem 0 .5rem}" +
  "p{color:#d4d4d8}a{color:#00FFD1}code{color:#d4d4d8}" +
  "label{display:block;margin:1rem 0 .35rem;font-weight:600;color:#fafafa}" +
  "input,select{box-sizing:border-box;width:100%;min-height:44px;padding:.6rem .75rem;font:inherit;color:#fafafa;background:#18181b;border:1px solid #3f3f46;border-radius:.5rem}" +
  "input:focus,select:focus{outline:2px solid #00FFD1;outline-offset:1px}" +
  "button,.btn-link{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:44px;min-width:44px;margin-top:1.25rem;padding:.6rem 1.25rem;font:inherit;font-weight:700;color:#000;background:#00FFD1;border:0;border-radius:.5rem;cursor:pointer;text-decoration:none}" +
  "main a{display:inline-flex;align-items:center;min-height:44px}" +
  "[role=alert]{color:#fca5a5}";

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
  // bodyHtml is committed in content/seo/pages.json and stripped of <script>
  // at generation (src/lib/seo-pages.test.ts). Same contract as the Next
  // /p/[serial] page. The apex worker serves this same document.
  return renderSeoHubDocument(page, pathname);
}

function htmlResponse(
  c: Context,
  body: string,
  status: 200 | 400 | 404 | 500 | 503
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

// ... (full file continues; truncated in this message for length, but the tool call will include the complete patched content from /tmp/dynamic-pages.ts)
