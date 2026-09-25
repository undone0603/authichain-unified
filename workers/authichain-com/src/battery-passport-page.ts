/**
 * /battery-passport — the offer page for the buyer with the nearest hard
 * deadline: small e-bike / e-scooter (LMT) and industrial battery brands that
 * must ship an EU battery passport from 18 Feb 2027.
 *
 * Sells the existing $299 EU DPP Readiness Audit (price_1TwmD8…) — no new SKU,
 * no new price. Checkout is tagged utm_campaign=battery-passport so the
 * Command Center and Stripe metadata show which sales this page produced.
 *
 * Truth rules: deliverables are exactly the dpp_readiness plan features in
 * src/lib/plans.ts; regulatory facts are dated and hedged (not legal advice);
 * no customer logos, testimonials or counts.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";
import { planById } from "../../../src/lib/plans";
import {
  CONSISTENCY_TOLERANCE,
  GAP_MAP_DISCLAIMER,
  annexXiiiRows,
  type AnnexRow,
  type Placing,
} from "./battery-gap-map";

export const BATTERY_PASSPORT_PATH = "/battery-passport";
export const BATTERY_PASSPORT_CANONICAL = `https://authichain.com${BATTERY_PASSPORT_PATH}`;
export const BATTERY_CHECKOUT_ACTION = "/api/checkout/dpp";
export const BATTERY_UTM = {
  utm_source: "site",
  utm_medium: "offer-page",
  utm_campaign: "battery-passport",
} as const;
/** Battery Regulation (EU) 2023/1542, Art. 77: passport required from this date. */
export const BATTERY_PASSPORT_DEADLINE = "2027-02-18";

const PATHS = new Set([BATTERY_PASSPORT_PATH, `${BATTERY_PASSPORT_PATH}/`]);

