/**
 * /made-in-usa-claim-file — the Made in USA Claim File offer page, and the
 * /made-in-usa-claim-file/thanks landing that the gated checkout returns to.
 *
 * Sells musa_claim_file ($299 per SKU, created by Z in Stripe 2026-09-29).
 * Buyer: small US makers (Etsy, Faire, Shopify) who print "Made in USA" and
 * hold no evidence behind it.
 *
 * Truth rules: the file is substantiation support, not legal advice and not a
 * certification. The FTC does not pre-approve origin claims, and a file does
 * not make an untrue claim true. Deliverables are exactly the plan features in
 * src/lib/plans.ts. No customers, logos, testimonials or penalty figures.
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

export const CLAIM_FILE_PATH = "/made-in-usa-claim-file";
export const CLAIM_FILE_THANKS_PATH = `${CLAIM_FILE_PATH}/thanks`;
export const CLAIM_FILE_CANONICAL = `https://authichain.com${CLAIM_FILE_PATH}`;
export const CLAIM_FILE_CHECKOUT_ACTION =
  "https://authichain.com/checkout/musa_claim_file";
export const CLAIM_FILE_UTM = {
  utm_source: "site",
  utm_medium: "offer-page",
  utm_campaign: "musa-claim-file",
} as const;

const PAGE_PATHS = new Set([CLAIM_FILE_PATH, `${CLAIM_FILE_PATH}/`]);
const THANKS_PATHS = new Set([
  CLAIM_FILE_THANKS_PATH,
  `${CLAIM_FILE_THANKS_PATH}/`,
]);

export function isClaimFilePath(pathname: string): boolean {
  return PAGE_PATHS.has(pathname);
}

export function isClaimFileThanksPath(pathname: string): boolean {
  return THANKS_PATHS.has(pathname);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

function checkoutForm(id: string, label: string): string {
  const hidden = Object.entries(CLAIM_FILE_UTM)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${CLAIM_FILE_CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout for one SKU. Your email is used for the receipt and to collect your records. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

/** The three tests an unqualified claim has to pass (16 CFR 323.2). */
const TESTS: Array<{ title: string; body: string }> = [
  {
    title: "Final assembly or processing in the US",
    body: "The last step that turns parts into the finished product happens in the United States.",
  },
  {
    title: "All significant processing in the US",
    body: "Every step that gives the product its value or character, not just the last one, happens here.",
  },
  {
    title: "All or virtually all parts and materials are US-made",
    body: "Components and ingredients are made and sourced in the US, including what your suppliers buy. Anything more than a negligible foreign share breaks an unqualified claim.",
  },
];

const SEND: string[] = [
  "Your bill of materials for the SKU: every component, ingredient and piece of packaging that is part of the product",
  "For each line, the supplier's origin statement if you have one, or a supplier contact so we can request it",
  "Where final assembly and each significant processing step happen",
  "The exact claim you print or plan to print, and where it appears (label, listing, ads)",
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Does this make my product Made in USA?",
    a: "No. Where your product is made decides that. The file collects the evidence for the claim you make, and it shows you where the evidence is thin, so you can fix the product or qualify the claim before a retailer, competitor or regulator asks.",
  },
  {
    q: "Is this legal advice or a certification?",
    a: "No. It is substantiation support: an organised evidence file and a signed attestation. The FTC does not pre-approve origin claims and does not certify products. For a legal opinion, talk to your counsel, and give them the file.",
  },
  {
    q: "What if one component is imported?",
    a: 'Then an unqualified "Made in USA" claim may not hold, and the file will say so. A qualified claim such as "Made in USA with imported parts" can be truthful instead. The file names the line item so you can decide.',
  },
  {
    q: "What does the signed attestation prove?",
    a: "That this record was issued by AuthiChain on that date and has not been changed since. Anyone can check the signature. It does not prove the underlying facts on its own: the supplier documents in the file do that.",
  },
  {
    q: "I sell several products. How do I buy more than one?",
    a: "Each file covers one SKU. The Stripe link below lets you buy up to 25 at once, or use the form for one.",
  },
  {
    q: "Do I have to book a call?",
    a: "No. Checkout is self-serve and the work happens by email.",
  },
];

