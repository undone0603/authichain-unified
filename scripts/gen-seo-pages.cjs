/**
 * gen-seo-pages.cjs
 * Deterministically generates the committed programmatic-SEO catalogue
 * (content/seo/pages.json). Re-running is idempotent: hand-authored seed pages
 * are preserved by slug (bespoke copy is not rewritten) and generated pages
 * are (re)built from the DATA table. The Get started money CTA is always
 * rebuilt so checkout landings collect a recovery email.
 *
 * DATA is assembled below from scripts/seo-data/*.cjs (regulatory.cjs,
 * industry.cjs, standards.cjs, commercial.cjs) rather than inlined here — see
 * the comment above the `const DATA =` assignment for which file a new entry
 * belongs in.
 *
 * Run:  node scripts/gen-seo-pages.cjs
 * CI:   .github/workflows/gen-seo-pages.yml — Friday 09:00 UTC and
 *       workflow_dispatch. Commits content/seo/pages.json only when it changes.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'content', 'seo', 'pages.json');

// Brand balance as of 2026-09-24: authichain 119/135 generated entries (88%),
// strainchain 5, govchain 6, qron 5. That skew is a byproduct of chasing
// whichever EU DPP/regulatory news is freshest each run, not a deliberate
// choice — most regulatory research naturally lands on authichain. If a new
// entry's topic doesn't force a specific brand (e.g. it's not an EU DPP
// delegated act, which is authichain by definition), prefer strainchain,
// govchain, or qron over authichain to work this back toward balance. Recount
// with the snippet above before deciding it's still skewed — it changes every
// run.
const BRANDS = {
  authichain: { name: 'AuthiChain', domain: 'authichain.com', price: 'Plans start at $49/mo.' },
  strainchain: { name: 'StrainChain', domain: 'strainchain.io', price: 'Plans start at $199/mo.' },
  govchain: { name: 'GovChain', domain: 'govchain.us', price: 'No enterprise contract — public-sector pricing.' },
  qron: { name: 'QRON', domain: 'qron.space', price: 'Plans start at $29/mo.' },
};

// Live money paths from src/lib/plans.ts + workers/_shared/estate-pricing.ts +
// estate landing workers. Do not invent checkout URLs or dollar amounts.
const LIVE_MONEY = {
  authichainDppCheckout: 'https://authichain.com/api/checkout/dpp',
  authichainDppPay: 'https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c',
  authichainPricing: 'https://authichain.com/pricing',
  // GET /api/checkout/plan/:planId on authichain.com (plans.ts comment).
  strainchainPassportCheckout: 'https://authichain.com/api/checkout/plan/strainchain_passport',
  strainchainPassportPay: 'https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y',
  strainchainFarmCheckout: 'https://authichain.com/api/checkout/plan/strainchain_farm',
  strainchainFarmPay: 'https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z',
};

function isDppKeyword(keyword) {
  return /digital product passport|\bdpp\b|batter(?:y|ies)|textiles/i.test(keyword);
}

function isCannabisKeyword(keyword) {
  return /\b(cannabis|metrc|strain|coa|dispensary|biotrack)\b/i.test(keyword);
}

function isMusaKeyword(keyword) {
  return /made in (usa|america)|origin claim|16 cfr|ftc made in|buy american/i.test(keyword);
}

function isTrumarkKeyword(keyword) {
  return /trumark/i.test(keyword);
}

/**
 * Brand-aware CTA after How it works. Keyword bias can override brand:
 * DPP / battery / textiles → AuthiChain DPP checkout; cannabis / METRC /
 * strain / COA → StrainChain passport checkout + strainchain.io/pricing.
 * QRON → /pricing. GovChain /pricing 404s (routing.test.ts); /onboard is live.
 */
function isCheckoutUrl(href) {
  return /\/api\/checkout\//.test(href);
}

function checkoutEmailFormHtml(action, label) {
  return (
    `<form class="checkout-email-form" action="${esc(action)}" method="get">` +
    `<label class="checkout-email-label" for="checkout-email">Work email` +
    `<input id="checkout-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com">` +
    `</label>` +
    `<p class="checkout-email-hint">Receipt and abandoned-checkout recovery. Not a newsletter.</p>` +
    `<button class="btn btn-primary" type="submit">${esc(label)}</button>` +
    `</form>`
  );
}

