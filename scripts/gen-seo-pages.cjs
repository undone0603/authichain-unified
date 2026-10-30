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
const SLUGS_OUT = path.join(__dirname, '..', 'content', 'seo', 'sitemap-slugs.json');

const BRANDS = {
  authichain: { name: 'AuthiChain', domain: 'authichain.com', origin: 'authichain.com', price: 'EU DPP Readiness is $299 one-time.' },
  strainchain: { name: 'StrainChain', domain: 'strainchain.io', price: 'Genetics passport is $49 one-time.' },
  govchain: { name: 'GovChain', domain: 'govchain.us', price: 'No enterprise contract — public-sector pricing.' },
  qron: { name: 'QRON', domain: 'qron.space', price: 'QRON packs from $29 one-time.' },
};

const LIVE_MONEY = {
  authichainDppCheckout: 'https://authichain.com/checkout/dpp_readiness',
  authichainDppPay: 'https://authichain.com/checkout/dpp_readiness',
  authichainPricing: 'https://authichain.com/pricing',
  authichainDppCheck: 'https://authichain.com/dpp-check',
  strainchainPassportCheckout: 'https://authichain.com/checkout/strainchain_passport',
  strainchainPassportPay: 'https://authichain.com/checkout/strainchain_passport',
  // Public sample of the $299 assessment (#1340); shown before checkout on
  // battery pages so a buyer sees what they get before paying.
  batterySampleAudit: 'https://authichain.com/battery-passport/sample-audit',
};

function isDppKeyword(keyword) {
  return /digital product passport|\bdpp\b|batter(?:y|ies)|textiles/i.test(keyword);
}

