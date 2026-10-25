/**
 * /dpp-checklist: minimal EU DPP readiness checklist page.
 *
 * authichain.com 404s unknown paths, so the page must be routed here.
 * Copy is reused verbatim from existing sources only:
 *   - /dpp-check hero disclaimer (dpp-check-page.ts)
 *   - docs/EU_DPP_COMPLIANCE_AUDIT.md section 1 checklist questions
 * No prices, no checkout CTA, no stats. Served noindex until the Research
 * wording gate passes.
 *
 * TODO(Research): wording gate on every visible string below before merge.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";

export const DPP_CHECKLIST_PATH = "/dpp-checklist";
export const DPP_CHECKLIST_CANONICAL = `https://authichain.com${DPP_CHECKLIST_PATH}`;

const PATHS = new Set([DPP_CHECKLIST_PATH, `${DPP_CHECKLIST_PATH}/`]);

export function isDppChecklistPath(pathname: string): boolean {
  return PATHS.has(pathname);
}

// TODO(Research): items copied verbatim from docs/EU_DPP_COMPLIANCE_AUDIT.md §1.
export const DPP_CHECKLIST_ITEMS: readonly string[] = [
  "Are all product life-cycle stages documented?",
  "Is the origin of components/materials recorded on-chain?",
  "Is there a public-facing way for consumers to verify product authenticity?",
];

// TODO(Research): disclaimer reused verbatim from the /dpp-check hero.
export const DPP_CHECKLIST_DISCLAIMER =
  "AuthiChain does not operate the EU DPP registry. This is a readiness map, not a filing, not a notified-body opinion, and not legal advice.";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDppChecklistPage(): string {
  // TODO(Research): title, heading and description are new copy.
  const title = "EU DPP Readiness Checklist | AuthiChain";
  const description = "EU DPP readiness checklist.";
  const items = DPP_CHECKLIST_ITEMS.map(
    (i) => `<li><label><input type="checkbox"> ${esc(i)}</label></li>`
  ).join("\n        ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${DPP_CHECKLIST_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [{ href: "/dpp", label: "EU DPP" }],
    { href: "/dpp-check", label: "Free DPP check" }
  )}
  <main id="main" class="container">
    <h1>EU DPP Readiness Checklist</h1>
    <ul class="dpp-checklist">
        ${items}
    </ul>
    <p class="estate-lede">${esc(DPP_CHECKLIST_DISCLAIMER)}</p>
    <p><a class="btn btn-primary" href="/dpp-check">Free DPP check</a></p>
  </main>
</body>
</html>`;
}

export function tryHandleDppChecklist(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isDppChecklistPath(new URL(request.url).pathname)) return null;
  return new Response(renderDppChecklistPage(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