function moneyCtaHtml(brandKey, keyword, brand) {
  let primaryHref;
  let primaryLabel;
  let secondaryHref = null;
  let secondaryLabel = null;

  const cannabis = isCannabisKeyword(keyword);
  const dpp = isDppKeyword(keyword);
  const musa = isMusaKeyword(keyword);
  const trumark = isTrumarkKeyword(keyword);

  if (trumark) {
    primaryHref = LIVE_MONEY.strainchainPassportCheckout;
    primaryLabel = 'Start StrainChain passport checkout';
    secondaryHref = 'https://authichain.com/trumark';
    secondaryLabel = 'Read the TruMark brief';
  } else if (musa || ((dpp || brandKey === 'authichain') && !cannabis)) {
    primaryHref = LIVE_MONEY.authichainDppCheckout;
    primaryLabel = 'Start DPP readiness checkout';
    secondaryHref = musa
      ? 'https://authichain.com/made-in-america'
      : LIVE_MONEY.authichainPricing;
    secondaryLabel = musa ? 'Read the Made in America brief' : 'View AuthiChain pricing';
  } else if (cannabis || brandKey === 'strainchain') {
    if (cannabis) {
      primaryHref = LIVE_MONEY.strainchainPassportCheckout;
      primaryLabel = 'Start StrainChain passport checkout';
      secondaryHref = `https://${BRANDS.strainchain.domain}/pricing`;
      secondaryLabel = 'View StrainChain pricing';
    } else {
      primaryHref = `https://${BRANDS.strainchain.domain}/pricing`;
      primaryLabel = 'View StrainChain pricing';
    }
  } else if (brandKey === 'govchain') {
    primaryHref = `https://${brand.domain}/onboard`;
    primaryLabel = 'Request GovChain access';
  } else {
    primaryHref = `https://${brand.domain}/pricing`;
    primaryLabel = `View ${brand.name} pricing`;
  }

  if (isCheckoutUrl(primaryHref)) {
    const pay =
      primaryHref === LIVE_MONEY.strainchainPassportCheckout
        ? `<p><a href="${LIVE_MONEY.strainchainPassportPay}">Pay $49 on Stripe</a></p>`
        : primaryHref === LIVE_MONEY.authichainDppCheckout
          ? `<p><a href="${LIVE_MONEY.authichainDppPay}">Pay $299 on Stripe</a></p>`
          : '';
    const extra = secondaryHref
      ? `<p><a href="${secondaryHref}">${esc(secondaryLabel)}</a>. ${esc(brand.price)}</p>`
      : `<p>${esc(brand.price)}</p>`;
    const farm =
      cannabis && primaryHref === LIVE_MONEY.strainchainPassportCheckout
        ? checkoutEmailFormHtml(
            LIVE_MONEY.strainchainFarmCheckout,
            'Start Farm Plan $149/mo'
          ) + `<p><a href="${LIVE_MONEY.strainchainFarmPay}">Pay $149/mo on Stripe</a></p>`
        : '';
    return (
      `<h2>Get started</h2>` +
      checkoutEmailFormHtml(primaryHref, primaryLabel) +
      pay +
      farm +
      extra
    );
  }

  const links =
    `<a href="${primaryHref}">${esc(primaryLabel)}</a>` +
    (secondaryHref ? ` · <a href="${secondaryHref}">${esc(secondaryLabel)}</a>` : '');
  return `<h2>Get started</h2><p>${links}. ${esc(brand.price)}</p>`;
}

function brandKeyForPage(page) {
  const byName = Object.keys(BRANDS).find((k) => BRANDS[k].name === page.brand);
  if (byName) return byName;
  return Object.keys(BRANDS).find((k) => BRANDS[k].domain === page.domain) || null;
}

/**
 * Keep the Get started money CTA in lockstep with generated hubs.
 * Bespoke seed copy above/below that heading is left alone. A seed
 * that already has <h2>Get started</h2> has only that block replaced
 * so Bing landings pick up the email form without a manual rewrite.
 */