function isBatteryKeyword(keyword) {
  return /batter(?:y|ies)|\blmt\b|e-bike|e-scooter/i.test(keyword);
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

function isCheckoutUrl(href) {
  return /\/api\/checkout\/|\/checkout\//.test(href);
}

function checkoutEmailFormHtml(action, label) {
  return (
    `<form class="checkout-email-form" action="${esc(action).replace(/"/g, "&quot;")}" method="${isCheckoutUrl(action) && /^https:\/\/authichain\.com\/checkout\//.test(action) ? "post" : "get"}">` +
    `<label class="checkout-email-label" for="checkout-email">Work email` +
    `<input id="checkout-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@company.com">` +
    `</label>` +
    `<p class="checkout-email-hint">We use this for your receipt and to follow up if checkout doesn't finish. No newsletter.</p>` +
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
  const battery = isBatteryKeyword(keyword);
  const musa = isMusaKeyword(keyword);
  const trumark = isTrumarkKeyword(keyword);
  if (trumark) {
    primaryHref = LIVE_MONEY.strainchainPassportCheckout;
    primaryLabel = 'Start StrainChain passport checkout';
    secondaryHref = 'https://authichain.govchain.us/trumark';
    secondaryLabel = 'Read the TruMark brief';
  } else if (musa || ((dpp || brandKey === 'authichain') && !cannabis)) {
    primaryHref = LIVE_MONEY.authichainDppCheckout;
    primaryLabel = 'Start DPP readiness checkout';
    secondaryHref = musa
      ? 'https://authichain.govchain.us/made-in-america'
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
    // Farm is not a public offer. The generator must not emit its checkout.
    const farm = '';
    const freeCheck =
      dpp && primaryHref === LIVE_MONEY.authichainDppCheckout
        ? `<p>Not sure what applies to you? <a href="${LIVE_MONEY.authichainDppCheck}">Take the free DPP readiness check</a> first.</p>`
        : '';
    const batterySample =
      battery && primaryHref === LIVE_MONEY.authichainDppCheckout
        ? `<p>Want to see a fictional walkthrough first? <a href="${LIVE_MONEY.batterySampleAudit}">Read the fictional e-bike walkthrough</a>.</p>`
        : '';
    return (
      `<h2>Get started</h2>` +
      freeCheck +
      batterySample +
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

// authichain.govchain.us is only a fallback host. Seed pages that still name
// it in jsonLd hand their canonical (worker-app renders jsonLd.url as
// <link rel=canonical>) to the wrong host. Root seed URLs 301 to /p/<slug>.
const AUTHICHAIN_ROOT_PAGES = new Set(['authentic-agentic-economy']);
function normalizeAuthichainHost(page) {
  if (page.domain !== 'authichain.com' || !page.jsonLd) return page;
  const target = AUTHICHAIN_ROOT_PAGES.has(page.slug)
    ? `https://authichain.com/${page.slug}`
    : `https://authichain.com/p/${page.slug}`;
  const json = JSON.stringify(page.jsonLd)
    .split(`https://authichain.govchain.us/${page.slug}"`).join(`${target}"`)
    .split('https://authichain.govchain.us').join('https://authichain.com');
  return { ...page, jsonLd: JSON.parse(json) };
}

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
const ACRONYMS = { qr: 'QR', eu: 'EU', us: 'US', gs1: 'GS1', epcis: 'EPCIS', dscsa: 'DSCSA', dpp: 'DPP', eudr: 'EUDR', ppwr: 'PPWR', did: 'DID', cen: 'CEN', cenelec: 'CENELEC', espr: 'ESPR', nft: 'NFT', fsma: 'FSMA', iso: 'ISO', sd: 'SD', jwt: 'JWT', eudi: 'EUDI', cbam: 'CBAM', w3c: 'W3C', api: 'API', iec: 'IEC', jtc: 'JTC', dfars: 'DFARS', agec: 'AGEC', sb: 'SB', epr: 'EPR', usa: 'USA', usda: 'USDA', weee: 'WEEE', dsa: 'DSA', sme: 'SME', eudamed: 'EUDAMED', udi: 'UDI', ai: 'AI', fmd: 'FMD', emvs: 'EMVS', csddd: 'CSDDD', ftc: 'FTC', oid4vci: 'OID4VCI', uk: 'UK', eo: 'EO', trumark: 'TruMark', jcs: 'JCS', rdf: 'RDF', cmmc: 'CMMC', mcp: 'MCP', fips: 'FIPS', rfc: 'RFC' };
const titleCase = (s) =>
  s.split(/\b/).map((w) => {
    const lw = w.toLowerCase();
    if (ACRONYMS[lw]) return ACRONYMS[lw];
    return w.replace(/^[a-z]/, (c) => c.toUpperCase());
  }).join('');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function clampMeta(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.]+$/, '') + '.';
}
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
const DATA = [
  ...require('./seo-data/regulatory.cjs'),
  ...require('./seo-data/industry.cjs'),
  ...require('./seo-data/standards.cjs'),
  ...require('./seo-data/commercial.cjs'),
  ...require('./seo-data/comparison.cjs'),
  ...[
    { keyword: 'eu ban on destroying unsold clothes and shoes records', brand: 'authichain', schemaType: 'Service',
      lead: 'Under the ESPR, large companies may not destroy unsold apparel, clothing accessories and footwear from 19 July 2026 unless a listed exception applies, and they must disclose the volumes they discard; medium-sized companies follow on 19 July 2030.',
      bullets: ['A signed, timestamped record per batch of unsold goods: what it was, how many units, and the decision taken, in a form an auditor can check without asking you', 'Anchoring commits the hash of each record to a public ledger, so the date of a disposal decision is checkable rather than asserted'],
      faqs: [{ q: 'Who has to comply with the destruction ban?', a: 'The ESPR applies the ban to large companies from 19 July 2026 and to medium-sized companies from 19 July 2030. Small and micro enterprises are outside it. Check your size class against the regulation text.' }, { q: 'Does a signed record prove the goods were not destroyed?', a: 'No. A signature proves who made a statement and when, and an anchor proves the hash existed at a point in time. Neither proves the physical outcome; the record is evidence you attach to your own disclosure.' }] },
    { keyword: 'espr dpp independent service provider backup copy', brand: 'authichain', schemaType: 'Service',
      lead: 'ESPR Article 10 requires the data in a digital product passport to be available through an independent third-party service provider, so a passport stays reachable if the manufacturer stops operating.',
      bullets: ['Records are self-contained W3C Verifiable Credentials: any copy, held anywhere, verifies against the issuer key with no call back to us', 'Item records resolve from a GS1 Digital Link URL that stays the same when the item changes hands, and the spec requires unauthenticated access', 'The specification and verifier are Apache-2.0 with a patent grant, so a second provider can implement the same format and hold a mirror'],
      faqs: [{ q: 'What does the independent provider requirement mean in practice?', a: 'A copy of the passport data is held by a party independent of the economic operator, so the data remains accessible for the period the delegated act sets. Confirm the exact wording in Regulation (EU) 2024/1781 and the delegated act for your product group.' }, { q: 'Does a signed record replace the backup provider?', a: 'No. Signatures let anyone verify a copy; they do not host it. You still need an independent party to keep a current copy available.' }] },
    { keyword: 'testnet anchor vs mainnet anchor blockchain proof', brand: 'authichain', schemaType: 'Service',
      lead: 'A testnet anchor is not proof: testnet tokens have no value, testnets get reset, and anyone can write to them, so a record anchored there shows only that a transaction once existed on a network built for experiments.',
      bullets: ['The AuthiChain spec requires a verifier to treat a testnet anchor as unanchored unless the caller explicitly opts in', 'Chains are named in CAIP-2 form such as polygon:137, so the network is unambiguous and cannot be assumed', 'A malformed transaction hash is rejected rather than displayed; an EVM hash must be 64 hex characters'],
      faqs: [{ q: 'How can I check which network an anchor is on?', a: 'Read the chain field of the anchor. In the reference verifier, run it on the record and anchor: a testnet anchor returns valid-unanchored unless you set ALLOW_TESTNET=1. Then look up the transaction hash on a block explorer for that network.' }, { q: 'Does a mainnet anchor prove a product is genuine?', a: 'No. It proves a hash was committed at a point in time. It does not prove the physical item exists or matches the record.' }] },
    { keyword: 'verifiable credential signed false claim what verification proves', brand: 'authichain', schemaType: 'Service',
      lead: 'A valid signature on a verifiable credential proves who made the statement and that it has not changed since; it does not prove the statement is true, and a conforming verifier will correctly report a signed falsehood as verified.',
      bullets: ['The AuthiChain verifier returns one of three verdicts, verified, valid-unanchored or invalid: a verdict, not a score', 'Trust in the content comes from who the issuer is, which the reader judges from the issuer DID and outside knowledge of that party', 'Anchoring adds a checkable time: the record hash existed no later than the anchor'],
      faqs: [{ q: 'What does verified mean in the AuthiChain verifier?', a: 'The Ed25519 signature is valid over the JCS-canonicalised record, an anchor is present with a matching hash, and the anchor is on a mainnet chain. It says nothing about whether the issuer told the truth.' }, { q: 'Can a signed record be revoked?', a: 'Not yet. The spec defines no revocation in v0.1, so a record signed by a compromised key stays cryptographically valid. Revocation via credentialStatus is planned for v0.2.' }] },
    { keyword: 'espr dpp model batch or item level granularity', brand: 'authichain', schemaType: 'Service',
      lead: 'The ESPR lets each product group set the granularity of its digital product passport (model, batch or individual item), so the level your passport must sit at is decided by the delegated act for your product, not by a single rule.',
      bullets: ['A record can carry a GS1 Digital Link URL with a GTIN alone for model level, GTIN plus lot for batch level, or GTIN plus serial for item level', 'Each record is a signed W3C Verifiable Credential, so the same format and verifier work at every level', 'The spec requires a stable URL per item that does not change when the item changes hands, which is what item-level passports need'],
      faqs: [{ q: 'Which granularity applies to my product?', a: 'It depends on the delegated act for your product group. Read the act once it is published; until then, a record format that supports all three levels avoids a rebuild.' }, { q: 'Does a finer level make a record more trustworthy?', a: 'No. Granularity says how precisely a record identifies goods. Trust still comes from who signed it and, where present, from the anchor.' }] },
    { keyword: 'ed25519 fips 186-5 rfc 8032 signature', brand: 'authichain', schemaType: 'Service',
      lead: 'Ed25519 is specified in RFC 8032 and approved as EdDSA in FIPS 186-5.',
      bullets: ['The reference verifier uses Ed25519 verification over JCS-canonicalised record bytes, so you can read exactly what is signed', 'Using an approved algorithm is different from using a FIPS 140-validated module; AuthiChain does not claim module validation', 'Ed25519 is an elliptic-curve scheme and is not post-quantum secure, as with all such signatures'],
      faqs: [{ q: 'Is AuthiChain FIPS validated?', a: 'No. The signature algorithm is the one FIPS 186-5 approves. No cryptographic module validation is claimed.' }, { q: 'Can I check the signature without trusting AuthiChain?', a: 'Yes. The verifier is Apache-2.0 with no dependencies and runs offline; any RFC 8032 implementation can check the same signature over the same canonical bytes.' }] },
    { keyword: 'verify a product record offline without a vendor account', brand: 'authichain', schemaType: 'Service',
      lead: 'You can verify a record offline, with no account and no call to us: the issuer key is embedded in a did:key identifier, so checking the Ed25519 signature needs only the record and a verifier.',
      bullets: ['The zero-dependency reference verifier runs from the command line against a record file, and bundles an example record to try first', 'Signature, required fields and validity dates are checked locally; only confirming an anchor transaction on-chain needs the network', 'Because verification needs nothing from us, we cannot revoke, meter or observe it'],
      faqs: [{ q: 'What does offline verification not tell me?', a: 'It confirms who signed the record and that it is unchanged. It does not confirm the statement is true, and without an anchor it gives no checkable time.' }, { q: 'What if the issuer key has been compromised?', a: 'Version 0.1 of the spec has no revocation, so a record signed by a compromised key still verifies. Revocation via credentialStatus is planned for v0.2.' }] },
    { keyword: 'valid-unanchored verdict meaning verifiable credential', brand: 'authichain', schemaType: 'Service',
      lead: 'Valid-unanchored means the Ed25519 signature on the record is valid and no anchor was supplied, so the record is authentic as to its signer but carries no checkable time.',
      bullets: ['The verifier returns exactly one of verified, valid-unanchored or invalid; there is no score and no partial credit', 'Verified adds a present, well-formed mainnet anchor whose hash matches the canonical record', 'An absent anchor is a valid state, distinct from a failed one, and neither is ever reported as verified'],
      faqs: [{ q: 'Is valid-unanchored a failure?', a: 'No. It is a correct verdict for a signed record with no anchor, such as the bundled example. It makes a weaker claim than verified.' }, { q: 'How do I move a record to verified?', a: 'Anchor the SHA-256 of its canonical bytes on a mainnet chain and supply that anchor alongside the record. The anchor must match the recomputed hash.' }] },
    { keyword: 'blockchain anchor gdpr personal data hash on chain', brand: 'authichain', schemaType: 'Service',
      lead: 'An AuthiChain anchor puts one SHA-256 hash and a chain identifier on a public ledger, and the record itself stays off-chain, so a ledger entry carries no product data and no names.',
      bullets: ['The anchor object holds a record hash, a CAIP-2 chain identifier, a transaction hash and a timestamp, and nothing else', 'The record is a signed document you store and serve yourself, so correcting or deleting a copy is an ordinary storage operation', 'A hash of personal data can itself count as personal data under data-protection rules, so keep names and contact details out of records you anchor'],
      faqs: [{ q: 'Does anchoring make personal data immutable?', a: 'Only the hash is immutable. It cannot be reversed into the record, but a ledger entry cannot be erased either, which is why records should describe items and not people. Confirm the position for your own data with your data-protection adviser.' }, { q: 'What does the hash let a third party check?', a: 'Anyone holding the record can recompute SHA-256 over its canonical bytes and compare it with the anchored value. A match shows the record existed unchanged no later than the anchor time.' }] },
    { keyword: 'ed25519 vs ecdsa p-256 for verifiable credentials', brand: 'authichain', schemaType: 'Service',
      lead: 'Both Ed25519 and ECDSA over P-256 are approved signature schemes in FIPS 186-5; RFC 8032 defines Ed25519 with deterministic signatures, so signing the same bytes with the same key gives the same signature.',
      bullets: ['The did:key identifier for an Ed25519 key embeds the public key, so the verifier resolves the issuer with no network call', 'The reference verifier is Apache-2.0 with no dependencies, and the signed bytes are JCS-canonicalised JSON, so any RFC 8032 library can recheck a signature', 'Both algorithms are elliptic-curve schemes and neither is post-quantum secure; ML-DSA (FIPS 204) support is planned and not yet implemented'],
      faqs: [{ q: 'Which curve should an issuer pick?', a: 'Pick the one your verifiers and key-management hardware support. If your hardware security module only offers P-256, that constraint decides it. The AuthiChain v0.1 specification defines Ed25519 only.' }, { q: 'Is Ed25519 less secure than P-256?', a: 'Neither is known to be broken by classical computers. Both fall to a sufficiently large quantum computer running Shor\'s algorithm.' }] },
    { keyword: 'verifiable credential validfrom validuntil expiry check', brand: 'authichain', schemaType: 'Service',
      lead: 'A verifier checks validFrom and validUntil against a clock: the AuthiChain specification rejects a record whose validFrom is in the future or whose validUntil, if present, is in the past.',
      bullets: ['The date check runs offline, in the same step as the signature check, and needs no call to the issuer', 'validFrom is a required field, and a record without it is rejected rather than downgraded to a warning', 'The reference verifier accepts a `now` option, so you can test a record against any date and see the verdict change'],
      faqs: [{ q: 'Does an expired record fail the signature check?', a: 'No. The signature can be valid while the validity window has passed; the verifier reports invalid because the date check failed. The two checks are separate.' }, { q: 'Can validUntil stand in for revocation?', a: 'No. It limits when a record is accepted, but it cannot withdraw a record before its end date. The v0.1 specification has no revocation; credentialStatus is planned for v0.2.' }] },
    { keyword: 'gs1 digital link uri gtin lot serial structure', brand: 'authichain', schemaType: 'Service',
      lead: 'A GS1 Digital Link URI puts GS1 application identifiers in the path: /01/ for the GTIN, optionally /10/ for the lot and /21/ for the serial number, so https://id.gs1.org/01/09506000134352/21/SERIAL123 names one item.',
      bullets: ['An AuthiChain record uses that URI as its credentialSubject.id, and also carries gtin, serial and batch as plain fields you can read', 'The spec asks a registry to serve the record at a permanent URL that stays the same when the item changes hands, without authentication', 'GTIN alone identifies a model, GTIN with lot a batch, and GTIN with serial a single item'],
      faqs: [{ q: 'Does the URI have to point at AuthiChain?', a: 'No. The spec says records should be resolvable from the item\'s GS1 Digital Link URL; which resolver serves them is your choice, and the signed record verifies the same wherever it is hosted.' }, { q: 'Does a Digital Link URI prove the item is genuine?', a: 'No. It identifies an item, and anyone can print one on a label. The signature on the linked record shows who made the statements about it.' }] },
    { keyword: 'product registry 404 unknown serial number counterfeit check', brand: 'authichain', schemaType: 'Service',
      lead: 'A registry that answers a scan of an unknown serial number with 404 is telling you the item has no record; the AuthiChain specification requires this, and forbids returning a synthesised or empty-but-successful record in its place.',
      bullets: ['Section 6 of the spec requires a registry to return 404 for unknown items, so a counterfeit label carrying an invented serial cannot come back looking like a valid empty passport', 'Records are served at a permanent URL without authentication, so a scan result can be reproduced by anyone with the link', 'A 404 shows that no record exists at that identifier; a duplicated genuine serial on a copied label still resolves, which is why the signed record and its events are what you read'],
      faqs: [{ q: 'Does a 200 response mean an item is genuine?', a: 'No. It means a record exists at that URL. Run the verifier on the record to learn who signed it, and compare its fields with the physical item.' }, { q: 'Can a counterfeiter copy a real serial?', a: 'Yes. A label can be copied, and a registry cannot see the physical item. A signature proves authorship of the record, not that the label sits on the right goods.' }] },
    { keyword: 'verify product records in a ci pipeline exit code', brand: 'authichain', schemaType: 'Service',
      lead: 'The authichain-verify command line exits 0 for verified and valid-unanchored, 1 for invalid and 2 for a usage error, and prints the verdict, the reasons and each check as JSON, so a pipeline can gate on a record without parsing prose.',
      bullets: ['Run npx authichain-verify record.json, or add an anchor file as a second argument to check the record hash against it', 'The verifier has no dependencies, needs Node 18 or later, and makes no network call, so it runs in a build with no outbound access', 'Set ALLOW_TESTNET=1 only in test pipelines; without it a testnet anchor is not accepted as an anchor'],
      faqs: [{ q: 'Does exit code 0 mean the record is anchored?', a: 'No. Exit 0 covers both verified and valid-unanchored. Read the verdict field in the JSON output if your pipeline requires an anchor.' }, { q: 'Does the CLI confirm the anchor transaction on-chain?', a: 'No. It checks that the anchor carries the record hash and is well formed. Look up the transaction hash on a block explorer for that network to confirm it exists.' }] },
    { keyword: 'detect a tampered product record sha-256 hash mismatch', brand: 'authichain', schemaType: 'Service',
      lead: 'Change any field of a signed AuthiChain record and two checks can fail: the Ed25519 signature no longer matches the canonical bytes, and the SHA-256 of those bytes no longer equals the recordHash in the anchor.',
      bullets: ['The signed payload is the record with proofValue removed, canonicalised under RFC 8785, so two verifiers derive identical bytes from the same record', 'The signature check needs only the record, because the issuer key is embedded in the did:key identifier', 'The hash check needs the anchor object, and a mismatch makes the verdict invalid rather than a warning'],
      faqs: [{ q: 'Can someone edit a record and re-sign it?', a: 'Yes, with their own key. The result verifies against that key, which is a different issuer DID. Tamper detection tells you the record is unchanged since the named issuer signed it; you still decide whether you trust that issuer.' }, { q: 'Does an anchor stop a record from being edited?', a: 'No. It makes an edit detectable: the edited record hashes to a different value than the one committed to the ledger.' }] },
    { keyword: 'caip-2 chain identifier polygon:137 eip155 bip122 anchor', brand: 'authichain', schemaType: 'Service',
      lead: 'CAIP-2 names a blockchain as namespace:reference, such as polygon:137, eip155:1 for Ethereum mainnet or bip122 followed by the first 32 characters of the Bitcoin genesis block hash, so an anchor states exactly which network it sits on.',
      bullets: ['The AuthiChain spec requires the chain field of every anchor to use CAIP-2 form, so the network cannot be inferred or assumed', 'A verifier uses the chain identifier to decide whether an anchor is on a mainnet or a testnet, and treats a testnet anchor as unanchored by default', 'The transaction hash must be well formed for the named chain: an EVM chain needs 64 hex characters, and a malformed value is rejected'],
      faqs: [{ q: 'Why not just write the chain name?', a: 'Names are ambiguous: several networks share a name across forks and test deployments. A namespace and reference pair identifies one network.' }, { q: 'Does the verifier look up the transaction on the chain?', a: 'No. It validates the anchor offline. Confirming that the transaction exists is a separate step you do with an explorer or node for the named chain.' }] },
    { keyword: 'did:key issuer key rotation verifiable credential', brand: 'authichain', schemaType: 'Service',
      lead: 'A did:key identifier is the public key itself, so an issuer cannot rotate the key behind an identifier: a new key means a new did:key, and records signed under the old one keep verifying against the old one.',
      bullets: ['The verifier reads the key straight from the issuer identifier, so checking a record from before a rotation needs no lookup and no history from us', 'To move to a new key, issue new records under the new did:key and publish the link between the two identifiers where your customers already look for your keys', 'Version 0.1 of the specification has no revocation, so records signed by a retired key stay cryptographically valid; revocation via credentialStatus is planned for v0.2'],
      faqs: [{ q: 'Does a rotated key invalidate old records?', a: 'No. A record verifies against the key named in its own issuer field, so old records keep verifying. If a key was compromised, rely on anchor timestamps and your own notices to separate records signed before and after the compromise.' }, { q: 'Can I keep one stable issuer identity across rotations?', a: 'Not with did:key alone, because the identifier is the key. A method that resolves through a document you control, such as did:web, can keep one identifier while the key changes; the v0.1 specification defines did:key resolution only.' }] },
    { keyword: 'verifiable credential proofvalue multibase base58btc ed25519', brand: 'authichain', schemaType: 'Service',
      lead: 'In an AuthiChain record, proofValue is an Ed25519 signature written as a multibase string: a leading z marks base58btc encoding, and the bytes after decoding are the 64-byte signature defined in RFC 8032.',
      bullets: ['The signed input is the record with proof.proofValue removed, canonicalised per RFC 8785 and encoded as UTF-8', 'The same z prefix and base58btc encoding appear in the did:key identifier that carries the issuer public key, so one decoder handles both', 'The zero-dependency reference verifier is Apache-2.0 and short enough to read, so you can follow the decode and the signature check line by line'],
      faqs: [{ q: 'How do I check a proofValue without our verifier?', a: 'Strip the leading z, base58btc-decode the rest to 64 bytes, canonicalise the record without proofValue per RFC 8785, and verify with any RFC 8032 Ed25519 library against the public key in the issuer did:key.' }, { q: 'Does a valid proofValue show the record is true?', a: 'No. It shows who signed the record and that it is unchanged since. Whether the statements are accurate is a judgement about the issuer.' }] },
    { keyword: 'espr unique operator identifier facility identifier iso/iec 15459', brand: 'authichain', schemaType: 'Service',
      lead: 'Under the ESPR, a digital product passport is linked to a unique product identifier, and the regulation also calls for unique operator and facility identifiers; the text points to ISO/IEC 15459 for their structure, and CEN/CENELEC EN 18219:2026 sets requirements for all three.',
      bullets: ['A record carries the product as a GS1 Digital Link URL built from a GTIN, with lot or serial where the product group needs batch or item granularity', 'Identifying the issuer as a did:key lets a reader check the signing key offline, separate from any registered operator identifier', 'Which identifier scheme your delegated act accepts is set per product group, so read the act for your product before choosing'],
      faqs: [{ q: 'Is a GTIN the same as a unique product identifier?', a: 'A GTIN identifies a model. Granularity is set per product group, and batch or item level needs a lot or serial added to the identifier. Confirm the requirement in the delegated act and in EN 18219.' }, { q: 'Does a did:key replace an operator identifier?', a: 'No. A did:key identifies a signing key. An operator identifier identifies an economic operator in the ESPR sense. A record can carry both.' }] },
    { keyword: 'rfc 8785 json canonicalization signature verification', brand: 'authichain', schemaType: 'Service',
      lead: 'RFC 8785 (JSON Canonicalization Scheme) fixes key order, whitespace and number formatting so two parties derive byte-identical input from the same JSON, which is what lets a signature made by one verify on the other.',
      bullets: ['The AuthiChain specification requires signing the JCS form of the record, and forbids signing a pretty-printed or key-reordered form', 'A record is rejected, not downgraded to a warning, if its signature does not match the bytes the verifier derives', 'The repository includes adversarial conformance fixtures for the reference verifier, which you can run against your own implementation'],
      faqs: [{ q: 'Why not sign the JSON as stored?', a: 'Storing, pretty-printing or re-serialising JSON can change key order or whitespace without changing its meaning, and a signature over raw bytes would then fail. Canonicalising first makes the signed bytes reproducible.' }, { q: 'Is JCS the only way to canonicalise a credential?', a: 'No. RDF Dataset Canonicalization is another. AuthiChain v0.1 uses JCS, which needs no JSON-LD processing and is simple to implement in any language.' }] },
  ],
];
function buildEntry(d) {
  const b = BRANDS[d.brand];
  const kwTitle = titleCase(d.keyword);
  const slug = slugify(d.keyword);
  const url = `https://${b.origin || b.domain}/p/${slug}`;
  // d.title / d.h1 (optional) override the keyword-derived title and h1 without
  // moving the slug. Used where the keyword reads as an offering the page says
  // does not exist (RES pq-page check, item 9). d.title is the full <title>.
  const title = d.title || clampTitle(kwTitle, b.name);
  const firstSentence = d.lead.split('. ')[0].replace(/\.$/, '');
  // d.meta (optional) pins the meta description to the lead's first sentence
  // without the price suffix. Used where a claims removal (RES-13) shortened
  // a lead and the template would otherwise pull a new $ clause into meta.
  // A lead that already says an offer is not public must keep that sentence.
  // The price suffix would replace it ("Farm is not a public offer.").
  const metaDescription = d.meta
    ? clampMeta(d.meta, 158)
    : /not a public offer/i.test(d.lead)
      ? clampMeta(d.lead, 158)
      : clampMeta(`${firstSentence}. ${b.name} — ${b.price}`, 158);
  const h1 = d.h1 || kwTitle;
  const bodyHtml =
    `<p>${esc(d.lead)}</p>` +
    (d.bullets.length
      ? `<h2>Why ${esc(b.name)}</h2>` + `<ul>${d.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '') +
    `<h2>How it works</h2>` +
    // d.howItWorks (optional) overrides the How-it-works line for one entry (RES-100 F5).
    `<p>${d.howItWorks ? esc(d.howItWorks) : 'Issue a unique identifier per unit and link it to a signed record.'} ${esc(b.price)}</p>` +
    moneyCtaHtml(d.brand, d.keyword, b) +
    (d.faqs.length ? `<h2>FAQ</h2>` + d.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') : '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': d.schemaType,
        ...(d.schemaType === 'Article' ? { headline: h1, name: h1 } : { name: `${b.name} — ${kwTitle}` }),
        ...(d.schemaType === 'Product'
          ? { brand: { '@type': 'Brand', name: b.name } }
          : d.schemaType === 'Article'
            ? { publisher: { '@type': 'Organization', name: b.name, url: `https://${b.origin || b.domain}` } }
            : { provider: { '@type': 'Organization', name: b.name, url: `https://${b.origin || b.domain}` } }),
        description: d.lead,
        url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: b.name, item: `https://${b.origin || b.domain}` },
          { '@type': 'ListItem', position: 2, name: h1, item: url },
        ],
      },
      ...(d.faqs.length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: d.faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ]
        : []),
    ],
  };
  // noindex: true keeps a page reachable at /p/<slug> but out of
  // sitemap-slugs.json; worker-app/dynamic-pages.ts emits robots noindex for it.
  return { slug, keyword: d.keyword, brand: b.name, domain: b.domain, title, metaDescription, h1, bodyHtml, jsonLd, ...(d.noindex ? { noindex: true } : {}) };
}
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
  .map(ensureMoneyCta)
  .map(normalizeAuthichainHost);
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
// Landing workers must not import the full catalogue; they list /p/<slug> in
// their sitemaps from this small per-domain index instead.
const byDomain = {};
for (const p of merged) if (!p.noindex) (byDomain[p.domain] ||= []).push(p.slug);
for (const d of Object.keys(byDomain)) byDomain[d].sort();
fs.writeFileSync(SLUGS_OUT, JSON.stringify(byDomain, null, 2) + '\n');
console.log(`seeds preserved: ${seeds.length}`);
seeds.forEach((s) => console.log(`  - ${s.slug}`));
console.log(`generated pages: ${generated.length}`);
console.log(`total pages:     ${merged.length}`);
