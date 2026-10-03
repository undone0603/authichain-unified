/**
 * /battery-passport/sample-audit — what the $299 EU DPP Readiness Audit
 * delivers, shown on a fictional e-bike pack before anyone pays.
 *
 * A stranger buying a $299 written deliverable with no reviews to read needs
 * to see the deliverable first. Every figure below is computed at render time
 * by the same code as the free tools (scorePack / annexXiiiRows from
 * battery-gap-map.ts, scoreDppReadiness from src/lib/dpp-readiness.ts), so the
 * sample cannot drift from what the gap map and the /dpp-check score say.
 *
 * Truth rules: the product and brand are fictional and labelled as such on
 * the page; no customer, logo or testimonial; no identifier is generated;
 * deliverables are exactly the dpp_readiness plan features; not legal advice.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing";
import { planById } from "../../../src/lib/plans";
import {
  scoreDppReadiness,
  type DppReadinessInput,
} from "../../../src/lib/dpp-readiness";
import {
  CONSISTENCY_TOLERANCE,
  annexXiiiRows,
  scorePack,
  type AnnexRow,
  type GapStatus,
  type PackInput,
} from "./battery-gap-map";
import {
  BATTERY_CHECKOUT_ACTION,
  BATTERY_PASSPORT_DEADLINE,
  BATTERY_PASSPORT_PATH,
  daysUntilDeadline,
} from "./battery-passport-page";

export const SAMPLE_AUDIT_PATH = "/battery-passport/sample-audit";
export const SAMPLE_AUDIT_CANONICAL = `https://authichain.com${SAMPLE_AUDIT_PATH}`;
export const SAMPLE_AUDIT_UTM = {
  utm_source: "site",
  utm_medium: "sample-audit",
  utm_campaign: "battery-sample-audit",
} as const;

const PATHS = new Set([SAMPLE_AUDIT_PATH, `${SAMPLE_AUDIT_PATH}/`]);

export function isSampleAuditPath(pathname: string): boolean {
  return PATHS.has(pathname);
}

/** Fictional pack. The stated energy is deliberately off so the check has a finding. */
export const SAMPLE_PACK: PackInput = {
  model: "EXAMPLE-LMT-48V-14Ah",
  statedWh: 700,
  ah: 14,
  nominalV: 48,
  cyclesLow: 800,
  cyclesHigh: 1000,
  placing: "unknown",
};

/** The fictional brand's /dpp-check answers: a website and a named owner, nothing else. */
export const SAMPLE_READINESS: DppReadinessInput = {
  category: "battery_passport",
  sellsInEu: true,
  answers: { data_host: true, data_owner: true },
};

export const SAMPLE_LABEL =
  "Sample only. The brand and the battery are fictional and not an AuthiChain customer.";

const STATUS_LABEL: Record<GapStatus, string> = {
  user_provided: "You hold it",
  needs_operator: "Operator supplies",
  not_public: "Restricted layer",
  not_art77: "Outside the passport",
};

/** Public items the cell maker usually holds, whoever the operator turns out to be. */
const CELL_MAKER_ITEMS = new Set([
  "manufacture",
  "category",
  "hazardous",
  "carbon",
  "recycled",
  "performance",
]);

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

const pct = (x: number) => `${Math.round(x * 10000) / 100}%`;