function ensureMoneyCta(page) {
  if (typeof page.bodyHtml !== 'string') return page;
  const brandKey = brandKeyForPage(page);
  if (!brandKey) return page;
  const cta = moneyCtaHtml(brandKey, page.keyword || '', BRANDS[brandKey]);
  const startMarker = '<h2>Get started</h2>';
  const start = page.bodyHtml.indexOf(startMarker);
  if (start === -1) {
    const faq = page.bodyHtml.indexOf('<h2>FAQ</h2>');
    const bodyHtml =
      faq === -1
        ? page.bodyHtml + cta
        : page.bodyHtml.slice(0, faq) + cta + page.bodyHtml.slice(faq);
    return { ...page, bodyHtml };
  }
  const after = start + startMarker.length;
  const nextH2 = page.bodyHtml.indexOf('<h2>', after);
  const end = nextH2 === -1 ? page.bodyHtml.length : nextH2;
  return {
    ...page,
    bodyHtml: page.bodyHtml.slice(0, start) + cta + page.bodyHtml.slice(end),
  };
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ACRONYMS = { qr: 'QR', eu: 'EU', us: 'US', gs1: 'GS1', epcis: 'EPCIS', dscsa: 'DSCSA', dpp: 'DPP', eudr: 'EUDR', ppwr: 'PPWR', did: 'DID', cen: 'CEN', cenelec: 'CENELEC', espr: 'ESPR', nft: 'NFT', fsma: 'FSMA', iso: 'ISO', sd: 'SD', jwt: 'JWT', eudi: 'EUDI', cbam: 'CBAM', w3c: 'W3C', api: 'API', iec: 'IEC', jtc: 'JTC', dfars: 'DFARS', agec: 'AGEC', sb: 'SB', epr: 'EPR', usa: 'USA', usda: 'USDA', weee: 'WEEE', dsa: 'DSA', sme: 'SME', eudamed: 'EUDAMED', udi: 'UDI', ai: 'AI', fmd: 'FMD', emvs: 'EMVS', csddd: 'CSDDD', ftc: 'FTC', oid4vci: 'OID4VCI', uk: 'UK', eo: 'EO', trumark: 'TruMark', jcs: 'JCS', rdf: 'RDF' };
const titleCase = (s) =>
  s.split(/\b/).map((w) => {
    const lw = w.toLowerCase();
    if (ACRONYMS[lw]) return ACRONYMS[lw];
    return w.replace(/^[a-z]/, (c) => c.toUpperCase());
  }).join('');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Trim to <= max chars on a word boundary (no mid-word cut), keeping a period.
function clampMeta(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.]+$/, '') + '.';
}

// Search results truncate around 60 characters, and src/lib/seo-pages.test.ts
// asserts the limit. Titles were assembled unclamped, so a long keyword pushed
// "Product Authentication For Government Supply Chain | GovChain" to 61 and the
// regeneration workflow committed it straight to main under [skip ci] — the
// test only ran on the next unrelated push.
//
// The brand suffix is kept and the keyword is trimmed at a word boundary: the
// brand is the part that earns the click, so it is the wrong end to lose.
function clampTitle(kwTitle, brand, max = 60) {
  const suffix = ` | ${brand}`;
  const full = `${kwTitle}${suffix}`;
  if (full.length <= max) return full;

  const room = max - suffix.length;
  const cut = kwTitle.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  const kw = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s|,;:-]+$/, '');
  return `${kw}${suffix}`;
}

// DATA lives in scripts/seo-data/*.cjs, split by theme so a diff touches
// one ~100-300 line file instead of this ~950-line one. Each entry:
// keyword, brand, schemaType, lead, bullets[3], faqs[{q,a}] — match that
// shape exactly in whichever file you add to:
//   seo-data/regulatory.cjs  — dated EU/US compliance deadlines (ESPR, EUDR,
//                              DSCSA, battery passport, PPWR, FTC/USDA...)
//   seo-data/industry.cjs    — "blockchain qr code for X", "product
//                              authentication for X", anti-counterfeit,
//                              supply chain traceability by vertical
//   seo-data/standards.cjs   — W3C Verifiable Credentials, GS1 Digital Link,
//                              DID methods, EPCIS and similar protocol/
//                              standards-mechanics explainers
//   seo-data/commercial.cjs  — brand/money surfaces that aren't a deadline,
//                              a vertical, or a standards explainer
// If unsure which file fits, regulatory.cjs is the largest/most general
// bucket. Order across files doesn't matter — content/seo/pages.json is
// read by slug (src/lib/seo-pages.ts), never by position.
const DATA = [
  ...require('./seo-data/regulatory.cjs'),
  ...require('./seo-data/industry.cjs'),
  ...require('./seo-data/standards.cjs'),
  ...require('./seo-data/commercial.cjs'),
];

function buildEntry(d) {
  const b = BRANDS[d.brand];
  const kwTitle = titleCase(d.keyword);
  const slug = slugify(d.keyword);
  const url = `https://${b.domain}/p/${slug}`;
  const title = clampTitle(kwTitle, b.name);
  const firstSentence = d.lead.split('. ')[0].replace(/\.$/, '');
  const metaDescription = clampMeta(`${firstSentence}. ${b.name} — ${b.price}`, 158);
  const h1 = kwTitle;
  const bodyHtml =
    `<p>${esc(d.lead)}</p>` +
    `<h2>Why ${esc(b.name)}</h2>` +
    `<ul>${d.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
    `<h2>How it works</h2>` +
    `<p>Issue a unique identifier per unit, anchor its record on-chain for tamper-evidence, and let anyone verify it with a single scan. ${esc(b.price)}</p>` +
    moneyCtaHtml(d.brand, d.keyword, b) +
    `<h2>FAQ</h2>` +
    d.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': d.schemaType,
        name: `${b.name} — ${kwTitle}`,
        ...(d.schemaType === 'Product'
          ? { brand: { '@type': 'Brand', name: b.name } }
          : { provider: { '@type': 'Organization', name: b.name, url: `https://${b.domain}` } }),
        description: d.lead,
        url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: b.name, item: `https://${b.domain}` },
          { '@type': 'ListItem', position: 2, name: kwTitle, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: d.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return {
    slug,
    keyword: d.keyword,
    brand: b.name,
    domain: b.domain,
    title,
    metaDescription,
    h1,
    bodyHtml,
    jsonLd,
  };
}

