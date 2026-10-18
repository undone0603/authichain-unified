/**
 * gen-seo-pages.cjs
 * Deterministically generates the committed programmatic-SEO catalogue
 * (content/seo/pages.json). Re-running is idempotent: hand-authored seed pages
 * are preserved by slug (bespoke copy is not rewritten). Slugs whose claim
 * record says emit "hold" keep the committed page and only refresh the
 * Get started block. They are not rebuilt from DATA. Other generated pages
 * are rebuilt from the DATA table. The Get started money CTA is always
 * rebuilt so checkout landings collect a recovery email.
 *
 * DATA is assembled below from scripts/seo-data/*.cjs (regulatory.cjs,
 * industry.cjs, standards.cjs, commercial.cjs, comparison.cjs) plus the
 * inline tail in this file.
 *
 * Requiring this module does not write. The write runs only when this file
 * is the main module, and only after assembleCatalogue accepts the catalogue.
 *
 * Run:  node scripts/gen-seo-pages.cjs
 * CI:   .github/workflows/gen-seo-pages.yml — Friday 09:00 UTC and
 *       workflow_dispatch. Commits content/seo/pages.json only when it changes.
 */
const fs = require('fs');
const path = require('path');
const { assembleCatalogue } = require('./seo-data/build-entry.cjs');
const claims = require('./seo-data/claim-goals.cjs');

const OUT = path.join(__dirname, '..', 'content', 'seo', 'pages.json');
const SLUGS_OUT = path.join(__dirname, '..', 'content', 'seo', 'sitemap-slugs.json');

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
  ],
];

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

function loadCatalogue(existingJson) {
  const existing = existingJson ?? JSON.parse(fs.readFileSync(OUT, 'utf8'));
  return assembleCatalogue({
    data: DATA,
    existing,
    claims,
    protectedSeedSlugs: PROTECTED_SEED_SLUGS,
    outLabel: OUT,
  });
}

function warnUnprotectedSeeds(seeds) {
  const unprotectedSeeds = seeds.filter((e) => !PROTECTED_SEED_SLUGS.has(e.slug));
  if (unprotectedSeeds.length > 0) {
    console.warn(
      `WARNING: ${unprotectedSeeds.length} page(s) in ${OUT} are neither DATA-generated ` +
        `nor in PROTECTED_SEED_SLUGS — add them to PROTECTED_SEED_SLUGS if they're ` +
        `intentional hand-authored pages, or they may be stale/orphaned:\n` +
        unprotectedSeeds.map((e) => `  - ${e.slug}`).join('\n')
    );
  }
}

function writeCatalogue(result) {
  fs.writeFileSync(OUT, JSON.stringify(result.merged, null, 2) + '\n');
  // Landing workers must not import the full catalogue; they list /p/<slug> in
  // their sitemaps from this small per-domain index instead.
  const byDomain = {};
  for (const p of result.merged) if (!p.noindex) (byDomain[p.domain] ||= []).push(p.slug);
  for (const d of Object.keys(byDomain)) byDomain[d].sort();
  fs.writeFileSync(SLUGS_OUT, JSON.stringify(byDomain, null, 2) + '\n');
  console.log(`seeds preserved: ${result.seeds.length}`);
  result.seeds.forEach((s) => console.log(`  - ${s.slug}`));
  console.log(`generated pages: ${result.generated.length}`);
  console.log(`total pages:     ${result.merged.length}`);
}

if (require.main === module) {
  const result = loadCatalogue();
  warnUnprotectedSeeds(result.seeds);
  writeCatalogue(result);
}

module.exports = {
  DATA,
  PROTECTED_SEED_SLUGS,
  loadCatalogue,
};