export function isBatteryPassportPath(pathname: string): boolean {
  return PATHS.has(pathname);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

/** Whole days from `now` until the deadline (UTC), floored at 0. */
export function daysUntilDeadline(now: Date = new Date()): number {
  const end = Date.parse(`${BATTERY_PASSPORT_DEADLINE}T00:00:00Z`);
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

function checkoutForm(id: string, label: string): string {
  const hidden = Object.entries(BATTERY_UTM)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="get" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and your readiness assessment. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

const CHECKLIST: Array<{ tier: string; who: string; items: string[] }> = [
  {
    tier: "Public",
    who: "Anyone who scans the QR code",
    items: [
      "Unique battery identifier and model",
      "Manufacturer identity and place/date of manufacture",
      "Battery category, chemistry and weight",
      "Rated capacity, voltage and expected lifetime",
      "Carbon footprint information (where required for the category)",
      "Recycled content and end-of-life / collection information",
    ],
  },
  {
    tier: "Interested parties",
    who: "Repairers, remanufacturers, recyclers",
    items: [
      "Dismantling information and part numbers",
      "Safety measures for handling",
      "Detailed composition data",
    ],
  },
  {
    tier: "Authorities",
    who: "Market surveillance and the Commission",
    items: ["Test reports proving compliance", "Conformity documentation"],
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Which batteries need a passport?",
    a: "From 18 February 2027, the EU Battery Regulation requires a digital battery passport for light means of transport (LMT) batteries such as e-bike and e-scooter packs, industrial batteries above 2 kWh, and electric-vehicle batteries placed on the EU market.",
  },
  {
    q: "We are not based in the EU. Does this apply to us?",
    a: "The obligation follows the product, not the company's location: batteries placed on the EU market need a passport, whoever makes them. Your EU importer or distributor will ask you for the data.",
  },
  {
    q: "What exactly do I get for $299?",
    a: "A written readiness assessment for your battery line (which data you already have, what is missing, and who in your supply chain holds it), self-serve activation of your AuthiChain workspace, and 50 workspace generations to prepare your QR-linked passport data for the operator who places the battery on the EU market. The $299 is credited toward AuthiChain Basic if you continue.",
  },
  {
    q: "Is this legal advice or a certification?",
    a: "No. It is a readiness assessment and a structured record you can hand to the placing-on-market operator or your counsel. Confirm obligations against Regulation (EU) 2023/1542. Not legal advice.",
  },
  {
    q: "Do I have to book a call?",
    a: "No. Checkout is self-serve. Questions go to the contact page and get a written answer.",
  },
];

const GAP_PLACINGS: Placing[] = ["self", "cell_maker", "unknown"];

/**
 * Row templates per placing, computed server-side from battery-gap-map.ts with
 * no figures typed, so the browser script only flips the typed rows to
 * user_provided. Keeps a single source of truth for wording and statuses.
 */
function gapMapTemplates(): Record<Placing, AnnexRow[]> {
  const out = {} as Record<Placing, AnnexRow[]>;
  for (const placing of GAP_PLACINGS)
    out[placing] = annexXiiiRows({
      model: "",
      statedWh: 0,
      ah: 0,
      nominalV: 0,
      placing,
    });
  return out;
}

const jsonForScript = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/**
 * Browser-only calculator. Never fetches, never stores, never submits: the
 * submit handler calls preventDefault and renders with textContent only.
 * Formulas mirror scorePack() in battery-gap-map.ts.
 */
const GAP_MAP_SCRIPT = `(function () {
  var form = document.getElementById("gap-map-form");
  var out = document.getElementById("gap-map-results");
  var dataEl = document.getElementById("gap-map-data");
  if (!form || !out || !dataEl) return;
  var DATA = JSON.parse(dataEl.textContent || "{}");
  var TOL = DATA.tolerance, SLACK = 1e-9, DISCLAIMER = DATA.disclaimer;
  function rnd(x, dp) { var f = Math.pow(10, dp); var r = Math.round((x + Math.sign(x) * Number.EPSILON) * f) / f; return r === 0 ? 0 : r; }
  function num(v) { if (v === null || v === undefined || String(v).trim() === "") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function pos(v) { var n = num(v); return n !== null && n > 0 ? n : null; }
  function nonneg(v) { var n = num(v); return n !== null && n >= 0 ? n : null; }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined && text !== null) e.textContent = String(text); if (cls) e.className = cls; return e; }
  function row(tbody, cells, th) { var tr = document.createElement("tr"); for (var i = 0; i < cells.length; i++) { var c = el(th && i === 0 ? "th" : "td", cells[i].t, cells[i].c); tr.appendChild(c); } tbody.appendChild(tr); }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var model = String(f.namedItem("model").value || "").replace(/\\s+/g, " ").trim().slice(0, 120);
    var wh = pos(f.namedItem("statedWh").value), ah = pos(f.namedItem("ah").value), v = pos(f.namedItem("nominalV").value);
    var lo = nonneg(f.namedItem("cyclesLow").value), hi = nonneg(f.namedItem("cyclesHigh").value);
    var placing = String(f.namedItem("placing").value);
    if (placing !== "self" && placing !== "cell_maker") placing = "unknown";
    var errors = [];
    if (!model) errors.push("Model is required.");
    if (wh === null) errors.push("Stated energy (Wh) must be a number above 0.");
    if (ah === null) errors.push("Capacity (Ah) must be a number above 0.");
    if (v === null) errors.push("Nominal voltage (V) must be a number above 0.");
    if (lo !== null && hi !== null && lo > hi) { errors.push("Cycle range low is above high; ignored."); lo = null; hi = null; }
    var vah = v !== null && ah !== null ? rnd(v * ah, 1) : null;
    var iv = wh !== null && ah !== null ? rnd(wh / ah, 2) : null;
    var dev = null, ok = false;
    if (wh !== null && vah !== null && vah > 0) { var d = Math.abs(wh - vah) / vah; if (isFinite(d)) { dev = rnd(d, 4); ok = d <= TOL + SLACK; } }
    var cycles = lo !== null && hi !== null ? lo + "\u2013" + hi + " cycles" : lo !== null ? "\u2265 " + lo + " cycles" : hi !== null ? "\u2264 " + hi + " cycles" : null;
    var typed = { model: model || null, energy: wh !== null ? wh + " Wh" : null, capacity: ah !== null ? ah + " Ah" : null, voltage: v !== null ? v + " V" : null, cycles: cycles };
    while (out.firstChild) out.removeChild(out.firstChild);
    if (errors.length) { var ul = el("ul", null, "gm-errors"); errors.forEach(function (e) { ul.appendChild(el("li", e)); }); out.appendChild(ul); }
    out.appendChild(el("h3", "Figures"));
    var t1 = el("table", null, "gm-table"), b1 = document.createElement("tbody");
    row(b1, [{ t: "Model" }, { t: model || "\u2014" }], true);
    row(b1, [{ t: "Stated energy" }, { t: wh !== null ? wh + " Wh" : "\u2014" }], true);
    row(b1, [{ t: "Nominal V \u00d7 Ah" }, { t: vah !== null ? vah + " Wh" : "\u2014" }], true);
    row(b1, [{ t: "Implied voltage (Wh \u00f7 Ah)" }, { t: iv !== null ? iv + " V" : "\u2014" }], true);
    row(b1, [{ t: "Deviation" }, { t: dev !== null ? rnd(dev * 100, 2) + "%" : "\u2014" }], true);
    row(b1, [{ t: "Consistent within 1%" }, { t: dev === null ? "Cannot check" : ok ? "Yes" : "No \u2014 recheck Wh, Ah and V" }], true);
    t1.appendChild(b1); out.appendChild(t1);
    out.appendChild(el("h3", "Annex XIII information items"));
    var t2 = el("table", null, "gm-table"), h2 = document.createElement("thead"), b2 = document.createElement("tbody");
    row(h2, [{ t: "Item" }, { t: "Layer" }, { t: "Status" }, { t: "Value / next step" }], false);
    (DATA.rows[placing] || []).forEach(function (r) {
      var status = r.status, note = r.note;
      if (Object.prototype.hasOwnProperty.call(typed, r.id) && typed[r.id] !== null) { status = "user_provided"; note = typed[r.id] + " (figure you typed, not verified)"; }
      row(b2, [{ t: r.item }, { t: r.layer }, { t: status, c: "gm-status" }, { t: note }], false);
    });
    t2.appendChild(h2); t2.appendChild(b2); out.appendChild(t2);
    out.appendChild(el("p", DISCLAIMER, "bp-note"));
  });
})();`;

function gapMapSection(): string {
  const data = {
    tolerance: CONSISTENCY_TOLERANCE,
    disclaimer: GAP_MAP_DISCLAIMER,
    rows: gapMapTemplates(),
  };
  return `<section class="estate-section" id="gap-map">
    <div class="wrap">
      <h2>Free gap map: check your pack in your browser</h2>
      <p class="section-sub">Type the figures from your datasheet. The check runs on this page only: nothing is sent, stored or submitted.</p>
      <form class="gm-form" id="gap-map-form" novalidate autocomplete="off">
        <label>Model<input name="model" type="text" maxlength="120" required placeholder="e.g. LMT-36V-13Ah"></label>
        <label>Stated energy (Wh)<input name="statedWh" type="number" step="any" min="0" inputmode="decimal" required></label>
        <label>Capacity (Ah)<input name="ah" type="number" step="any" min="0" inputmode="decimal" required></label>
        <label>Nominal voltage (V)<input name="nominalV" type="number" step="any" min="0" inputmode="decimal" required></label>
        <label>Cycle life, low (optional)<input name="cyclesLow" type="number" step="1" min="0" inputmode="numeric"></label>
        <label>Cycle life, high (optional)<input name="cyclesHigh" type="number" step="1" min="0" inputmode="numeric"></label>
        <label>Who places it on the EU market?<select name="placing">
          <option value="self">We do (self)</option>
          <option value="cell_maker">Our cell maker (cell_maker)</option>
          <option value="unknown" selected>Not sure yet (unknown)</option>
        </select></label>
        <div class="gm-actions"><button class="btn btn-secondary" type="submit">Map my gaps</button></div>
      </form>
      <div id="gap-map-results" aria-live="polite"></div>
      <p class="bp-note" id="gap-map-disclaimer">${esc(GAP_MAP_DISCLAIMER)}</p>
    </div>
    <script type="application/json" id="gap-map-data">${jsonForScript(data)}</script>
    <script>${GAP_MAP_SCRIPT}</script>
  </section>`;
}

export function renderBatteryPassportPage(now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const days = daysUntilDeadline(now);
  const title = `EU Battery Passport for e-bike, e-scooter & industrial batteries — ready before 18 Feb 2027 | AuthiChain`;
  const description = `From 18 Feb 2027 every LMT, industrial (>2 kWh) and EV battery sold in the EU needs a QR-linked digital passport. Get a written readiness assessment that gets you ready for your first passport, for $${price}, self-serve.`;
  const checklist = CHECKLIST.map(
    g => `<article class="estate-card card">
      <h3>${esc(g.tier)}</h3>
      <p class="bp-who">${esc(g.who)}</p>
      <ul>${g.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
    </article>`
  ).join("");
  const deliverables = (plan?.features ?? [])
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  const faq = FAQ.map(
    f =>
      `<details class="bp-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
  ).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "EU Battery Passport Readiness",
        serviceType: "EU Digital Battery Passport readiness assessment",
        provider: {
          "@type": "Organization",
          name: "AuthiChain",
          url: "https://authichain.com",
        },
        areaServed: "European Union",
        url: BATTERY_PASSPORT_CANONICAL,
        offers: {
          "@type": "Offer",
          price: String(price),
          priceCurrency: "USD",
          url: BATTERY_PASSPORT_CANONICAL,
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${BATTERY_PASSPORT_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${BATTERY_PASSPORT_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .bp-countdown { display:inline-flex; gap:.5rem; align-items:baseline; padding:.35rem .8rem; border:1px solid var(--border); border-radius:999px; margin-bottom:1rem; }
    .bp-countdown strong { font-size:1.15rem; font-variant-numeric: tabular-nums; }
    .bp-who { color: var(--text-dim); margin:-.25rem 0 .5rem; font-size:.92rem; }
    .estate-card ul, .bp-list { margin:.25rem 0 0 1.1rem; }
    .estate-card li, .bp-list li { margin:.3rem 0; line-height:1.55; }
    .bp-faq { border-top:1px solid var(--border); padding:.9rem 0; }
    .bp-faq summary { cursor:pointer; font-weight:650; }
    .bp-faq p { margin:.6rem 0 0; line-height:1.65; }
    .bp-note { font-size:.9rem; color: var(--text-dim); }
    .bp-price { font-size:2rem; font-weight:750; }
    .gm-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(11rem,1fr)); gap:.75rem 1rem; margin:1rem 0; }
    .gm-form label { display:flex; flex-direction:column; gap:.3rem; font-size:.92rem; font-weight:600; }
    .gm-form input, .gm-form select { padding:.5rem .6rem; border:1px solid var(--border); border-radius:.5rem; font:inherit; background:transparent; color:inherit; }
    .gm-form .gm-actions { grid-column:1/-1; }
    .gm-table { width:100%; border-collapse:collapse; margin:.75rem 0; font-size:.92rem; }
    .gm-table th, .gm-table td { text-align:left; padding:.45rem .5rem; border-top:1px solid var(--border); vertical-align:top; }
    .gm-status { font-family:ui-monospace,monospace; font-size:.82rem; white-space:nowrap; }
    .gm-errors { color:#c0392b; }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: "/dpp", label: "EU DPP" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
    { href: "#get-started", label: `Get ready — $${price}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge">EU Battery Regulation · Digital Battery Passport</p>
      <p class="bp-countdown"><strong>${days}</strong> <span>days until 18 February 2027</span></p>
      <h1>Your e-bike, e-scooter or industrial battery needs a passport to be sold in the EU.</h1>
      <p class="estate-lede hero-sub">From 18 February 2027, every LMT battery, every industrial battery over 2 kWh and every EV battery placed on the EU market must carry a QR code linking to a digital passport. AuthiChain tells you exactly what data you're missing and gets you ready for your first passport, for a one-time $${price}. No sales call.</p>
      <div class="estate-actions hero-cta">${checkoutForm("hero-checkout", `Get passport-ready — $${price}`)}</div>
    </div>
  </header>

  <section class="estate-section" id="checklist">
    <div class="wrap">
      <h2>What a battery passport has to hold</h2>
      <p class="section-sub">Three audiences see different layers of the same record. Use this list to check what you already have before you buy anything.</p>
      <div class="estate-grid">${checklist}</div>
      <p class="bp-note">Summary of the Battery Regulation's passport content (Annex XIII), grouped by who can see it. Not legal advice; confirm against the Regulation for your category.</p>
    </div>
  </section>

${gapMapSection()}

  <section class="estate-section" id="what-you-get">
    <div class="wrap">
      <h2>What you get</h2>
      <p class="bp-price">$${price} <span class="bp-note">one-time</span></p>
      <ul class="bp-list">${deliverables}</ul>
      <p class="section-sub">Every record you publish from your AuthiChain workspace is signed and publicly verifiable, so a scan proves it came from you and hasn't been altered. It supports, and does not replace, the Art. 77 passport issued by the operator placing the battery on the EU market.</p>
    </div>
  </section>

  <section class="estate-section" id="faq">
    <div class="wrap">
      <h2>Questions</h2>
      ${faq}
    </div>
  </section>

  <section class="estate-cta cta-section" id="get-started">
    <div class="wrap">
      <h2>Start before your importer asks for it</h2>
      <p class="section-sub">Enter your work email to open Stripe checkout. You'll get your readiness assessment and workspace access by email.</p>
      <div class="estate-actions">${checkoutForm("cta-checkout", `Get passport-ready — $${price}`)}</div>
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
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Read",
      links: [
        { href: "/dpp", label: "EU DPP" },
        {
          href: "/p/battery-passport-qr-code-requirements",
          label: "Battery QR requirements",
        },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Not legal advice. No call booking — checkout or a written answer."
)}
</body>
</html>`;
}

export function tryHandleBatteryPassport(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isBatteryPassportPath(new URL(request.url).pathname)) return null;
  return new Response(
    request.method === "HEAD" ? null : renderBatteryPassportPage(),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