// Hand-authored seed pages: bespoke copy that doesn't fit this generator's
// fixed template (custom section headings, several with no FAQ, two typed
// Article rather than Product/Service). They live in content/seo/pages.json
// but not in DATA, and are preserved below by slug on every run. Listed
// explicitly here (rather than left as "whatever doesn't match DATA") so a
// future DATA keyword that happens to slugify to the same value fails loudly
// instead of silently overwriting real copy with the generic template.
const PROTECTED_SEED_SLUGS = new Set([
  'ai-qr-code-art-generator',
  'anti-counterfeit-qr-verification',
  'authentic-agentic-economy',
  'battery-passport-due-diligence-requirement',
  'biotrack-integration-blockchain-provenance',
  'blockchain-product-authentication',
  'cannabis-blockchain-provenance',
  'cannabis-coa-verification-blockchain',
  'counterfeit-detection-with-ai',
  'digital-product-passport-access-rights',
  'dispensary-qr-provenance-scanning',
  'dscsa-compliance-blockchain-serialization',
  'editable-qr-code-no-reprint',
  'eu-dpp-compliance-checklist',
  'government-document-verification-blockchain',
  'government-rfp-award-verification-blockchain',
  'living-qr-code-art-generator',
  'metrc-compliance-blockchain',
  'offline-permit-certificate-qr-verification',
  'partner-program',
  'ppwr-digital-labelling-qr-code',
  'sbir-svip-blockchain-document-verification',
  'untp-digital-product-passport',
  'w3c-verifiable-credentials-product-authentication',
  'what-is-a-digital-product-passport',
]);

// Preserve hand-authored seed pages, replace/append generated ones by slug.
const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const generated = DATA.map(buildEntry);
const genSlugs = new Set(generated.map((g) => g.slug));

const clobberedSeeds = generated.filter((g) => PROTECTED_SEED_SLUGS.has(g.slug));
if (clobberedSeeds.length > 0) {
  throw new Error(
    `A DATA keyword slugifies to a protected hand-authored seed slug, which would ` +
      `silently overwrite bespoke copy with the generic template: ` +
      `${clobberedSeeds.map((g) => g.slug).join(', ')}. ` +
      `Rename the DATA keyword, or if replacing the seed is intentional, remove its ` +
      `slug from PROTECTED_SEED_SLUGS in this file first.`
  );
}

const seeds = existing
  .filter((e) => !genSlugs.has(e.slug))
  .map(ensureMoneyCta);
const unprotectedSeeds = seeds.filter((e) => !PROTECTED_SEED_SLUGS.has(e.slug));
if (unprotectedSeeds.length > 0) {
  console.warn(
    `WARNING: ${unprotectedSeeds.length} page(s) in ${OUT} are neither DATA-generated ` +
      `nor in PROTECTED_SEED_SLUGS — add them to PROTECTED_SEED_SLUGS if they're ` +
      `intentional hand-authored pages, or they may be stale/orphaned:\n` +
      unprotectedSeeds.map((e) => `  - ${e.slug}`).join('\n')
  );
}

const merged = [...seeds, ...generated];

// Guard against duplicate slugs landing in pages.json: standard JSON.parse
// silently keeps only the last object for a repeated key when this array is
// ever consumed by slug (e.g. built into a Map), so a collision here fails
// loudly at build time rather than silently unpublishing one of the two pages.
const slugCounts = new Map();
for (const p of merged) slugCounts.set(p.slug, (slugCounts.get(p.slug) || 0) + 1);
const duplicateSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
if (duplicateSlugs.length > 0) {
  throw new Error(
    `Duplicate slug(s) in ${OUT}, one page would silently shadow another: ` +
      `${duplicateSlugs.join(', ')}. Give each page a distinct slug before writing.`
  );
}

fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
console.log(`seeds preserved: ${seeds.length}`);
seeds.forEach((s) => console.log(`  - ${s.slug}`));
console.log(`generated pages: ${generated.length}`);
console.log(`total pages:     ${merged.length}`);
