/**
 * seo-data/comparison.cjs
 * DATA entries for gen-seo-pages.cjs: "alternative to X" and plan-pricing
 * pages built from the plan catalogue (src/lib/plans.ts) and the vetted
 * /vs comparison copy (workers/authichain-com/src/vs-pages*.ts).
 *
 * Rules for this file (the weekly marketing-pages routine appends here):
 * - Prices and plan names come from src/lib/plans.ts listed plans only. Never
 *   name a plan that is listed: false or absent from PUBLIC_PLAN_IDS.
 * - A competitor claim must already appear in vs-pages*.ts or be checked
 *   against the competitor's own site the week it is written. If it can't be
 *   checked, leave it out rather than guess.
 * - AuthiChain capabilities keep the same status the /vs pages give them:
 *   "in development" stays in development, "goal" stays a goal.
 * Shape must match gen-seo-pages.cjs's DATA entries exactly: keyword, brand,
 * schemaType, lead, bullets[3], faqs[{q,a}]. Required by gen-seo-pages.cjs.
 */
module.exports = [
  { keyword: 'vechain alternative without tokens or gas fees', brand: 'authichain', schemaType: 'Service',
    lead: 'VeChain is a general-purpose enterprise L1 blockchain that brands usually reach through ToolChain or an integration partner; AuthiChain is a brand-facing product instead, where the seal, the certificate and the public verifier are the thing you buy, and you pay in USD by card rather than holding a token.',
    bullets: ['No token and no gas to manage: AuthiChain plans are billed in US dollars through Stripe, so a brand never has to fund a wallet before it can issue a record', 'The public verifier and signing keys are live at /.well-known/jwks.json, so a buyer checks a signed record without an AuthiChain account or a blockchain wallet', 'The certificate contract is live on Polygon; self-serve issuance and EU DPP export are still in development, so a pilot today starts with the $299 EU DPP Readiness audit rather than a full platform rollout'],
    faqs: [{ q: 'Is AuthiChain built on VeChain?', a: 'No. AuthiChain anchors certificates on Polygon and signs records with Ed25519 keys published in its JWKS. VeChain is a separate L1 blockchain that other authentication vendors build on.' }, { q: 'What does it cost to start?', a: 'The live self-serve entry point is the EU DPP Readiness audit at $299, a one-time payment that includes a written readiness assessment and is credited toward AuthiChain Basic if you convert.' }] },
  { keyword: 'circularise alternative for smaller brands', brand: 'authichain', schemaType: 'Service',
    lead: 'Circularise is an enterprise platform for material traceability and EU Digital Product Passports aimed at large manufacturers on quoted contracts; a smaller brand that needs to start its DPP work without an enterprise sales cycle can begin with AuthiChain’s $299 EU DPP Readiness audit, paid by card.',
    bullets: ['The $299 audit is a one-time payment with a written EU DPP readiness assessment, self-serve merchant activation, and 50 workspace generations to publish a first record', 'AuthiChain covers anti-counterfeit authentication as well as DPP readiness, while Circularise specializes in material traceability for large supply chains', 'EU DPP export is still in development at AuthiChain; if you need a production passport export for a delegated act deadline today, weigh that honestly against a platform that already ships one'],
    faqs: [{ q: 'Does AuthiChain export an EU Digital Product Passport today?', a: 'Not yet. DPP export is in development. The live product is the readiness audit, which tells you what your passport will need and publishes a first record in the workspace.' }, { q: 'Is the $299 wasted if we later need more?', a: 'No. The $299 is credited toward AuthiChain Basic if you convert, according to the published plan terms.' }] },
  { keyword: 'scantrust alternative with a public verifier', brand: 'authichain', schemaType: 'Product',
    lead: 'Scantrust is an established secure-QR and brand-protection platform with self-serve plans; the difference AuthiChain leads with is a record anyone can check against published keys, so a buyer, customs officer or marketplace can verify a signed claim without asking the brand or AuthiChain.',
    bullets: ['Signing keys are published at /.well-known/jwks.json and the verification rules are open, so the check does not depend on AuthiChain staying online or on a vendor account', 'A valid signature is signed evidence of what the issuer recorded, not a guarantee that the object in hand is genuine; the page says so rather than implying more', 'AI image analysis and NFT certificates are in development and are not part of what you buy today; the live starting point is the $299 EU DPP Readiness audit'],
    faqs: [{ q: 'Can a customer verify without an app?', a: 'Yes. Scanning the code opens the public verifier in a normal browser, and the signature can also be checked offline against the published JWKS.' }, { q: 'Does AuthiChain use secure copy-detection QR codes like Scantrust?', a: 'No. AuthiChain signs the record behind the code rather than relying on a print pattern, so the two approaches answer different questions and can be used together.' }] },
  { keyword: 'cannabis coa passport pricing per cultivar', brand: 'strainchain', schemaType: 'Product',
    lead: 'A StrainChain genetics passport costs $49 per cultivar as a one-time payment, and the Farm Plan at $149 a month covers unlimited cultivars and updates each passport when a new certificate of analysis arrives.',
    bullets: ['Passport, $49 once: one published passport for one cultivar, with the full cannabinoid and terpene panel taken from your existing certificates and a QR code and shareable link', 'Farm Plan, $149 a month: unlimited cultivars and passports, automatic updates on every new CoA, and lineage and batch history across the library', 'On both plans every THC and THCV total is recomputed from the raw panel rather than copied from the certificate, and discrepancies are shown rather than smoothed over'],
    faqs: [{ q: 'Is a StrainChain passport a lab result?', a: 'No. It is a published record built from the certificates you supply. The lab that issued the CoA remains the source of the test result.' }, { q: 'When does the Farm Plan make more sense than single passports?', a: 'When you publish several cultivars or re-test often. The Farm Plan updates every passport on each new CoA, where single passports mean buying a new $49 passport for each cultivar.' }] },
];
