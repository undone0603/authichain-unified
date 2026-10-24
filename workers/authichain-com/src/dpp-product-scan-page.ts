/**
 * /dpp-check/product — free single-product DPP scan (Phase 3 PR-A).
 * Plain GET form, no JavaScript, nothing stored; each result URL is shareable.
 * Scoring lives in src/lib/dpp-product-scan.ts.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";
import { DPP_CATEGORIES } from "../../../src/lib/dpp-readiness";
import {
  STOREPILOT_PRO_LINK,
  parseProductScanInput,
  scanDppProduct,
  type ProductScanInput,
  type ProductScanResult,
} from "../../../src/lib/dpp-product-scan";

export const DPP_PRODUCT_SCAN_PATH = "/dpp-check/product";
const CANONICAL = `https://authichain.com${DPP_PRODUCT_SCAN_PATH}`;

export function isDppProductScanPath(p: string): boolean {
  return p === DPP_PRODUCT_SCAN_PATH || p === `${DPP_PRODUCT_SCAN_PATH}/`;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

const FIELDS: Array<[string, string, keyof ProductScanInput]> = [
  ["name", "Product name", "name"],
  ["gtin", "GTIN (8, 12, 13 or 14 digits)", "gtin"],
  ["serial", "Serial or batch number", "serialOrBatch"],
  ["materials", "Materials", "materials"],
  ["recycled_pct", "Recycled content (%)", "recycledContentPct"],
  ["co2e_kg", "Carbon footprint (kg CO2e per unit)", "co2eKg"],
  ["care", "Care, repair or end-of-life instructions", "careRepair"],
  ["product_url", "Public product page (https)", "dataCarrierUrl"],
];

function formHtml(input: ProductScanInput | null): string {
  const options = DPP_CATEGORIES.map(
    c => `<option value="${c.id}"${c.id === input?.category ? " selected" : ""}>${esc(c.label)}</option>`
  ).join("");
  const fields = FIELDS.map(([name, label, key]) => {
    const v = input ? String(input[key] ?? "") : "";
    return `<label class="dc-field">${esc(label)}<input name="${name}" maxlength="500" value="${esc(v)}"></label>`;
  }).join("\n  ");
  return `<form class="dc-form" action="${DPP_PRODUCT_SCAN_PATH}" method="get">
  <label class="dc-field">Category<select name="category" required><option value="">Choose…</option>${options}</select></label>
  ${fields}
  <button class="btn btn-primary" type="submit">Scan this product</button>
</form>`;
}

function resultHtml(r: ProductScanResult): string {
  const rows = r.checks
    .map(c => `<li>${c.ok ? "✓" : "✗"} ${esc(c.label)}${c.gap ? ` — ${esc(c.gap)}` : ""}</li>`)
    .join("");
  return `<section class="wrap" id="result">
  <h2>Data score: ${r.score}/100</h2>
  <ul class="dc-gaps">${rows}</ul>
  <p>${esc(r.readiness.category.label)}: ${esc(r.readiness.nextStep)}</p>
  <p class="dc-cta"><a class="btn btn-primary" href="${STOREPILOT_PRO_LINK}">Scan up to 200 products: StorePilot Pro, $29 one-time</a></p>
  <p class="bp-note">${esc(r.disclaimer)}</p>
</section>`;
}

export function renderDppProductScanPage(url: URL, now: Date = new Date()): string {
  const input = parseProductScanInput(k => url.searchParams.get(k) ?? undefined);
  const result = input ? scanDppProduct(input, { now }) : null;
  const title = "Free single-product EU DPP data scan | AuthiChain";
  const description =
    "Enter one product's data and see which Digital Product Passport data points are missing. Free, nothing stored. Not legal advice.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${input ? "noindex, follow" : "index, follow"}">
  <link rel="canonical" href="${CANONICAL}">
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .dc-form { display:grid; gap:.8rem; max-width:40rem; margin:1.25rem 0; }
    .dc-field { display:flex; flex-direction:column; gap:.3rem; font-weight:600; }
    .dc-field input, .dc-field select { padding:.5rem .6rem; border:1px solid var(--border); border-radius:.5rem; font:inherit; background:transparent; color:inherit; }
    .dc-gaps li { margin:.35rem 0; line-height:1.55; }
    .bp-note { font-size:.9rem; color:var(--text-dim); }
  </style>
</head>
<body>
  ${estateSkipLink()}
<main id="main">
  <header class="estate-hero hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge">Free tool · One product</p>
      <h1>Scan one product's DPP data. Free.</h1>
      <p class="estate-lede hero-sub">See which passport data points this product record has and which are missing. Nothing is stored. AuthiChain does not operate the EU DPP registry. Not legal advice. <a href="/dpp-check">Prefer the 8-question check?</a></p>
      ${formHtml(input)}
    </div>
  </header>
${result ? resultHtml(result) : ""}
</main>
</body>
</html>`;
}
