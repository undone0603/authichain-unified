/**
 * /dpp-check — free EU Digital Product Passport readiness check.
 *
 * A plain GET form: submitting re-renders this page with the result, so it
 * works without JavaScript and each result URL is shareable. Scoring lives in
 * src/lib/dpp-readiness.ts (also the free MCP tool). The only paid next step
 * is the existing $299 dpp_readiness plan — no new SKU.
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
  DPP_CATEGORIES,
  DPP_QUESTIONS,
  parseDppReadinessInput,
  scoreDppReadiness,
  type DppReadinessInput,
  type DppReadinessResult,
} from "../../../src/lib/dpp-readiness";

export const DPP_CHECK_PATH = "/dpp-check";
export const DPP_CHECK_CANONICAL = `https://authichain.com${DPP_CHECK_PATH}`;
const CHECKOUT_ACTION = "https://authichain.com/checkout/dpp_readiness";
const UTM = {
  utm_source: "site",
  utm_medium: "free-tool",
  utm_campaign: "dpp-check",
} as const;

const PATHS = new Set([DPP_CHECK_PATH, `${DPP_CHECK_PATH}/`]);

export function isDppCheckPath(pathname: string): boolean {
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

function checkoutForm(id: string, label: string, category?: string): string {
  const hidden = Object.entries({
    ...UTM,
    ...(category ? { utm_content: category } : {}),
  })
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and your readiness assessment. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

function formHtml(input: DppReadinessInput | null): string {
  const cat = input?.category ?? "";
  const options = DPP_CATEGORIES.map(
    c =>
      `<option value="${c.id}"${c.id === cat ? " selected" : ""}>${esc(c.label)}</option>`
  ).join("");
  const eu = input ? input.sellsInEu : true;
  const questions = DPP_QUESTIONS.map(q => {
    const checked = input?.answers[q.id] ? " checked" : "";
    return `<label class="dc-q"><input type="checkbox" name="${q.id}" value="yes"${checked}> <span>${esc(q.question)}</span></label>`;
  }).join("");
  return `<form class="dc-form" action="${DPP_CHECK_PATH}" method="get">
  <label class="dc-field">What do you make or sell?
    <select name="category" required><option value=""${cat ? "" : " selected"} disabled>Choose a category</option>${options}</select>
  </label>
  <label class="dc-field">Do you sell into the EU (directly or through an importer)?
    <select name="sells_in_eu"><option value="yes"${eu ? " selected" : ""}>Yes</option><option value="no"${eu ? "" : " selected"}>No</option></select>
  </label>
  <fieldset class="dc-set"><legend>Tick what is already true</legend>${questions}</fieldset>
  <button class="btn btn-primary" type="submit">Check my readiness</button>
</form>`;
}

function resultHtml(r: DppReadinessResult, price: number): string {
  const gaps = r.gaps.length
    ? `<ol class="dc-gaps">${r.gaps.map(g => `<li>${esc(g)}</li>`).join("")}</ol>`
    : `<p>No gaps from your answers.</p>`;
  const deadline =
    r.daysUntilDeadline !== null
      ? `<p class="dc-countdown"><strong>${r.daysUntilDeadline}</strong> days until ${esc(r.category.date ?? "")}</p>`
      : "";
  const status =
    r.category.status === "law"
      ? "Law"
      : r.category.status === "expected"
        ? "Expected"
        : "Not scheduled";
  const cta = r.inScope
    ? `<div class="dc-cta">${checkoutForm("result-checkout", `Get the written readiness plan — $${price}`, r.category.id)}</div>`
    : "";
  return `<section class="estate-section dc-result" id="result" aria-live="polite">
  <div class="wrap">
    <h2>Your result: ${r.score}/100 · ${esc(r.bandLabel)}</h2>
    ${deadline}
    <p><strong>${esc(r.category.label)}</strong> — ${status}. ${esc(r.category.when)} <span class="bp-note">Source: ${esc(r.category.source)}.</span></p>
    <h3>Your gaps</h3>
    ${gaps}
    <h3>Next step</h3>
    <p>${esc(r.nextStep)}</p>
    ${cta}
    <p class="bp-note">${esc(r.disclaimer)}</p>
  </div>
</section>`;
}

export function renderDppCheckPage(url: URL, now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const input = parseDppReadinessInput(
    k => url.searchParams.get(k) ?? undefined
  );
  const result = input
    ? scoreDppReadiness(input, { now, auditPrice: price })
    : null;
  const title = "Free EU Digital Product Passport readiness check | AuthiChain";
  const description =
    "Answer eight quick questions and see how ready your products are for the EU Digital Product Passport: score, gaps, and the dated obligation for your category. Free, no sign-up.";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EU DPP Readiness Check",
    url: DPP_CHECK_CANONICAL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: {
      "@type": "Organization",
      name: "AuthiChain",
      url: "https://authichain.com",
    },
  };
  // Result pages carry answers in the query string: keep one canonical, don't index variants.
  const robots = input
    ? "noindex, follow"
    : "index, follow, max-image-preview:large";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${DPP_CHECK_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${DPP_CHECK_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .dc-form { display:grid; gap:1rem; max-width:40rem; margin:1.25rem 0; }
    .dc-field { display:flex; flex-direction:column; gap:.35rem; font-weight:600; }
    .dc-field select { padding:.55rem .6rem; border:1px solid var(--border); border-radius:.5rem; font:inherit; background:transparent; color:inherit; max-width:100%; }
    .dc-set { border:1px solid var(--border); border-radius:.75rem; padding:.75rem 1rem; display:grid; gap:.6rem; }
    .dc-set legend { font-weight:650; padding:0 .3rem; }
    .dc-q { display:flex; gap:.6rem; align-items:flex-start; line-height:1.5; }
    .dc-q input { margin-top:.3rem; flex:none; }
    .dc-countdown { display:inline-flex; gap:.5rem; align-items:baseline; padding:.35rem .8rem; border:1px solid var(--border); border-radius:999px; }
    .dc-countdown strong { font-size:1.15rem; font-variant-numeric:tabular-nums; }
    .dc-gaps { margin:.25rem 0 0 1.2rem; }
    .dc-gaps li { margin:.35rem 0; line-height:1.55; }
    .dc-cta { margin:1rem 0; }
    .bp-note { font-size:.9rem; color:var(--text-dim); }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: "/dpp", label: "EU DPP" },
      { href: "/battery-passport", label: "Battery passport" },
      { href: "/pricing", label: "Pricing" },
    ],
    { href: DPP_CHECK_PATH, label: "Free check" }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge">Free tool · EU Digital Product Passport</p>
      <h1>How ready are your products for the EU Digital Product Passport?</h1>
      <p class="estate-lede hero-sub">Eight quick questions. You get a score, the gaps to close, and the dated obligation for your category. Free, no sign-up, nothing stored.</p>
      ${formHtml(input)}
    </div>
  </header>
${result ? resultHtml(result, price) : ""}
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: DPP_CHECK_PATH, label: "Free DPP check" },
        { href: "/battery-passport", label: "Battery passport" },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Read",
      links: [
        {
          href: "/p/what-is-a-digital-product-passport",
          label: "What is a DPP?",
        },
        { href: "/p/eu-dpp-compliance-checklist", label: "EU DPP checklist" },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Not legal advice."
)}
</body>
</html>`;
}

export function tryHandleDppCheck(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (!isDppCheckPath(url.pathname)) return null;
  return new Response(
    request.method === "HEAD" ? null : renderDppCheckPage(url),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": url.search
          ? "private, no-store"
          : "public, max-age=300",
      },
    }
  );
}