function checkoutForm(id: string, label: string): string {
  const hidden = Object.entries(SAMPLE_AUDIT_UTM)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and your readiness assessment. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

export interface SampleAudit {
  days: number;
  pack: ReturnType<typeof scorePack>;
  readiness: ReturnType<typeof scoreDppReadiness>;
  rows: AnnexRow[];
  counts: Record<GapStatus, number>;
  actions: Array<{ title: string; body: string }>;
}

/** Everything the page shows, derived from the sample inputs. Exported for tests. */
export function buildSampleAudit(now: Date = new Date()): SampleAudit {
  const pack = scorePack(SAMPLE_PACK);
  const readiness = scoreDppReadiness(SAMPLE_READINESS, { now });
  // Typed figures flip to user_provided, exactly as the gap map does.
  const rows = annexXiiiRows(SAMPLE_PACK);
  const counts: Record<GapStatus, number> = {
    user_provided: 0,
    needs_operator: 0,
    not_public: 0,
    not_art77: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  const cellMakerItems = rows
    .filter(r => r.status === "needs_operator" && CELL_MAKER_ITEMS.has(r.id))
    .map(r => r.item.toLowerCase());

  const actions: SampleAudit["actions"] = [
    {
      title: "Name the operator that places the pack on the EU market",
      body: `Every "Operator supplies" row in the gap table waits on this. Today the answer is "not sure", so ${counts.needs_operator} of the public items have no owner. If your EU distributor imports the pack, they are the operator and will ask you for the data; if you sell direct into the EU, it is you.`,
    },
    {
      title:
        "Correct the energy figure before it reaches a label or a passport",
      body: pack.consistent
        ? "Stated energy matches nominal voltage times capacity within 1%."
        : `The datasheet states ${pack.statedWh} Wh, but ${pack.nominalV} V × ${pack.ah} Ah is ${pack.vTimesAh} Wh, a ${pct(pack.deviation ?? 0)} gap (tolerance ${pct(CONSISTENCY_TOLERANCE)}). ${pack.statedWh} Wh implies ${pack.impliedV} V. Ask the cell maker which figure is right and publish one number everywhere.`,
    },
    {
      title: "Send one data request to the cell maker",
      body: `Ask in a single structured request for: ${cellMakerItems.join("; ")}. Their answers fill most of the public layer.`,
    },
    {
      title: "Get the identifiers from the operator, never invent them",
      body: "The unique battery identifier and the passport identifier come from the operator. AuthiChain does not generate either one, and this assessment leaves both blank on purpose.",
    },
    {
      title: "Keep restricted data out of the public page",
      body: `${counts.not_public} items (composition, dismantling, test reports, state of health) belong to restricted layers. Collect them, but publish them only to the people the Regulation names.`,
    },
    {
      title: "Stand up the public record behind the QR code",
      body: "The workspace included with the audit can hold the figures you have today for the operator's Art. 77 passport. A scan shows the record came from you and was not altered only when an Ed25519 signature and a mainnet anchor both check out. This sample is not that passport.",
    },
  ];

  return {
    days: daysUntilDeadline(now),
    pack,
    readiness,
    rows,
    counts,
    actions,
  };
}

export function renderSampleAuditPage(now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const a = buildSampleAudit(now);
  const title =
    "Sample EU battery passport readiness assessment (e-bike pack) | AuthiChain";
  const description = `See the written readiness assessment the $${price} EU DPP Readiness Audit delivers, worked through on a fictional 48 V e-bike battery: figure check, Annex XIII gap table and an ordered action plan.`;
  const deliverables = (plan?.features ?? [])
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  const figureRows: Array<[string, string]> = [
    ["Model", a.pack.model],
    ["Stated energy", `${a.pack.statedWh} Wh`],
    ["Nominal V × Ah", `${a.pack.vTimesAh} Wh`],
    ["Implied voltage (Wh ÷ Ah)", `${a.pack.impliedV} V`],
    ["Deviation", a.pack.deviation !== null ? pct(a.pack.deviation) : "—"],
    [
      "Consistent within 1%",
      a.pack.consistent ? "Yes" : "No — recheck Wh, Ah and V",
    ],
    ["Cycle life (datasheet)", `${a.pack.cyclesLow}–${a.pack.cyclesHigh}`],
  ];
  const figures = figureRows
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");
  const annex = a.rows
    .map(
      r =>
        `<tr><td>${esc(r.item)}</td><td>${esc(r.layer)}</td><td class="sa-status sa-${r.status}">${esc(STATUS_LABEL[r.status])}</td><td>${esc(r.value ? `${r.value}. ${r.note}` : r.note)}</td></tr>`
    )
    .join("");
  const actions = a.actions
    .map(x => `<li><strong>${esc(x.title)}.</strong> ${esc(x.body)}</li>`)
    .join("");
  const gaps = a.readiness.gaps.map(g => `<li>${esc(g)}</li>`).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Sample EU battery passport readiness assessment",
    url: SAMPLE_AUDIT_CANONICAL,
    description,
    isPartOf: { "@type": "WebSite", url: "https://authichain.com" },
    about: {
      "@type": "Service",
      name: "EU Battery Passport Readiness",
      provider: {
        "@type": "Organization",
        name: "AuthiChain",
        url: "https://authichain.com",
      },
      offers: {
        "@type": "Offer",
        price: String(price),
        priceCurrency: "USD",
        url: `https://authichain.com${BATTERY_PASSPORT_PATH}`,
      },
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SAMPLE_AUDIT_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SAMPLE_AUDIT_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .sa-sample { display:inline-block; padding:.35rem .8rem; border:1px dashed var(--border); border-radius:999px; font-size:.85rem; margin-bottom:1rem; }
    .sa-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(10rem,1fr)); gap:1rem; margin:1rem 0; }
    .sa-summary div { border:1px solid var(--border); border-radius:.75rem; padding:.9rem 1rem; }
    .sa-summary strong { display:block; font-size:1.5rem; font-variant-numeric:tabular-nums; }
    .sa-summary span { color:var(--text-dim); font-size:.88rem; }
    .sa-table { width:100%; border-collapse:collapse; margin:.75rem 0; font-size:.92rem; }
    .sa-table th, .sa-table td { text-align:left; padding:.45rem .5rem; border-top:1px solid var(--border); vertical-align:top; }
    .sa-scroll { overflow-x:auto; }
    .sa-status { white-space:nowrap; font-weight:600; }
    .sa-actions li, .sa-list li { margin:.5rem 0; line-height:1.6; }
    .sa-actions, .sa-list { margin:.25rem 0 0 1.2rem; }
    .bp-note { font-size:.9rem; color: var(--text-dim); }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
      { href: "/dpp-check", label: "Free DPP check" },
      { href: "/pricing", label: "Pricing" },
    ],
    { href: "#get-started", label: `Get my assessment — $${price}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="sa-sample">${esc(SAMPLE_LABEL)}</p>
      <h1>This is what the $${price} battery passport readiness assessment looks like.</h1>
      <p class="estate-lede hero-sub">We worked one through on a fictional 48 V e-bike pack from a brand that sells into the EU through a distributor. Yours is built the same way from your own datasheets and answers, and arrives by email as a written document. No call.</p>
      <div class="estate-actions hero-cta"><a class="btn btn-primary" href="#get-started">Get this for my battery — $${price}</a> <a class="btn btn-outline" href="${BATTERY_PASSPORT_PATH}#gap-map">Try the free gap map first</a></div>
    </div>
  </header>

  <section class="estate-section" id="summary">
    <div class="wrap">
      <h2>1. Summary</h2>
      <p class="section-sub">Scope: one battery line, <strong>${esc(a.pack.model)}</strong>, an LMT battery under Regulation (EU) 2023/1542. The passport duty applies from ${esc(BATTERY_PASSPORT_DEADLINE)}.</p>
      <div class="sa-summary">
        <div><strong>${a.days}</strong><span>days until 18 February 2027</span></div>
        <div><strong>${a.readiness.score}/100</strong><span>readiness · ${esc(a.readiness.bandLabel)}</span></div>
        <div><strong>${a.counts.user_provided}</strong><span>public items the brand already holds</span></div>
        <div><strong>${a.counts.needs_operator}</strong><span>public items waiting on the operator</span></div>
        <div><strong>${a.pack.consistent ? 0 : 1}</strong><span>datasheet figure that does not add up</span></div>
      </div>
      <p>Bottom line: the brand holds the headline figures but not the operator data that most of the passport needs, and one of the figures it holds is wrong. Neither problem is hard, but both take supplier round-trips, so they should start now rather than in January.</p>
    </div>
  </section>

  <section class="estate-section" id="figures">
    <div class="wrap">
      <h2>2. Datasheet figure check</h2>
      <p class="section-sub">We recompute energy from voltage and capacity instead of copying the headline number.</p>
      <div class="sa-scroll"><table class="sa-table"><tbody>${figures}</tbody></table></div>
      <p class="bp-note">In the fictional datasheet, ${a.pack.statedWh} Wh is on the spec sheet and ${a.pack.vTimesAh} Wh follows from the cell figures. A passport that repeats the wrong one is a public record of an error.</p>
    </div>
  </section>

  <section class="estate-section" id="gap-table">
    <div class="wrap">
      <h2>3. Annex XIII gap table</h2>
      <p class="section-sub">Every passport item, which layer it sits in, and who has to supply it.</p>
      <div class="sa-scroll"><table class="sa-table">
        <thead><tr><th>Item</th><th>Layer</th><th>Status</th><th>Value / next step</th></tr></thead>
        <tbody>${annex}</tbody>
      </table></div>
    </div>
  </section>

  <section class="estate-section" id="readiness">
    <div class="wrap">
      <h2>4. Process gaps</h2>
      <p class="section-sub">From the same questions as the free <a href="/dpp-check">DPP check</a>. The fictional brand has a website and a named compliance owner, and nothing else yet.</p>
      <ol class="sa-list">${gaps}</ol>
    </div>
  </section>

  <section class="estate-section" id="action-plan">
    <div class="wrap">
      <h2>5. Action plan, in order</h2>
      <ol class="sa-actions">${actions}</ol>
    </div>
  </section>

  <section class="estate-section" id="limits">
    <div class="wrap">
      <h2>6. What this is not</h2>
      <p>It is not a battery passport, not a notified-body opinion and not legal advice. No identifier on this page is live. Confirm obligations against Regulation (EU) 2023/1542 with your counsel. AuthiChain does not operate the EU passport registry.</p>
      <p>The only published demonstration record has a signature and a mined Polygon anchor. It is not a battery and not a passport. <a href="https://authichain.com/api/verify?id=polygon-anchor-1">Read the verdict</a> and the <a href="https://polygonscan.com/tx/0x24911473b03c19f3b1ee9b0887fd82ef648bf2c85386f9505a0336a9c1ae10b7">Polygon transaction</a>.</p>
    </div>
  </section>

  <section class="estate-cta cta-section" id="get-started">
    <div class="wrap">
      <h2>Get the same assessment for your battery</h2>
      <p class="bp-price">$${price} <span class="bp-note">one-time</span></p>
      <ul class="sa-list">${deliverables}</ul>
      <p class="section-sub">Enter your work email to open Stripe checkout. You'll get your readiness assessment and workspace access by email.</p>
      <div class="estate-actions">${checkoutForm("sample-checkout", `Get my assessment — $${price}`)}</div>
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
        { href: "/dpp", label: "EU DPP" },
        {
          href: "/p/battery-passport-qr-code-requirements",
          label: "Battery QR requirements",
        },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Sample for illustration. Not legal advice."
)}
</body>
</html>`;
}
