/**
 * /battery-passport/non-lithium — what the EU battery passport asks of
 * iron-air, flow, zinc, nickel-zinc, sodium-ion and lead-acid makers.
 *
 * Every applicability cell is rendered from battery-chemistry-profiles.ts, so
 * this page and the gap report cannot drift apart. The offer is the existing
 * written gap report ($950 + $350/model), labelled readiness only.
 * Regulatory facts are dated and hedged. No customer logos or counts.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing";
import {
  BATTERY_PASSPORT_PATH,
  GAP_REPORT_EXTRA_PRICE,
  GAP_REPORT_LINK,
  GAP_REPORT_PRICE,
} from "./battery-passport-page";
import {
  APPLICABILITY_LABEL,
  CHEMISTRY_IDS,
  CHEMISTRY_PROFILES,
  DUE_DILIGENCE_FROM,
  chemistryRows,
} from "./battery-chemistry-profiles";

export const NON_LITHIUM_PATH = "/battery-passport/non-lithium";
export const NON_LITHIUM_CANONICAL = `https://authichain.com${NON_LITHIUM_PATH}`;

const PATHS = new Set([NON_LITHIUM_PATH, `${NON_LITHIUM_PATH}/`]);

export function isNonLithiumPath(pathname: string): boolean {
  return PATHS.has(pathname);
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function chemistryTable(): string {
  const head =
    "<tr><th>Chemistry</th><th>Battery passport (Art. 77)</th><th>Due diligence (Art. 48)</th><th>Recycled content (Art. 8)</th><th>Carbon footprint (Art. 7)</th></tr>";
  const body = CHEMISTRY_IDS.map(id => {
    const p = CHEMISTRY_PROFILES[id];
    const cells = chemistryRows(id)
      .map(
        r =>
          `<td><span class="nl-status nl-${r.status}">${esc(APPLICABILITY_LABEL[r.status])}</span><br><small>${esc(r.note)}</small></td>`
      )
      .join("");
    return `<tr><th scope="row">${esc(p.label)}<br><small>${esc(p.examples)}</small></th><td><span class="nl-status nl-applies">${esc(APPLICABILITY_LABEL.applies)}</span><br><small>From 18 Feb 2027 for industrial batteries over 2 kWh, EV and LMT batteries.</small></td>${cells}</tr>`;
  }).join("");
  return `<div class="nl-scroll"><table class="nl-table">${head}${body}</table></div>`;
}

export function renderNonLithiumPage(): string {
  const title = "EU battery passport for iron-air, flow and other non-lithium batteries | AuthiChain";
  const description =
    "Which EU Battery Regulation obligations reach iron-air, flow, zinc, nickel-zinc, sodium-ion and lead-acid batteries: the passport applies to all of them, but due diligence, recycled content and carbon footprint depend on chemistry.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "EU battery passport for non-lithium batteries",
    url: NON_LITHIUM_CANONICAL,
    description,
    isPartOf: { "@type": "WebSite", url: "https://authichain.com" },
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${NON_LITHIUM_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${NON_LITHIUM_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .nl-table { width:100%; border-collapse:collapse; margin:.75rem 0; font-size:.9rem; }
    .nl-table th, .nl-table td { text-align:left; padding:.5rem; border-top:1px solid var(--border); vertical-align:top; }
    .nl-table small { color:var(--text-dim); line-height:1.45; }
    .nl-scroll { overflow-x:auto; }
    .nl-status { font-weight:600; white-space:nowrap; }
    .nl-list li { margin:.5rem 0; line-height:1.6; }
    .nl-list { margin:.25rem 0 0 1.2rem; }
    .bp-note { font-size:.9rem; color: var(--text-dim); }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
      { href: `${BATTERY_PASSPORT_PATH}#gap-map`, label: "Free gap map" },
      { href: "/pricing", label: "Pricing" },
    ],
    { href: "#gap-report", label: `Gap report — $${GAP_REPORT_PRICE}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <h1>The EU battery passport for iron-air, flow and other non-lithium batteries.</h1>
      <p class="estate-lede hero-sub">From 18 February 2027, every industrial battery over 2 kWh placed on the EU market needs a digital battery passport, whatever its chemistry. Stationary storage counts as industrial. But three of the heaviest obligations depend on what is inside the battery, and most guidance is written for lithium.</p>
      <div class="estate-actions hero-cta"><a class="btn btn-primary" href="#gap-report">Gap report — $${GAP_REPORT_PRICE}</a> <a class="btn btn-outline" href="#by-chemistry">What applies to my chemistry</a></div>
    </div>
  </header>

  <section class="section" id="by-chemistry">
    <div class="wrap">
      <h2>What applies, by chemistry</h2>
      <p class="section-sub">The passport applies to all of them. Due diligence, recycled content and the carbon footprint declaration depend on the materials inside and on whether energy is stored in external tanks.</p>
      ${chemistryTable()}
      <p class="bp-note">Due diligence was postponed to ${DUE_DILIGENCE_FROM} by Regulation (EU) 2025/1561. Carbon footprint dates are conditional on the Commission's delegated acts. "Not triggered" means the article's material list does not match the chemistry; confirm it against your own bill of materials.</p>
    </div>
  </section>

  <section class="section" id="what-still-applies">
    <div class="wrap">
      <h2>What still applies to every chemistry</h2>
      <ul class="nl-list">
        <li>A passport for each battery placed on the market, reachable by QR code, with a unique identifier.</li>
        <li>General battery information: manufacturer, model, category, chemistry, weight, and place and date of manufacture.</li>
        <li>Material composition and hazardous substances, and performance and durability parameters.</li>
        <li>Restricted layers for interested persons and authorities: detailed composition, dismantling information and test reports.</li>
      </ul>
    </div>
  </section>

  <section class="section" id="gap-report">
    <div class="wrap">
      <h2>A written gap report for one battery model</h2>
      <p class="section-sub">We map one battery model against Annex XIII and mark each field as applies, not triggered (with the article reference) or applies later. You get it by email as a written document. No call, no platform to adopt.</p>
      <p class="bp-price">$${GAP_REPORT_PRICE} <span class="bp-note">first model, then $${GAP_REPORT_EXTRA_PRICE} per extra model</span></p>
      <div class="estate-actions"><a class="btn btn-primary" href="${GAP_REPORT_LINK}">Order the gap report</a></div>
      <p class="bp-note">A readiness assessment only: not a conformity assessment, not legal advice, and not an issued passport.</p>
    </div>
  </section>
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
        { href: "/dpp-check", label: "Free DPP check" },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Read",
      links: [
        {
          href: "/p/battery-passport-due-diligence-requirement",
          label: "Due diligence requirement",
        },
        {
          href: "/p/battery-passport-qr-code-requirements",
          label: "Battery QR requirements",
        },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Not legal advice."
)}
</body>
</html>`;
}
