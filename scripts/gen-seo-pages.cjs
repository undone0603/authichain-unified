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
  // domain is the brand key pages.json is filtered by; origin is the live host
  // for canonical URLs. Apex is authichain.com. Checkout stays on authichain.com/checkout.
  authichain: { name: 'AuthiChain', domain: 'authichain.com', origin: 'authichain.com', price: 'EU DPP Readiness is $299 one-time.' },
  strainchain: { name: 'StrainChain', domain: 'strainchain.io', price: 'Genetics passport is $49 one-time.' },
  govchain: { name: 'GovChain', domain: 'govchain.us', price: 'No enterprise contract — public-sector pricing.' },
  qron: { name: 'QRON', domain: 'qron.space', price: 'QRON packs from $29 one-time.' },
};

// Live money paths from src/lib/plans.ts + workers/_shared/estate-pricing.ts +
// estate landing workers. Do not invent checkout URLs or dollar amounts.
const LIVE_MONEY = {
  authichainDppCheckout: 'https://authichain.com/checkout/dpp_readiness',
  authichainDppPay: 'https://authichain.com/checkout/dpp_readiness',
  authichainPricing: 'https://authichain.com/pricing',
  // GET /api/checkout/plan/:planId on authichain.com (plans.ts comment).
  strainchainPassportCheckout: 'https://authichain.com/checkout/strainchain_passport',
  strainchainPassportPay: 'https://authichain.com/checkout/strainchain_passport',
  strainchainFarmCheckout: 'https://authichain.com/checkout/strainchain_farm',
  strainchainFarmPay: 'https://authichain.com/checkout/strainchain_farm',
};