export function renderClaimFilePage(): string {
  const plan = planById("musa_claim_file");
  const price = plan?.price ?? 299;
  const multiLink = plan?.stripe_payment_link;
  const title = `Made in USA claim file: evidence behind your label, $${price} per product | AuthiChain`;
  const description = `Print "Made in USA"? The FTC expects you to hold the evidence. Get a claim file for one product: origin records, supplier attestations and a signed attestation. $${price} per SKU, self-serve. Not legal advice.`;
  const tests = TESTS.map(
    t =>
      `<article class="estate-card card"><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p></article>`
  ).join("");
  const deliverables = (plan?.features ?? [])
    .map(f => `<li>${esc(f)}</li>`)
    .join("");
  const send = SEND.map(s => `<li>${esc(s)}</li>`).join("");
  const faq = FAQ.map(
    f =>
      `<details class="cf-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
  ).join("");
  const bundle = planById("musa_audit_bundle");
  const bundleSection = bundle?.stripe_payment_link
    ? `<section class="estate-section" id="bundle">
    <div class="wrap">
      <h2>More than a few products?</h2>
      <p class="cf-price">$${bundle.price.toLocaleString("en-US")} <span class="cf-note">per engagement</span></p>
      <ul class="cf-list">${bundle.features.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      <p class="section-sub">Stripe asks for your company name, how many SKUs, and billing details so the invoice is right.</p>
      <p><a class="btn btn-outline" href="${esc(bundle.stripe_payment_link)}" rel="nofollow">Buy the audit bundle — $${bundle.price.toLocaleString("en-US")}</a></p>
    </div>
  </section>`
    : "";
  const multi = multiLink
    ? `<p class="cf-note">Several products? <a href="${esc(multiLink)}" rel="nofollow">Buy 1 to 25 SKUs on Stripe</a>.</p>`
    : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Made in USA Claim File",
        serviceType: "Made in USA origin claim substantiation support",
        provider: {
          "@type": "Organization",
          name: "AuthiChain",
          url: "https://authichain.com",
        },
        areaServed: "United States",
        url: CLAIM_FILE_CANONICAL,
        offers: {
          "@type": "Offer",
          price: String(price),
          priceCurrency: "USD",
          url: CLAIM_FILE_CANONICAL,
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
  <link rel="canonical" href="${CLAIM_FILE_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${CLAIM_FILE_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .cf-list { margin:.25rem 0 0 1.2rem; }
    .cf-list li { margin:.4rem 0; line-height:1.6; }
    .cf-faq { border-top:1px solid var(--border); padding:.9rem 0; }
    .cf-faq summary { cursor:pointer; font-weight:650; }
    .cf-faq p { margin:.6rem 0 0; line-height:1.65; }
    .cf-note { font-size:.9rem; color: var(--text-dim); }
    .cf-price { font-size:2rem; font-weight:750; }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: "/made-in-america", label: "Made in America" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
    { href: "#get-started", label: `Start my claim file — $${price}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="estate-badge hero-badge">FTC Made in USA Labeling Rule · 16 CFR Part 323</p>
      <h1>You print "Made in USA". Can you show the evidence?</h1>
      <p class="estate-lede hero-sub">An unqualified Made in USA claim has to be backed by evidence you already hold when you make it. Most small brands have the facts but not the file. We build it for one product: origin records, supplier attestations and a signed attestation, for $${price} per SKU. No call.</p>
      <div class="estate-actions hero-cta">${checkoutForm("hero-checkout", `Start my claim file — $${price}`)}</div>
      ${multi}
    </div>
  </header>

  <section class="estate-section" id="rule">
    <div class="wrap">
      <h2>What the rule asks for</h2>
      <p class="section-sub">For an unqualified "Made in USA" claim on a label, the FTC rule has three tests, and the product has to pass all of them.</p>
      <div class="estate-grid">${tests}</div>
      <p class="cf-note">Summary of 16 CFR Part 323, which covers product labels and the Made in USA claims in mail-order and online listings. Other claims, including qualified ones and advertising, follow the FTC's broader guidance. Not legal advice.</p>
    </div>
  </section>

  <section class="estate-section" id="what-you-get">
    <div class="wrap">
      <h2>What's in the file</h2>
      <p class="cf-price">$${price} <span class="cf-note">per SKU, one-time</span></p>
      <ul class="cf-list">${deliverables}</ul>
      <p class="section-sub">If a line item can't be shown to be US-made, the file says which one, so you can change the supplier or qualify the claim before anyone else finds it.</p>
    </div>
  </section>

${bundleSection}

  <section class="estate-section" id="what-you-send">
    <div class="wrap">
      <h2>What you send us</h2>
      <ul class="cf-list">${send}</ul>
      <p class="cf-note">We only contact the suppliers you name, and never your customers.</p>
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
      <h2>Start the file for your first product</h2>
      <p class="section-sub">Enter your work email to open Stripe checkout. We'll email you for the bill of materials and supplier list.</p>
      <div class="estate-actions">${checkoutForm("cta-checkout", `Start my claim file — $${price}`)}</div>
      ${multi}
    </div>
  </section>
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: CLAIM_FILE_PATH, label: "Made in USA claim file" },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Read",
      links: [{ href: "/made-in-america", label: "Made in America" }],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Substantiation support, not legal advice. Not a certification."
)}
</body>
</html>`;
}

/** Where the gated checkout returns a paid claim-file buyer. */
export function renderClaimFileThanksPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Payment received · Made in USA claim file | AuthiChain</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .cf-list { margin:.25rem 0 0 1.2rem; }
    .cf-list li { margin:.4rem 0; line-height:1.6; }
  </style>
</head>
<body>
<main id="main">
  <section class="estate-section">
    <div class="wrap">
      <h1>Payment received. Your claim file is started.</h1>
      <p class="section-sub">We'll email you from hello@authichain.com to collect what the file needs. To get ahead, have these ready:</p>
      <ul class="cf-list">${SEND.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
      <p><a href="${CLAIM_FILE_PATH}">Back to the claim file page</a></p>
    </div>
  </section>
</main>
</body>
</html>`;
}
