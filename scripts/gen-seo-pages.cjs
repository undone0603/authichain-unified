/**
 * gen-seo-pages.cjs
 * Deterministically generates the committed programmatic-SEO catalogue
 * (content/seo/pages.json). Re-running is idempotent: hand-authored seed pages
 * are preserved by slug and generated pages are (re)built from the DATA table.
 *
 * Run:  node scripts/gen-seo-pages.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'content', 'seo', 'pages.json');

const BRANDS = {
  authichain: { name: 'AuthiChain', domain: 'authichain.com', price: 'Plans start at $49/mo.' },
  strainchain: { name: 'StrainChain', domain: 'strainchain.io', price: 'Plans start at $199/mo.' },
  govchain: { name: 'GovChain', domain: 'govchain.us', price: 'No enterprise contract — public-sector pricing.' },
  qron: { name: 'QRON', domain: 'qron.space', price: 'Plans start at $29/mo.' },
};

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ACRONYMS = { qr: 'QR', eu: 'EU', us: 'US', gs1: 'GS1', epcis: 'EPCIS', dscsa: 'DSCSA', dpp: 'DPP', eudr: 'EUDR', ppwr: 'PPWR', did: 'DID', cen: 'CEN', cenelec: 'CENELEC', espr: 'ESPR', nft: 'NFT', fsma: 'FSMA', iso: 'ISO', sd: 'SD', jwt: 'JWT' };
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

// Each entry: keyword, brand, schemaType, lead, bullets[3], close, faqs[{q,a}]
const DATA = [
  // ── blockchain qr code for [industry] ─────────────────────────────
  { keyword: 'blockchain qr code for cannabis', brand: 'strainchain', schemaType: 'Product',
    lead: 'Print a single QR code on every package and give regulators, dispensaries, and consumers a tamper-proof, blockchain-anchored record of that product’s journey from seed to sale.',
    bullets: ['METRC and BioTrack sync — no duplicate data entry', 'Lab certificates hashed to Bitcoin Ordinals for permanent proof', 'State auditors verify chain of custody in ~10 seconds by scan'],
    faqs: [{ q: 'Does it replace METRC?', a: 'No — it runs alongside METRC/BioTrack and turns that compliance data into a consumer-facing trust asset.' }, { q: 'What does the consumer see?', a: 'A scan opens verified lab results, strain provenance, and an immutable chain of custody.' }] },
  { keyword: 'blockchain qr code for luxury', brand: 'authichain', schemaType: 'Product',
    lead: 'Attach a cryptographically-signed QR code to each luxury item so buyers can confirm authenticity in under two seconds — on the shelf, in resale, or at customs.',
    bullets: ['5-agent AI consensus screens every scan for anomalies', 'NFT certificate of authenticity travels with the item on resale', 'Bitcoin L1 anchoring makes the provenance record unforgeable'],
    faqs: [{ q: 'Does the QR work after resale?', a: 'Yes — ownership and provenance transfer with the item, protecting secondary-market value.' }, { q: 'Can counterfeiters copy the QR?', a: 'Copying the image is useless: verification is cryptographic and checked against the blockchain record.' }] },
  { keyword: 'blockchain qr code for pharma', brand: 'authichain', schemaType: 'Product',
    lead: 'Meet DSCSA serialization and give patients, pharmacists, and inspectors an instant, blockchain-verified check that a medicine is genuine and unexpired.',
    bullets: ['DSCSA-aligned serialization and lot-level tracking', 'Tamper-evident QR anchored to an immutable ledger', 'Recall targeting down to the individual unit'],
    faqs: [{ q: 'Is this DSCSA compliant?', a: 'The data model maps to DSCSA serialization and interoperable data-exchange requirements.' }, { q: 'How fast is verification?', a: 'Sub-two-second cryptographic verification from any smartphone camera.' }] },
  { keyword: 'blockchain qr code for electronics', brand: 'authichain', schemaType: 'Product',
    lead: 'Protect electronics and components against grey-market and counterfeit parts with a blockchain QR code that proves origin, warranty, and firmware integrity.',
    bullets: ['Component-level provenance for BOM integrity', 'Warranty and firmware attestation tied to each serial', 'EU DPP-ready material and repairability data'],
    faqs: [{ q: 'Can it cover components, not just finished goods?', a: 'Yes — provenance can be issued at component, module, and finished-product level.' }, { q: 'Does it help with EU DPP?', a: 'Electronics fall under upcoming EU DPP scope; AuthiChain exports the required data out of the box.' }] },
  { keyword: 'blockchain qr code for food', brand: 'authichain', schemaType: 'Product',
    lead: 'Give shoppers and food-safety auditors a scannable, blockchain-anchored history of where a food product was grown, processed, and shipped.',
    bullets: ['Farm-to-shelf traceability in a single scan', 'Rapid, unit-level recall targeting', 'Cold-chain and certification data attached per lot'],
    faqs: [{ q: 'Does it support recalls?', a: 'Yes — you can trace and isolate affected lots in seconds instead of days.' }, { q: 'What data can I attach?', a: 'Origin, processing steps, certifications, cold-chain readings, and lab results.' }] },
  { keyword: 'blockchain qr code for automotive', brand: 'authichain', schemaType: 'Product',
    lead: 'Fight counterfeit auto parts and prove OEM authenticity with a blockchain QR code that carries part provenance, warranty, and service history.',
    bullets: ['OEM vs aftermarket authenticity in one scan', 'Immutable service and warranty history per part', 'Supply-chain provenance for safety-critical components'],
    faqs: [{ q: 'Can dealers verify parts?', a: 'Any dealer or technician can confirm a part is genuine OEM by scanning it.' }, { q: 'Does history survive resale?', a: 'Yes — the on-chain record persists across owners and service events.' }] },
  { keyword: 'blockchain qr code for aerospace', brand: 'authichain', schemaType: 'Product',
    lead: 'Ensure every aerospace component is traceable and genuine with blockchain QR codes that anchor certification, provenance, and maintenance records.',
    bullets: ['Certificate-of-conformance hashing for each part', 'Full genealogy for safety-critical components', 'Audit-ready, tamper-proof maintenance history'],
    faqs: [{ q: 'Is the record tamper-proof?', a: 'Records are hashed and anchored on-chain, so certification data cannot be altered after the fact.' }, { q: 'Can it track maintenance events?', a: 'Yes — each inspection or repair can be appended immutably to the part’s genealogy.' }] },
  { keyword: 'blockchain qr code for defense', brand: 'govchain', schemaType: 'Service',
    lead: 'Deliver in-transit visibility and anti-tamper assurance for defense supply chains with blockchain QR codes that meet federal traceability expectations.',
    bullets: ['Chain-of-custody proof for controlled items', 'SAM.gov / FAR-aligned traceability records', 'Cryptographic anti-tamper verification in the field'],
    faqs: [{ q: 'Is it suitable for federal contracts?', a: 'GovChain is built for federal procurement workflows and on-chain proof-of-custody.' }, { q: 'Does it work offline?', a: 'Verification uses signed records that can be validated even in low-connectivity environments.' }] },
  { keyword: 'blockchain qr code for cosmetics', brand: 'authichain', schemaType: 'Product',
    lead: 'Protect cosmetics and skincare brands from counterfeits with blockchain QR codes that prove batch authenticity and ingredient provenance.',
    bullets: ['Batch-level authenticity and expiry verification', 'Ingredient sourcing and cruelty-free claims on-chain', 'Consumer engagement through verified product stories'],
    faqs: [{ q: 'Can I prove ingredient claims?', a: 'Yes — sourcing and certification data are anchored and verifiable by consumers.' }, { q: 'Does it help against fakes?', a: 'Counterfeit packaging fails cryptographic verification instantly.' }] },
  { keyword: 'blockchain qr code for jewelry', brand: 'authichain', schemaType: 'Product',
    lead: 'Give fine jewelry and watches a blockchain-backed digital passport so provenance, materials, and ownership are provable for a lifetime.',
    bullets: ['Diamond and gemstone provenance on-chain', 'Ownership transfer for insurance and resale', 'NFT certificate paired to each piece'],
    faqs: [{ q: 'Does it support resale?', a: 'Ownership and provenance transfer securely, preserving resale and insurance value.' }, { q: 'Can I record gemstone origin?', a: 'Yes — conflict-free sourcing and grading reports can be anchored to the piece.' }] },

  // ── product authentication [use case] ─────────────────────────────
  { keyword: 'product authentication for luxury goods', brand: 'authichain', schemaType: 'Product',
    lead: 'Authenticate luxury goods with AI image analysis plus blockchain provenance so buyers and resale platforms can verify genuineness in seconds.',
    bullets: ['AI + blockchain dual verification', 'Resale-safe ownership transfer', 'Brand-controlled Verifiable Credentials'],
    faqs: [{ q: 'How is it different from a hologram?', a: 'Holograms can be copied; cryptographic verification against a blockchain record cannot.' }, { q: 'Who holds the keys?', a: 'The brand does — AuthiChain uses W3C Verifiable Credentials, not a custodial database.' }] },
  { keyword: 'product authentication for cannabis dispensary', brand: 'strainchain', schemaType: 'Product',
    lead: 'Let dispensary customers scan any product to confirm verified lab results and an unbroken chain of custody — turning compliance into a point-of-sale trust signal.',
    bullets: ['Verified COAs displayed at point of sale', 'METRC/BioTrack-synced provenance', 'Builds customer trust and repeat purchase'],
    faqs: [{ q: 'Do budtenders need training?', a: 'No — customers self-scan, and staff can pull the same verified record instantly.' }, { q: 'Does it integrate with my POS?', a: 'It runs alongside existing compliance and POS systems without duplicate entry.' }] },
  { keyword: 'product authentication for government supply chain', brand: 'govchain', schemaType: 'Service',
    lead: 'Authenticate goods across government supply chains with on-chain proof of origin, custody, and delivery that auditors can verify without a vendor call.',
    bullets: ['On-chain proof of custody and delivery', 'FAR / SAM.gov-aligned records', 'Auditor self-service verification'],
    faqs: [{ q: 'Can auditors verify independently?', a: 'Yes — verification is self-service against the public record, no vendor gatekeeping.' }, { q: 'Is it procurement-ready?', a: 'GovChain is designed around federal procurement and traceability requirements.' }] },
  { keyword: 'product authentication for medical devices', brand: 'authichain', schemaType: 'Product',
    lead: 'Authenticate medical devices with UDI-aligned serialization and blockchain provenance to stop counterfeits and speed recalls.',
    bullets: ['UDI-compatible serialization', 'Unit-level recall and expiry tracking', 'Tamper-evident authenticity for clinicians'],
    faqs: [{ q: 'Does it align with UDI?', a: 'The serialization model is compatible with FDA UDI requirements.' }, { q: 'Can hospitals verify devices?', a: 'Any clinician can confirm authenticity and status by scanning the device.' }] },
  { keyword: 'product authentication for collectibles', brand: 'authichain', schemaType: 'Product',
    lead: 'Authenticate collectibles, memorabilia, and limited editions with a blockchain certificate that proves genuineness and ownership across every resale.',
    bullets: ['NFT certificate of authenticity per item', 'Provenance that survives every resale', 'Grading and edition data anchored on-chain'],
    faqs: [{ q: 'Does provenance transfer on sale?', a: 'Yes — ownership and history move with the item, protecting collector value.' }, { q: 'Can I record grading?', a: 'Grading and edition details can be anchored to the certificate.' }] },
  { keyword: 'product authentication for electronics', brand: 'authichain', schemaType: 'Product',
    lead: 'Authenticate consumer and industrial electronics to eliminate counterfeit and grey-market units, with blockchain-verified origin and warranty.',
    bullets: ['Genuine-vs-grey-market verification', 'Warranty and firmware attestation', 'EU DPP-ready product data'],
    faqs: [{ q: 'Can customers check warranty?', a: 'Yes — warranty status is tied to the authenticated serial and visible on scan.' }, { q: 'Does it deter grey-market resale?', a: 'Region and channel data on-chain make diversion easy to detect.' }] },

  // ── eu digital product passport [material] ────────────────────────
  { keyword: 'eu digital product passport textiles', brand: 'authichain', schemaType: 'Service',
    lead: 'Issue registry-ready EU Digital Product Passports for textiles and apparel — fiber composition, recycled content, and care data anchored and exportable to the EU registry.',
    bullets: ['Fiber and recycled-content declarations', 'Care, durability, and repairability data', 'EPCIS 2.0 + JSON-LD registry export'],
    faqs: [{ q: 'When do textiles need a DPP?', a: 'Textiles are a priority category, with delegated regulations expected from 2028.' }, { q: 'How is the passport delivered?', a: 'Via a unique QR/NFC identifier per garment linking to the anchored passport.' }] },
  { keyword: 'eu digital product passport batteries', brand: 'authichain', schemaType: 'Service',
    lead: 'Generate compliant EU Battery Passports with carbon footprint, state-of-health, and material recovery data — anchored on-chain and ready for the EU registry.',
    bullets: ['Carbon footprint and material composition', 'State-of-health and recycled-content tracking', 'Ready for the Feb 2027 battery mandate'],
    faqs: [{ q: 'When is the battery passport mandatory?', a: 'EV and industrial battery passports become mandatory in February 2027.' }, { q: 'What data is required?', a: 'Carbon footprint, material composition, state-of-health, and recycled content, among others.' }] },
  { keyword: 'eu digital product passport electronics', brand: 'authichain', schemaType: 'Service',
    lead: 'Create EU Digital Product Passports for electronics with repairability scores, hazardous-substance declarations, and spare-parts availability built in.',
    bullets: ['Repairability and spare-parts data', 'Hazardous-substance (RoHS/REACH) declarations', 'Registry-ready EPCIS 2.0 export'],
    faqs: [{ q: 'Which electronics are covered?', a: 'ICT and consumer electronics are priority categories under the ESPR.' }, { q: 'Can I include repair data?', a: 'Yes — repairability scores and spare-part availability are part of the passport.' }] },
  { keyword: 'eu digital product passport furniture', brand: 'authichain', schemaType: 'Service',
    lead: 'Issue EU Digital Product Passports for furniture with material sourcing, durability, and end-of-life recycling data anchored for registry submission.',
    bullets: ['Material sourcing and FSC/PEFC claims', 'Durability and disassembly guidance', 'End-of-life and recyclability data'],
    faqs: [{ q: 'Is furniture in scope?', a: 'Furniture is among the priority product groups under the ESPR framework.' }, { q: 'Can I prove sustainable sourcing?', a: 'Yes — certification and sourcing claims are anchored and verifiable.' }] },
  { keyword: 'eu digital product passport steel', brand: 'authichain', schemaType: 'Service',
    lead: 'Provide EU Digital Product Passports for iron and steel products with embodied-carbon, recycled-content, and grade data ready for the EU registry.',
    bullets: ['Embodied-carbon and scope 1–3 data', 'Recycled content and grade certification', 'Auditable at batch level'],
    faqs: [{ q: 'Why steel first?', a: 'Iron and steel are high-impact priority categories for carbon and circularity reporting.' }, { q: 'Can I attach mill certificates?', a: 'Yes — mill test certificates can be hashed and anchored per batch.' }] },
  { keyword: 'eu digital product passport tyres', brand: 'authichain', schemaType: 'Service',
    lead: 'Generate EU Digital Product Passports for tyres with rolling-resistance, material, and retread data anchored and exportable to the EU registry.',
    bullets: ['Material composition and recycled content', 'Performance and rolling-resistance data', 'Retread and end-of-life tracking'],
    faqs: [{ q: 'Are tyres in DPP scope?', a: 'Tyres are among the priority product categories under the ESPR.' }, { q: 'Can I track retreads?', a: 'Yes — lifecycle events including retreading can be appended to the passport.' }] },

  // ── anti-counterfeit [product type] ───────────────────────────────
  { keyword: 'anti-counterfeit wine', brand: 'authichain', schemaType: 'Product',
    lead: 'Stop wine counterfeiting with tamper-evident blockchain seals that prove vintage, estate, and bottle authenticity from cellar to collector.',
    bullets: ['Bottle-level authenticity and provenance', 'Tamper-evident seal tied to on-chain record', 'Estate and vintage verification for collectors'],
    faqs: [{ q: 'Does it protect resale value?', a: 'Yes — verifiable provenance underpins collector and auction value.' }, { q: 'What if the seal is broken?', a: 'A broken seal invalidates verification, exposing tampering or refilling.' }] },
  { keyword: 'anti-counterfeit spirits', brand: 'authichain', schemaType: 'Product',
    lead: 'Protect premium spirits from refilling and counterfeiting with blockchain-anchored bottle authentication and tamper-evident closures.',
    bullets: ['Anti-refill tamper-evident verification', 'Distillery and batch provenance on-chain', 'Consumer engagement through verified stories'],
    faqs: [{ q: 'Can it detect refilled bottles?', a: 'Tamper-evident closures tied to on-chain records reveal refilling attempts.' }, { q: 'Does it work internationally?', a: 'Verification is global and works from any smartphone.' }] },
  { keyword: 'anti-counterfeit pharmaceutical', brand: 'authichain', schemaType: 'Product',
    lead: 'Eliminate counterfeit medicines with DSCSA-aligned serialization and blockchain verification that patients and pharmacists can trust instantly.',
    bullets: ['DSCSA-aligned unit serialization', 'Tamper-evident, blockchain-verified packaging', 'Unit-level recall and expiry checks'],
    faqs: [{ q: 'Is it DSCSA aligned?', a: 'Yes — serialization and data exchange map to DSCSA requirements.' }, { q: 'Who can verify a pack?', a: 'Patients, pharmacists, and inspectors can all verify authenticity by scan.' }] },
  { keyword: 'anti-counterfeit luxury handbags', brand: 'authichain', schemaType: 'Product',
    lead: 'Authenticate luxury handbags with AI image analysis and a blockchain certificate that proves genuineness through every resale.',
    bullets: ['AI + blockchain authentication', 'Resale-safe digital certificate', 'Brand-controlled Verifiable Credentials'],
    faqs: [{ q: 'Does it help resale platforms?', a: 'Yes — resellers and buyers verify authenticity instantly, reducing fraud.' }, { q: 'Can the certificate be faked?', a: 'No — it is cryptographically bound to the item and checked on-chain.' }] },
  { keyword: 'anti-counterfeit sneakers', brand: 'authichain', schemaType: 'Product',
    lead: 'Beat sneaker counterfeits with blockchain-verified authentication that proves a pair is genuine and tracks ownership across the resale market.',
    bullets: ['Pair-level authenticity verification', 'Resale ownership transfer on-chain', 'Limited-edition drop protection'],
    faqs: [{ q: 'Does it support resale markets?', a: 'Yes — provenance and ownership move with the pair through every sale.' }, { q: 'Can it protect drops?', a: 'Limited editions can be authenticated and tracked from the first sale.' }] },
  { keyword: 'anti-counterfeit cosmetics', brand: 'authichain', schemaType: 'Product',
    lead: 'Protect cosmetics brands and consumers from counterfeits with blockchain-verified batch authenticity and tamper-evident packaging.',
    bullets: ['Batch authenticity and expiry verification', 'Tamper-evident, scan-to-verify packaging', 'Ingredient and safety claims on-chain'],
    faqs: [{ q: 'Can consumers verify safety?', a: 'Yes — batch, expiry, and safety data are verifiable by scanning the product.' }, { q: 'Does it stop counterfeit packaging?', a: 'Counterfeit packaging fails cryptographic verification instantly.' }] },

  // ── supply chain traceability [sector] ────────────────────────────
  { keyword: 'supply chain traceability food safety', brand: 'authichain', schemaType: 'Service',
    lead: 'Achieve end-to-end food-safety traceability with blockchain records that make recalls precise and audits instant, from farm to shelf.',
    bullets: ['Unit-level recall targeting in seconds', 'Cold-chain and certification data per lot', 'FSMA-friendly audit trail'],
    faqs: [{ q: 'How fast are recalls?', a: 'Affected lots can be isolated in seconds rather than days.' }, { q: 'Does it help with audits?', a: 'Auditors verify an immutable, timestamped trail without manual reconciliation.' }] },
  { keyword: 'supply chain traceability defense', brand: 'govchain', schemaType: 'Service',
    lead: 'Deliver defense supply-chain traceability with immutable chain-of-custody records and anti-tamper verification aligned to federal requirements.',
    bullets: ['Immutable chain of custody for controlled items', 'FAR / SAM.gov-aligned traceability', 'Field-ready anti-tamper verification'],
    faqs: [{ q: 'Is it federal-ready?', a: 'GovChain is built around federal procurement and traceability workflows.' }, { q: 'Can it verify in the field?', a: 'Yes — signed records validate even in low-connectivity environments.' }] },
  { keyword: 'supply chain traceability aerospace', brand: 'govchain', schemaType: 'Service',
    lead: 'Provide aerospace supply-chain traceability with part genealogy, certificate hashing, and immutable maintenance history for airworthiness assurance.',
    bullets: ['Full part genealogy and provenance', 'Certificate-of-conformance hashing', 'Immutable, audit-ready maintenance records'],
    faqs: [{ q: 'Can it track airworthiness data?', a: 'Yes — certifications and maintenance events are anchored per part.' }, { q: 'Is the record tamper-proof?', a: 'Records are hashed on-chain and cannot be altered after submission.' }] },
  { keyword: 'supply chain traceability pharmaceutical', brand: 'authichain', schemaType: 'Service',
    lead: 'Trace pharmaceuticals across the supply chain with DSCSA-aligned serialization and blockchain records that make provenance and recalls verifiable.',
    bullets: ['DSCSA-aligned serialization and lot tracking', 'Immutable chain of custody', 'Unit-level recall and diversion detection'],
    faqs: [{ q: 'Does it support DSCSA?', a: 'Yes — the data model maps to DSCSA serialization and interoperability rules.' }, { q: 'Can it detect diversion?', a: 'Channel and region data on-chain make diversion easy to spot.' }] },
  { keyword: 'supply chain traceability automotive', brand: 'authichain', schemaType: 'Service',
    lead: 'Trace automotive parts and vehicles across the supply chain with blockchain provenance that proves origin, quality, and safety-critical genealogy.',
    bullets: ['Safety-critical part genealogy', 'Supplier quality and recall targeting', 'Warranty and service history on-chain'],
    faqs: [{ q: 'Can it target recalls?', a: 'Yes — affected parts and vehicles can be identified precisely and fast.' }, { q: 'Does it cover suppliers?', a: 'Multi-tier supplier provenance is supported down to the component.' }] },

  // ── standards & regulatory deadlines (2026 research) ──────────────
  { keyword: 'gs1 digital link sunrise 2027', brand: 'qron', schemaType: 'Service',
    lead: 'GS1 Sunrise 2027 moves point-of-sale scanning to QR codes carrying GS1 Digital Link URIs — the same identifier format QRON uses to attach a signed, verifiable record to every code it issues.',
    bullets: ['GS1 Digital Link is the item-identity format in the AuthiChain protocol spec, not a proprietary URL scheme', 'One QR code serves both GS1 Digital Link resolution and Ed25519-signed verification — no second code needed', 'Existing GTINs and serials map directly into a verifiable record; nothing about your GS1 numbering changes'],
    faqs: [{ q: 'Does Sunrise 2027 require blockchain?', a: 'No — Sunrise 2027 is a GS1 retail-scanning standard. Anchoring the record on-chain is optional and adds tamper-evidence on top of a compliant Digital Link QR code.' }, { q: 'Will our current barcodes stop working?', a: 'No — Sunrise 2027 adds 2D scanning capability at POS; linear barcodes keep working during and after the transition.' }] },
  { keyword: 'dscsa unit level traceability 2026', brand: 'authichain', schemaType: 'Service',
    lead: 'DSCSA enforcement moves to unit-level, electronic interoperable data exchange in November 2026 — replacing PDFs and manual reconciliation with records a trading partner can verify without calling you.',
    bullets: ['EPCIS-compatible event data at the unit level, not just the case or lot', 'Records are Ed25519-signed Verifiable Credentials a downstream partner verifies offline, no portal login required', 'Every required field check runs before a record is accepted — partial or malformed data is rejected, not downgraded to a warning'],
    faqs: [{ q: 'What changes in November 2026?', a: 'Trading partners must exchange product tracing data electronically at the unit level using interoperable systems; manual and PDF-based processes no longer satisfy the requirement.' }, { q: 'Does this replace our EPCIS system?', a: 'No — it signs and anchors the records your EPCIS system already produces so a partner can verify them independently.' }] },
  { keyword: 'eu digital product passport registry', brand: 'authichain', schemaType: 'Service',
    lead: 'Every EU Digital Product Passport must resolve from a permanent, unauthenticated URL into the EU registry — AuthiChain issues that record as a signed Verifiable Credential built on open, interoperable standards.',
    bullets: ['Records follow the W3C Verifiable Credentials Data Model 2.0 — an open format, not a proprietary schema tied to one vendor', 'A resolvable GS1 Digital Link URL per item, live for the product’s full lifecycle, not just at point of sale', '404 on an unknown item, never a synthesized or empty-but-successful response'],
    faqs: [{ q: 'When must our records be registry-ready?', a: 'The first product-specific delegated acts land from 2026, each with an 18-month compliance window once adopted — batteries first, by February 2027.' }, { q: 'Does the registry need us to run a server?', a: 'Records resolve from a permanent URL without authentication — no account or vendor call required to verify one.' }] },
  { keyword: 'verifiable credential supply chain provenance', brand: 'authichain', schemaType: 'Service',
    lead: 'W3C formed a Verifiable Supply Chain Community Group in 2026 to standardize proofs of origin and custody that any party can check without trusting the issuer’s database — the same problem AuthiChain’s Verifiable Credentials already address.',
    bullets: ['Every provenance record is a W3C Verifiable Credential 2.0, not a proprietary schema', 'Ed25519 signatures verify offline — a partner checks authorship without a network call to AuthiChain', 'Apache-2.0 spec with a patent grant, so a partner’s legal team can sign off on implementing a compatible verifier'],
    faqs: [{ q: 'Do we need to join the W3C group to use this?', a: 'No — the AuthiChain protocol already implements VC 2.0 and Ed25519 signing; the community group is standardizing supply-chain-specific profiles on the same base spec.' }, { q: 'Can a partner verify without an AuthiChain account?', a: 'Yes — the spec, the verifier, and the conformance suite are public. A partner runs the reference verifier or their own VC 2.0-compatible checker directly against the record.' }] },
  { keyword: 'battery passport qr code requirements', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU battery passport mandate arrives February 18, 2027, with harmonised CEN-CENELEC standards covering the QR code itself, not just the data behind it.',
    bullets: ['GS1 Digital Link-formatted QR per battery, the same item-identity format used in the AuthiChain protocol spec', 'Carbon footprint, state-of-health, and material-recovery fields anchored to the signed record behind the code', 'A verifier rejects a testnet anchor by default and distinguishes anchored records from unanchored ones'],
    faqs: [{ q: 'What is the compliance deadline?', a: 'February 18, 2027, for EV, e-mobility, home-storage, and industrial batteries placed on the EU market.' }, { q: 'Is the QR code alone enough?', a: 'No — the code has to resolve to a record meeting the passport’s required fields; a code that just links to a marketing page is not a passport.' }] },
  { keyword: 'epcis 2.0 blockchain anchoring', brand: 'authichain', schemaType: 'Service',
    lead: 'EPCIS 2.0 is the event data standard DSCSA and GS1 traceability rules require — AuthiChain hashes and anchors those events so a partner can prove the record has not been altered after the fact.',
    bullets: ['SHA-256 hash of the canonical event record, anchored on Polygon with a CAIP-2 chain identifier', 'A verifier rejects a malformed or testnet anchor instead of displaying it as proof', 'EPCIS events export into a W3C Verifiable Credential without a schema rewrite'],
    faqs: [{ q: 'Do we need to change our EPCIS implementation?', a: 'No — anchoring wraps the events your EPCIS repository already emits; the event schema stays yours.' }, { q: 'What does anchoring add over EPCIS alone?', a: 'EPCIS proves what was recorded; anchoring proves it has not changed since — a partner checks the hash independently instead of trusting your database.' }] },

  // ── standards & regulatory deadlines, round 2 (2026 research) ─────
  { keyword: 'eu dpp qr code data carrier requirements', brand: 'authichain', schemaType: 'Service',
    lead: 'ESPR Article 10 requires a Digital Product Passport’s data carrier to stay on the product for its full service life, using open, interoperable formats — not a proprietary code locked to one vendor’s scanner.',
    bullets: ['GS1 Digital Link is the open URL format the AuthiChain protocol spec already uses for item identity — interoperable by construction, not a workaround', 'The signed record behind the code is a W3C Verifiable Credential, readable by any conforming verifier, not one vendor’s app', 'An unknown or malformed code returns 404, not a synthesized response — a scan either resolves to a real record or says so'],
    faqs: [{ q: 'Does the data carrier have to be a QR code?', a: 'Article 10 lets manufacturers choose the carrier — QR code, RFID, or NFC — as long as it is durable, accessible, and built on open standards. QR is the most common choice today.' }, { q: 'What standard covers the carrier itself?', a: 'EN 18220:2026, referenced in the Official Journal in July 2026, sets the data-carrier requirements; product-specific delegated acts still set size, durability, and error-correction parameters per category.' }] },
  { keyword: 'right to repair spare parts verification', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU Right to Repair Directive, in force from July 31, 2026, requires manufacturers to give repairers unambiguous model and serial identification — a scan should confirm a part is genuine, not decide whether a repair is allowed to proceed.',
    bullets: ['Genuine-part verification runs offline against the signed record — no network call to a manufacturer database required', 'A signature proves a part was issued by the manufacturer; it does not gate installation the way a paired-parts lockout does', 'Model and serial data travel in a W3C Verifiable Credential any repairer’s tool can read, not one tied to a single OEM app'],
    faqs: [{ q: 'Does this stop third-party or reused parts from being installed?', a: 'No — verification confirms whether a specific part is OEM-genuine. It does not disable a device or block a non-OEM part from being installed.' }, { q: 'What must manufacturers provide under the directive?', a: 'Unambiguous product identification — model and serial number — plus repair and maintenance information, for the product categories the directive covers.' }] },
  { keyword: 'eudr deforestation traceability blockchain', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU Deforestation Regulation requires proof that cocoa, coffee, palm oil, rubber, soy, timber, and cattle are traceable to the plot of land where they were grown — a claim that only holds up if a buyer can check it without asking you.',
    bullets: ['Geolocation and chain-of-custody events hashed and anchored per batch for tamper-evidence', 'Records are W3C Verifiable Credentials, so an importer’s compliance system can verify them without an AuthiChain account', 'Large and medium operators are in scope from December 30, 2026; small and micro enterprises from June 30, 2027'],
    faqs: [{ q: 'What commodities does EUDR cover?', a: 'Cattle, cocoa, coffee, oil palm, rubber, soy, and wood, plus derived products such as leather, chocolate, and furniture.' }, { q: 'Does blockchain anchoring satisfy EUDR by itself?', a: 'No — EUDR requires a geolocation and legality due-diligence statement. Anchoring makes the supporting documentation tamper-evident; it does not replace the statement itself.' }] },
  { keyword: 'cannabis product recall traceability', brand: 'strainchain', schemaType: 'Service',
    lead: 'When a cannabis batch fails a pesticide or mold retest, the question is how fast you can isolate every package it touched — StrainChain ties each unit to its METRC/BioTrack batch record so a recall targets units, not an entire product line.',
    bullets: ['Unit-level recall targeting instead of a blanket pull across every dispensary carrying the SKU', 'Lab retest results attach to the same on-chain record consumers already scan for COAs', 'Chain-of-custody events are tamper-evident, so a recall trace does not depend on trusting one dispensary’s paperwork'],
    faqs: [{ q: 'Does this replace our METRC recall workflow?', a: 'No — it runs alongside METRC/BioTrack and narrows a recall to the specific units and batches affected, using the compliance data you already report.' }, { q: 'Can dispensaries check recall status by scan?', a: 'Yes — the same QR code customers use for lab results shows recall status if a batch has been flagged.' }] },

  // ── standards & regulatory deadlines, round 3 (2026 research) ─────
  { keyword: 'ppwr packaging qr code labeling requirements', brand: 'authichain', schemaType: 'Service',
    lead: 'PPWR requires harmonised packaging labels from 12 August 2028 (or 24 months after the Commission’s implementing acts, whichever is later) and lets manufacturers attach a QR code for sorting and disposal data — the same signed-record format AuthiChain already issues for product authentication.',
    bullets: ['A W3C Verifiable Credential is legible to any conforming reader, matching PPWR’s requirement that packaging information not depend on one proprietary app', 'One record and one QR code can carry both PPWR sorting data and product authentication — no second code printed on the pack', 'PPWR treats the QR code as supplementary: it does not replace the physical label the regulation still requires'],
    faqs: [{ q: 'When does the QR code labeling requirement take effect?', a: 'Harmonised labels are required from 12 August 2028, or 24 months after the Commission’s implementing acts (due by 12 August 2026), whichever is later. Reusable-packaging labeling follows roughly six months after that.' }, { q: 'Can a QR code replace the printed PPWR label?', a: 'No — PPWR requires the physical label regardless. A QR code can carry additional detail like disposal instructions, but it is not a substitute for what has to be printed on the pack.' }] },
  { keyword: 'verifiable credential revocation bitstring status list', brand: 'authichain', schemaType: 'Service',
    lead: 'W3C’s Bitstring Status List reached full Recommendation status in 2025, giving Verifiable Credential issuers a standard way to revoke or suspend a record after it is signed — the exact gap AuthiChain’s protocol spec names as open until v0.2.',
    bullets: ['Bitstring Status List compresses revocation state for many credentials into one small, privacy-preserving bitstring a verifier checks alongside the signature', 'AuthiChain records are already W3C Verifiable Credentials 2.0 — adding credentialStatus is a spec extension, not a rewrite', 'Until v0.2 ships, a record signed by a since-compromised key stays cryptographically valid — documented in protocol/SPEC.md §8, not a footnote'],
    faqs: [{ q: 'Does AuthiChain support revocation today?', a: 'No. protocol/SPEC.md documents this as an open gap: a record signed with a since-compromised key still verifies as valid. Revocation via credentialStatus is planned for v0.2.' }, { q: 'What does Bitstring Status List actually do?', a: 'It lets a Verifiable Credential point to a status list a verifier checks to see if that specific credential was revoked or suspended, without the check itself revealing which credential is being looked up.' }] },
  { keyword: 'construction products digital product passport', brand: 'authichain', schemaType: 'Service',
    lead: 'The revised EU Construction Products Regulation (2024/3110) makes a digital product passport mandatory 18 months after the Commission adopts the delegated act under Article 75(1) — AuthiChain issues that record as a signed Verifiable Credential, the same model already used for battery and textile passports.',
    bullets: ['Performance, safety, and life-cycle data structured for the construction DPP system the pending delegated act will define', 'Records resolve as W3C Verifiable Credentials, so a specifier or building inspector verifies without an AuthiChain account', 'CPR keeps CE marking in place; the DPP runs alongside it and adds environmental-impact data the mark alone does not carry'],
    faqs: [{ q: 'When is the construction DPP mandatory?', a: 'CPR has applied in stages since 8 January 2026. The DPP duty itself starts 18 months after the Commission adopts the delegated act under Article 75(1) — that act had not been adopted as of this writing.' }, { q: 'Does the construction DPP replace CE marking?', a: 'No — CPR retains CE marking and requires the DPP in addition to it, covering data the mark does not include.' }] },
  { keyword: 'qr code phishing product packaging security', brand: 'authichain', schemaType: 'Service',
    lead: 'Quishing — QR codes cloned or altered to redirect a scan to a fake destination — is a documented, rising attack pattern in 2026, and a plain QR code has no way to prove what it points to is genuine; a signed AuthiChain record does.',
    bullets: ['Verification checks an Ed25519 signature against the record itself, not just that a URL resolves — a cloned code pointing to fabricated content fails the check', 'Offline verification means a scanner is not just trusting whichever server happens to answer at scan time', 'A signature proves who issued the record, not that the physical item in hand matches it — stated plainly in protocol/SPEC.md §8'],
    faqs: [{ q: 'Can a counterfeit copy an AuthiChain QR code and still pass?', a: 'The printed code can be copied, but reproducing a valid Ed25519 signature over fabricated content cannot — a cloned code pointing anywhere but the genuine record fails signature verification.' }, { q: 'Does this protect against quishing generally?', a: 'It stops a cloned code from passing as a genuine AuthiChain record. It does not secure QR codes outside this protocol — any code that is not signed is a separate risk a scanner has to judge on its own.' }] },
  { keyword: 'did key vs did web for verifiable credentials', brand: 'authichain', schemaType: 'Service',
    lead: 'A Verifiable Credential’s issuer identifier has to resolve to a public key somehow — did:key embeds the key directly in the identifier so no network lookup is needed, while did:web ties resolution to a domain you control, which is why AuthiChain’s protocol spec uses did:key by default.',
    bullets: ['did:key needs no DNS, hosting, or network call to resolve — the public key is the identifier, which is what makes offline verification possible at all', 'did:web ties portability to a domain: lose the domain and every credential issued under that method stops resolving', 'protocol/SPEC.md §5 step 2 resolves the issuer key from did:key with zero network access, matching the spec’s offline-verification requirement'],
    faqs: [{ q: 'Why not use did:web since we already control a domain?', a: 'You can — the spec does not forbid it. But did:web makes verification depend on your DNS and hosting staying reachable, which works against the goal of a verifier reaching a verdict without contacting anyone.' }, { q: 'Does did:key support key rotation?', a: 'Not on its own — a new key is a new identifier. That gap is part of what credentialStatus and revocation, planned for v0.2, are meant to address.' }] },

  // ── standards & regulatory deadlines, round 4 (2026 research) ─────
  { keyword: 'un transparency protocol vs w3c verifiable credentials', brand: 'authichain', schemaType: 'Service',
    lead: 'UN/CEFACT’s UN Transparency Protocol targets version 1.0 by 1 September 2026, defining a Digital Product Passport issued by the shipper — built on the same W3C Verifiable Credentials Data Model 2.0 that protocol/SPEC.md §2 already targets, not a competing wire format.',
    bullets: ['UNTP’s passport is a profile — a defined set of required fields and linked credential types — layered on VC Data Model 2.0, the same base specification this protocol already implements', 'A UNTP passport links out to separate conformity and traceability-event credentials rather than embedding everything in one document; a signed AuthiChain record can serve as one of those linked credentials without a format conversion', 'UNTP is a UN specification, not EU law — adopting it does not by itself satisfy ESPR, where each category’s delegated act remains the binding requirement'],
    faqs: [{ q: 'Does UNTP replace the EU Digital Product Passport requirement?', a: 'No — UNTP is a UN/CEFACT technical specification. It aims for alignment with ESPR, but a product still has to satisfy the delegated act for its own category regardless of which passport format sits underneath.' }, { q: 'Is AuthiChain compatible with UNTP?', a: 'The building blocks match — both use W3C Verifiable Credentials Data Model 2.0 and cryptographic signing. A formal conformance claim waits on UNTP 1.0 finalizing, targeted for 1 September 2026, and on its specific field and credential-linking requirements.' }] },
  { keyword: 'iso 18975 gs1 digital link resolver standard', brand: 'authichain', schemaType: 'Service',
    lead: 'ISO/IEC 18975:2024 formalizes GS1 Digital Link as an international standard for encoding identifiers into resolvable URLs — the same URL structure protocol/SPEC.md §2 specifies for item identity, now carrying an ISO number and not only a GS1 one.',
    bullets: ['A GS1 Digital Link URI conforms to ISO/IEC 18975 by construction, so an identifier already built to the GS1 standard needs no separate ISO encoding to maintain', 'The resolver layer is what turns one URL into several destinations selected by linkType — a signed record is one linkType a GS1-conformant resolver can point to, alongside a product page or a certificate', 'A record’s credentialSubject.id is the same GS1 Digital Link URL a warehouse scanner and a consumer’s phone both resolve — one identity, not a second identifier layered on top'],
    faqs: [{ q: 'Do we need to change our QR codes because of ISO/IEC 18975?', a: 'No — a QR code already encoding a GS1 Digital Link URL is already conformant. The standard formalizes the URI structure GS1 Digital Link already used; it does not introduce a new encoding requirement.' }, { q: 'What does a resolver add beyond the URL itself?', a: 'It lets one identifier point to multiple linked resources — a product page, a certificate, a traceability record — selected by linkType, instead of hard-coding a single destination into the printed code.' }] },
  { keyword: 'eu dpp registry customs verification at import', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU’s central Digital Product Passport Registry went live on 19 July 2026, and once a category’s delegated act applies, customs can check at the border whether a shipment’s passport is registered, matches the goods, and carries a consistent commodity code before those goods clear.',
    bullets: ['A record that resolves at a permanent, unauthenticated GS1 Digital Link URL is the shape a customs check queries — no portal login or vendor call sits in the path of a border inspection', 'The registry check is a match check: identifier registered, data present, commodity code consistent — it does not re-issue or re-assess the passport at the border', 'The registry opening on 19 July 2026 creates no obligation by itself; customs checks bite only once a product’s category has a delegated act in force, starting with batteries on 18 February 2027'],
    faqs: [{ q: 'Can customs reject a shipment for a missing DPP today?', a: 'Only for categories with an applicable delegated act in force. The registry opened 19 July 2026, but the first mandatory category — batteries — does not require a passport at the border until 18 February 2027.' }, { q: 'What does a customs DPP check actually verify?', a: 'That the declared identifier is registered, that it resolves to passport data matching the shipment, and that the commodity code supplied is consistent with what the passport declares — not the underlying sustainability claims themselves.' }] },
  { keyword: 'cirpass 2 reference architecture json-ld dpp', brand: 'authichain', schemaType: 'Service',
    lead: 'CIRPASS-2, the EU-funded project piloting Digital Product Passports across textiles, electronics, tyres, and construction, published its updated reference architecture on 10 June 2026 recommending JSON-LD as the default exchange format — which is what a W3C Verifiable Credential already is.',
    bullets: ['A Verifiable Credential is JSON-LD by construction: the @context field the recommendation asks for is already required in every record protocol/SPEC.md §3 defines', 'Modular, extensible passport templates across product groups match how credentialSubject already varies by category without changing the record’s outer structure or its signature mechanics', 'CIRPASS-2 is a pilot project’s technical recommendation, not a binding standard — the legal requirement stays whatever a category’s ESPR delegated act specifies once adopted'],
    faqs: [{ q: 'Is the CIRPASS-2 reference architecture legally binding?', a: 'No — it is a recommendation from an EU-funded pilot running through April 2027, intended to inform the Commission’s eventual technical implementing acts. Binding requirements are set separately by each category’s delegated act.' }, { q: 'Does the JSON-LD recommendation mean our records need reformatting?', a: 'Not if they are already W3C Verifiable Credentials — JSON-LD is the format VC Data Model 2.0 uses. The recommendation aligns with that base format rather than replacing it.' }] },
  { keyword: 'c2pa content credentials vs product provenance', brand: 'authichain', schemaType: 'Service',
    lead: 'C2PA Content Credentials reached version 2.3 in January 2026 and answer a question about a file — who captured this image, what edited it, was AI involved — while a product provenance record answers a question about a physical object, which is why the two are complements rather than alternatives.',
    bullets: ['C2PA binds a manifest to the bytes of a media file; a provenance record binds a signature to an item identifier that has no bytes to hash, so the binding to the physical object comes from the printed carrier, not from cryptography', 'Both are tamper-evident in the same way: alter the signed content and the signature stops matching — the difference is what the signature is over, not how strong it is', 'Neither proves the claim inside is true. C2PA proves a camera or tool signed a file; an Ed25519 provenance signature proves an issuer signed a statement — protocol/SPEC.md §8 states plainly that signatures prove authorship, not truth'],
    faqs: [{ q: 'Can C2PA authenticate a physical product?', a: 'Not on its own. C2PA is a media-provenance specification: its manifest is bound to a file’s bytes. A photograph of a product can carry Content Credentials proving how the photo was made, but that says nothing about whether the object in it is genuine.' }, { q: 'Would C2PA and a product provenance record be used together?', a: 'They can be. Product images and certificates attached to a passport are files, and C2PA can establish how those files were produced, while the signed provenance record establishes who issued the claim about the item itself.' }] },
  { keyword: 'cen cenelec digital product passport standards', brand: 'authichain', schemaType: 'Service',
    lead: 'CEN and CENELEC published the first six harmonised European standards for the Digital Product Passport — the EN 18216–18223 series — on 1 June 2026, covering digital identifiers, data carriers, and interoperable APIs; the building blocks this protocol already uses line up with what that series formalizes.',
    bullets: ['The series specifies APIs and system interoperability, not just the QR code — a record built as a W3C Verifiable Credential over a GS1 Digital Link identifier already matches that shape', 'EN 18220 covers the data carrier specifically; protocol/SPEC.md already requires GS1 Digital Link identity and an open, non-proprietary carrier format', 'A harmonised standard gives every manufacturer one spec to build against instead of guessing at each Member State’s implementation — the same reason this protocol publishes its own spec under Apache-2.0'],
    faqs: [{ q: 'What do the EN 18216–18223 standards cover?', a: 'Digital identifiers, data carriers, passport data architecture, APIs, cybersecurity, and interoperability between different DPP systems — the technical layer beneath the ESPR’s legal requirements.' }, { q: 'Does AuthiChain formally conform to these standards today?', a: 'The underlying building blocks — GS1 Digital Link identity, W3C Verifiable Credentials, an open data carrier — match what the series formalizes. A formal conformance claim waits on published test suites for each standard.' }] },
  { keyword: 'espr priority product list timeline', brand: 'authichain', schemaType: 'Service',
    lead: 'The European Commission’s first ESPR Working Plan (2025–2030) sequences Digital Product Passport delegated acts by product group — iron and steel targeted for 2026, textiles and apparel for 2027, furniture for 2028, then electronics, chemicals, construction products, and tyres from 2029 — so which category is asked to comply first is already public.',
    bullets: ['A delegated act’s adoption date, not the product’s market size, decides when a DPP becomes mandatory for that category — check the working plan itself, not general ESPR press coverage', 'AuthiChain already issues DPP records for six of these categories; the record format does not change when a category’s delegated act formally adopts, only the compliance deadline does', 'Sixteen energy-related product groups carried over from the old Ecodesign Directive run on a separate track alongside the new ESPR categories, not instead of them'],
    faqs: [{ q: 'Which product category is first?', a: 'Iron and steel, targeted for a 2026 delegated act, followed by textiles and apparel in 2027 and furniture in 2028.' }, { q: 'Does the working plan cover my product if it is not listed?', a: 'Not yet — the current plan runs through 2030 and lists specific priority groups. A product outside those groups has no DPP delegated act pending as of this writing.' }] },
  { keyword: 'nft certificate of authenticity vs verifiable credential', brand: 'authichain', schemaType: 'Service',
    lead: 'An NFT and a W3C Verifiable Credential both anchor a claim to a public ledger, but they answer different questions — an NFT proves who currently holds a token, while a Verifiable Credential proves who signed a specific, checkable statement — which is why AuthiChain issues both: one for resale ownership, one for provenance.',
    bullets: ['A Verifiable Credential’s signature is checkable against a fixed statement — reword it after signing and the signature breaks; an NFT’s metadata can point at content that changes after mint unless the token itself commits to a hash', 'Ownership and authorship are separate claims — a stolen or resold NFT changes who holds the token, not who issued the original provenance record', 'ERC-721 certificates on Polygon carry resale ownership; the provenance record underneath stays the same signed Verifiable Credential the new holder inherits, not a re-issued claim'],
    faqs: [{ q: 'Do I need both an NFT and a Verifiable Credential?', a: 'Only if you need transferable ownership as well as provenance. A Verifiable Credential alone proves authenticity; the NFT layer is what makes that authenticity travel cleanly through resale.' }, { q: 'Can a fake NFT impersonate a real certificate?', a: 'A screenshot or cloned image can be posted anywhere, but it will not correspond to a genuine mint at the item’s actual contract address — checking that address directly is the verification step, not trusting how a marketplace listing looks.' }] },
  { keyword: 'dscsa saleable returns verification requirement', brand: 'authichain', schemaType: 'Service',
    lead: 'DSCSA’s saleable-returns requirement took effect 27 August 2025 — a distributor must verify a returned drug package against its transaction history before it goes back into sellable inventory, not just confirm a serial number is present — and the FDA has already issued warning letters over exactly that gap.',
    bullets: ['Verification happens at receiving, checking the returned package’s history against what the distributor originally shipped — a signed record a scanner checks offline does that without a portal lookup', 'A verified record confirms the package matches what was issued; it does not replace the physical inspection a saleable-returns program still requires', 'The same unit-level serialization this protocol issues for DSCSA traceability is what a returns-verification check runs against — no separate data model for returns'],
    faqs: [{ q: 'When did the saleable-returns requirement take effect?', a: '27 August 2025. Verification at the point a returned package is determined saleable is an active FDA enforcement focus, with warning letters issued over failures to verify transaction history before accepting returns.' }, { q: 'Does electronic verification replace physical inspection of returns?', a: 'No — electronic verification confirms the package’s data matches what was shipped. Physical inspection for damage, tampering, or expiry stays a separate step.' }] },

  // ── standards & regulatory deadlines, round 5 (2026 research) ─────
  { keyword: 'fsma 204 food traceability rule blockchain', brand: 'authichain', schemaType: 'Service',
    lead: 'FSMA 204 compliance moved from January 2026 to July 20, 2028 under the Continuing Appropriations Act of 2026 — the deadline changed, not the requirement: covered entities still need Key Data Elements and Critical Tracking Events recorded for every shipment on the Food Traceability List.',
    bullets: ['Critical Tracking Events — harvesting, cooling, initial packing, shipping, receiving — captured as signed records instead of the spreadsheet an FDA traceback investigator has to chase down today', 'A Key Data Element record is Ed25519-signed and hashed to a public ledger, so a trading partner or investigator verifies it without calling AuthiChain', 'Records map to Food Traceability List categories — soft cheeses, shell eggs, fresh-cut fruits and vegetables, certain seafood, ready-to-eat deli salads — on the same record model, not a separate schema per category'],
    faqs: [{ q: 'When does FSMA 204 actually take effect?', a: 'July 20, 2028. The FDA delayed the original January 20, 2026 date by 30 months, and the Continuing Appropriations Act of 2026 directs the agency not to enforce before that date; the recordkeeping requirements themselves are unchanged.' }, { q: 'What foods are covered?', a: 'FDA’s Food Traceability List — specific high-risk foods including soft cheeses, shell eggs, nut butter, fresh-cut fruits and vegetables, certain fin fish and crustaceans, and ready-to-eat deli salads.' }] },
  { keyword: 'eu digital product passport aluminium', brand: 'authichain', schemaType: 'Service',
    lead: 'Aluminium is scheduled for its own ESPR delegated act in 2027, one year behind iron and steel — AuthiChain issues the same Digital Product Passport record model already built for steel, batteries, and textiles, structured for embodied-carbon and recycled-content reporting.',
    bullets: ['Embodied-carbon and scope 1–3 data captured per batch, matching the reporting shape already used for the steel passport', 'Recycled-content and alloy-grade declarations anchored on-chain for tamper-evidence', 'The record format does not change when the delegated act adopts — only the compliance deadline does, per the ESPR Working Plan’s roughly 18-month runway after adoption'],
    faqs: [{ q: 'When is the aluminium DPP mandatory?', a: 'No date yet — the ESPR Working Plan 2025–2030 targets a 2027 delegated act for aluminium, one year after iron and steel’s 2026 act. Mandatory compliance typically follows about 18 months after adoption.' }, { q: 'Can we start before the delegated act is finalized?', a: 'Yes — the record is a W3C Verifiable Credential; when the act adopts, its required fields slot into the same credentialSubject structure already used for steel and batteries.' }] },
  { keyword: 'post quantum verifiable credentials signing', brand: 'authichain', schemaType: 'Service',
    lead: 'NIST finalized three post-quantum signature standards — ML-DSA (FIPS 204), SLH-DSA (FIPS 205), and the key-encapsulation ML-KEM (FIPS 203) — and AuthiChain’s protocol spec states plainly, in SPEC.md §8, that its current Ed25519 suite is not one of them.',
    bullets: ['Ed25519 (RFC 8032) is what protocol/SPEC.md specifies today — fast, small signatures, and explicitly not post-quantum secure, the same kind of direct disclosure Section 8 makes about revocation', 'Records signed now and read years from now carry Store-Now-Decrypt-Later exposure if an adversary archives them for a future quantum break — a risk shared by any long-lived credential, not unique to this protocol', 'The record’s proof.type field names the signature suite per record, so a future ML-DSA or SLH-DSA suite is a new proof type, not a rewrite of every record already issued'],
    faqs: [{ q: 'Is Ed25519 quantum-resistant?', a: 'No. Ed25519 is elliptic-curve cryptography under FIPS 186-5 / RFC 8032 and falls to Shor’s algorithm on a sufficiently large quantum computer — the same limit stated in protocol/SPEC.md §8.' }, { q: 'Does AuthiChain support ML-DSA or SLH-DSA today?', a: 'No — the reference verifier implements Ed25519 only. NIST published FIPS 204 and FIPS 205 as post-quantum signature standards; adopting one is a spec extension the protocol has not shipped.' }] },
  { keyword: 'iso 22095 chain of custody blockchain', brand: 'authichain', schemaType: 'Service',
    lead: 'ISO 22095 defines five chain-of-custody models — identity preserved, segregated, controlled blending, mass balance, and book and claim — and a signed, per-unit AuthiChain record is a natural fit for the first two, not a substitute for the other three.',
    bullets: ['Each record ties a signature to one physical item’s identifier — the identity preserved and segregated models ISO 22095 defines, where a claim follows a specific batch rather than a pooled average', 'ISO published harmonized requirements for mass balance (22095-2) and book and claim (22095-3) in 2026 — models built on percentage accounting and certificate trading, not per-unit signatures', 'A verifier checks the signature and the anchor per record; it does not compute a mass-balance percentage or reconcile a certificate ledger, because that is a different model with different math'],
    faqs: [{ q: 'Does AuthiChain support mass balance claims?', a: 'Not directly. Mass balance and book and claim, per ISO 22095-2 and -3, account for a percentage or trade certificates across a pool of material. AuthiChain signs a record tied to one physical item, which maps to identity preserved or segregated chain of custody instead.' }, { q: 'Which ISO 22095 model should we use?', a: 'That is a supply-chain design decision, not a technology one — it depends on whether material stays physically separated (identity preserved/segregated) or gets blended (mass balance). Per-unit signing fits the former; it does not replace the accounting a mass-balance system requires.' }] },
  { keyword: 'seafood import monitoring program traceability', brand: 'authichain', schemaType: 'Service',
    lead: 'SIMP requires point-of-harvest-to-entry chain-of-custody data for more than 1,100 seafood species entering the US, and NOAA’s FY2026 funding directs the program specifically toward closing gaps its own action plan identified, including forced-labor risk.',
    bullets: ['Catch, landing, and custody events per shipment hashed and anchored, so a SIMP record survives a transfer between processors without a re-keyed paper trail', 'Signed records verify offline against the shipment’s identifier — a customs or NOAA reviewer does not need portal access to check what an importer submitted', 'Chain-of-custody events layer onto the same record model already used for DSCSA lot tracking and EUDR batch geolocation, not a separate schema per regulation'],
    faqs: [{ q: 'Does this replace SIMP reporting to NOAA?', a: 'No — SIMP submissions go through NOAA’s International Trade Data System. Anchoring makes the supporting chain-of-custody documentation tamper-evident; it does not change where or how the SIMP report itself gets filed.' }, { q: 'Which species does SIMP cover?', a: 'A risk-based list of more than 1,100 species. NOAA’s FY2026 action-plan funding is aimed at strengthening enforcement and traceability across that list, not narrowing it.' }] },

  // ── standards & regulatory deadlines, round 6 (2026 research) ─────
  { keyword: 'eu digital product passport toys', brand: 'authichain', schemaType: 'Service',
    lead: 'Regulation (EU) 2025/2509 requires a Digital Product Passport for every toy sold in the EU, replacing the paper Declaration of Conformity, mandatory from 1 August 2030 — AuthiChain issues that record as a signed Verifiable Credential, the same format already used for battery and textile passports.',
    bullets: ['The toy DPP’s technical format is not published yet — the Commission still owes implementing acts defining the QR code and required fields, so the record structure AuthiChain issues for other categories carries over directly once those specifics land', 'Safety and compliance data map to a signed W3C Verifiable Credential, letting a customs authority or retailer verify a toy without contacting the manufacturer', 'The regulation entered into force in December 2025 with the DPP mandate not landing until 1 August 2030 — years of runway to pilot a passport before it is required across a catalogue, not a deadline due tomorrow'],
    faqs: [{ q: 'Can I generate a toy DPP QR code today?', a: 'No — the Commission has not yet published the implementing acts defining the toy DPP’s technical format, and the mandate itself does not take effect until 1 August 2030.' }, { q: 'What does the toy DPP replace?', a: 'The paper EU Declaration of Conformity — the DPP becomes the digital record customs and market-surveillance authorities check instead.' }] },
  { keyword: 'digital product passport verified economic operator registration', brand: 'authichain', schemaType: 'Service',
    lead: 'Commission Implementing Regulation (EU) 2026/1778 took effect 6 August 2026 and applies to every DPP category at once: before a business can register a single passport, it has to complete an eIDAS identity check and become a “verified economic operator” in the EU’s central registry.',
    bullets: ['The registry itself opened 20 July 2026 with a public API, a separate testing environment, and technical documentation — a production system with a helpdesk, not a beta', 'Verified-operator status carries no product-category deadline of its own; it sits upstream of every delegated act, so a brand shipping batteries in 2027 or textiles later clears the same registration step first', 'AuthiChain issues each record as a W3C Verifiable Credential built to resolve at a permanent URL, matching the registry’s requirement that a passport stay retrievable without authentication'],
    faqs: [{ q: 'Do we need to register before our product category has a delegated act?', a: 'Yes, eventually — verified-operator registration has no category deadline of its own; it is a one-time identity step ahead of whichever delegated act applies to you first. Batteries, mandatory from 18 February 2027, is currently the earliest.' }, { q: 'What does the eIDAS check verify?', a: 'That the entity registering passports is who it claims to be, using the EU’s electronic identification framework. Implementing Regulation 2026/1778 sets the access-management and verification rules for it.' }] },
  { keyword: 'dscsa small dispenser compliance deadline 2026', brand: 'authichain', schemaType: 'Service',
    lead: 'Small dispensers — pharmacies with 25 or fewer full-time pharmacists or pharmacy technicians — have until 27 November 2026 before FDA enforcement discretion for DSCSA’s electronic, interoperable data-exchange requirements ends; the exemption FDA granted in June narrows to that one group and that one date.',
    bullets: ['Wholesale distributors have been under enforcement since 27 August 2025 and larger dispensers since 27 November 2025 — small dispensers are the last group still inside the grace window, not a general delay', 'FDA has stated the November 2026 date will not move again, so a record system that is not verifying transaction history electronically by then is the gap an inspection finds', 'The same Ed25519-signed, unit-level record AuthiChain issues for DSCSA traceability is what a small dispensary checks at receiving — no separate system for a 25-pharmacist pharmacy versus a hospital network'],
    faqs: [{ q: 'Does this exemption apply to my pharmacy?', a: 'Only to dispensers with 25 or fewer full-time employees licensed as pharmacists or qualified as pharmacy technicians. Larger dispensers have been under enforcement since 27 November 2025.' }, { q: 'Will FDA extend the November 2026 deadline again?', a: 'FDA has stated publicly there will be no further extensions to the stabilization period — 27 November 2026 is the date to plan against.' }] },
  { keyword: 'sd-jwt vs data integrity proof verifiable credentials', brand: 'authichain', schemaType: 'Service',
    lead: 'W3C’s VC-JOSE-COSE specification standardizes three ways to secure a Verifiable Credential — JOSE/JWS, SD-JWT, and COSE — and AuthiChain’s protocol spec uses none of them: it signs with a Data Integrity proof (Ed25519Signature2020) over JCS-canonicalized JSON instead.',
    bullets: ['SD-JWT adds selective disclosure — a holder reveals some claims and withholds others from the same signed credential — a feature a provenance record for a physical item does not need, because an item’s identity and history are not secrets to partially hide', 'A Data Integrity proof signs the record’s JSON structure directly; JOSE and COSE wrap the credential inside a JWT or CBOR envelope first — both are valid, W3C-conformant ways to secure the same VC Data Model 2.0 payload', 'protocol/SPEC.md §3.2 requires RFC 8785 (JCS) canonicalization specifically so two independent verifiers derive byte-identical input from the same record — a property any of the three securing mechanisms could satisfy, but only Data Integrity is what is actually implemented today'],
    faqs: [{ q: 'Is a Data Integrity proof less standard than SD-JWT?', a: 'No — both are W3C-defined ways to secure the same VC Data Model 2.0 credential. VC-JOSE-COSE and Data Integrity are parallel securing mechanisms, not a newer one replacing an older one.' }, { q: 'Does AuthiChain support SD-JWT credentials?', a: 'Not today — the reference verifier implements Ed25519 Data Integrity proofs only. Selective disclosure matters more for identity credentials than for a provenance record meant to be checked in full.' }] },
  { keyword: 'battery passport carbon footprint declaration delayed', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU battery passport’s 18 February 2027 deadline has not moved, but the carbon footprint methodology it depends on has: the delegated act needed to calculate and declare a battery’s carbon footprint was targeted for February 2025 and, as of this writing, is still in draft.',
    bullets: ['The passport’s other required fields — material composition, state-of-health, recycled content — do not wait on the carbon footprint methodology and can be structured into the signed record now', 'The methodology follows the Product Environmental Footprint approach under ISO 14067, so a record built to receive a PEF-style carbon figure does not need re-architecting once the delegated act lands — only the number changes', 'A delayed methodology delegated act does not delay the underlying implementing act for the declaration format either — both are still pending, and downstream deadlines move with them'],
    faqs: [{ q: 'Does the carbon footprint delay push back the February 2027 battery passport deadline?', a: 'Not on its own — 18 February 2027 remains the mandate date for the passport itself. The carbon footprint declaration is one required field inside it, and its methodology is what is delayed.' }, { q: 'What should we do while the methodology is still in draft?', a: 'Structure the passport record now with the fields that are settled — composition, state-of-health, recycled content — and add the carbon footprint figure once the delegated act specifies how to calculate it.' }] },

  // ── standards & regulatory deadlines, round 7 (2026 research) ─────
  { keyword: 'eu general product safety regulation traceability requirements', brand: 'authichain', schemaType: 'Service',
    lead: 'GPSR requires every product sold into the EU to carry a batch or serial number a shopper can actually see, and requires every economic operator in the chain to be able to say who supplied it and where it went next.',
    bullets: ['The GPSR batch or serial number requirement maps onto the same unit-level identifier a signed AuthiChain record already carries — no second numbering scheme to maintain', 'GPSR puts a records-retention duty on every economic operator in the chain, not just the manufacturer; a record any of them can verify offline removes the need for a shared database between suppliers, importers, and distributors', 'GPSR does not require blockchain or cryptographic signing — only that a product stays identifiable and traceable. A signed, anchored record is one way to make that identification tamper-evident, not the only way the regulation permits'],
    faqs: [{ q: 'Does GPSR require blockchain-based traceability?', a: 'No — Regulation (EU) 2023/988 requires products to be identifiable via batch or serial number and traceable through supply-chain records. It specifies no particular technology for meeting that duty.' }, { q: 'Who is responsible for traceability under GPSR?', a: 'Every economic operator in the chain — manufacturer, importer, and distributor — has to be able to identify who supplied a product to them and to whom they supplied it. The regulation has applied since 13 December 2024.' }] },
  { keyword: 'gs1 datamatrix point of care scanning requirements', brand: 'authichain', schemaType: 'Service',
    lead: 'Hospitals, pharmacies, and infusion centers scanning DSCSA-serialized units at the point of care need camera-based imaging scanners for GS1 DataMatrix — a laser scanner built for linear barcodes cannot read a 2D code at all, a hardware gap separate from the retail point-of-sale transition under GS1 Sunrise 2027.',
    bullets: ['GS1 DataMatrix is already the required data carrier for unit-level DSCSA serialization — the point-of-care scanning gap is a hardware question, not a new identifier format', 'Camera-based imaging scanners read both linear barcodes and GS1 DataMatrix; legacy laser scanners common in hospital pharmacies read neither the 2D format nor anything signed inside it', 'A signed AuthiChain record resolves from the same GS1 Digital Link identifier encoded in the DataMatrix, so a point-of-care scan carries cryptographic verification alongside serialization data — not a second code printed on the pack'],
    faqs: [{ q: 'Is this the same requirement as GS1 Sunrise 2027?', a: 'They share a data carrier but not a deadline or a setting. Sunrise 2027 targets retail point-of-sale scanning by the end of 2027; GS1 DataMatrix at the point of care is driven by DSCSA unit-level serialization, already in force for manufacturers since May 2025.' }, { q: 'Can our existing barcode scanners read GS1 DataMatrix?', a: 'Only if they are camera-based imaging scanners. A laser scanner built for linear (1D) barcodes cannot read a 2D DataMatrix code — this is a hardware replacement, not a software update.' }] },
  { keyword: 'did webvh vs did web verifiable credentials', brand: 'authichain', schemaType: 'Service',
    lead: 'did:webvh reached version 1.0 in 2026, adding a self-certifying identifier and a signed update history to plain did:web — solving the exact portability problem AuthiChain’s protocol spec sidesteps today by defaulting to did:key instead.',
    bullets: ['did:webvh lets a DID move to a new web location without breaking the chain of trust back to its original keys; did:web has no equivalent — change the domain and the identifier is simply gone', 'Neither did:web nor did:webvh is what protocol/SPEC.md specifies today: the spec resolves the issuer key from did:key with zero network access, a property did:webvh does not match, since it still requires an HTTPS lookup to resolve', 'did:webvh’s verifiable history is a real answer to key rotation, a gap did:key does not solve on its own — a new did:key is a new identifier, with no cryptographic link back to the old one'],
    faqs: [{ q: 'Does AuthiChain support did:webvh today?', a: 'No — the reference verifier resolves did:key only, per protocol/SPEC.md §5 step 2. did:webvh is a candidate for a future issuer-identity option, not something implemented today.' }, { q: 'Is did:webvh a replacement for did:web?', a: 'It is an extension. did:webvh uses the same DID-to-HTTPS resolution as did:web, then adds a self-certifying identifier and signed update history, addressing did:web’s two open problems — domain lock-in and no proof of what changed on rotation.' }] },
  { keyword: 'eu battery regulation due diligence report deadline', brand: 'authichain', schemaType: 'Service',
    lead: 'The EU Battery Regulation’s due diligence reporting deadline moved from 2025 to 18 August 2027 under Regulation (EU) 2025/1561 — a separate obligation and a separate date from the battery passport’s 18 February 2027 mandate, and the two get conflated constantly.',
    bullets: ['Regulation (EU) 2025/1561, in force since 31 July 2025, delays the Article 52 due diligence policy obligations to 18 August 2027 and moves the public reporting cycle from annual to every three years', 'The battery passport’s data — carbon footprint, state-of-health, material composition — and the Article 52 due diligence report are separate obligations under the same regulation, on separate timelines; a passport record does not by itself satisfy the due diligence duty', 'The Commission’s due diligence guidelines, originally due 18 February 2025, are now expected by 26 July 2026 — a battery manufacturer building a due diligence process today is building against guidance that has not shipped yet'],
    faqs: [{ q: 'Does the due diligence delay also push back the battery passport deadline?', a: 'No — 18 February 2027 remains the battery passport mandate. Only the separate Article 52 due diligence policy and reporting obligations moved to 18 August 2027 under Regulation (EU) 2025/1561.' }, { q: 'Does this delay apply to the whole Battery Regulation?', a: 'No — it applies specifically to Article 52 due diligence policy obligations. Other Battery Regulation duties, including the 18 February 2027 passport mandate, are unaffected.' }] },
  { keyword: 'scip database digital product passport substances of concern', brand: 'authichain', schemaType: 'Service',
    lead: 'Any article sold into the EU containing a Candidate List substance above 0.1% weight by weight has needed a SCIP notification to ECHA since 5 January 2021 — and the EU Digital Product Passport is built to carry that same substances-of-concern data rather than asking manufacturers to declare it twice.',
    bullets: ['SCIP notification is a Waste Framework Directive Article 9(1)(i) duty, separate from and older than the ESPR — a DPP record structured to carry SCIP-format substance declarations does not need a new data model when a category’s delegated act adopts', 'The 0.1% w/w threshold applies per article, not per shipment or per SKU family — a bill of materials with hundreds of components can mean hundreds of individual SCIP checks, not one blanket declaration', 'ECHA has reported ongoing technical delays in the SCIP dissemination process through 2026; a submitted notification is not void because publication is slow — the SCIP number issued at submission is what a DPP record should reference, not the dissemination status'],
    faqs: [{ q: 'Does a SCIP notification alone satisfy EU DPP hazardous-substance requirements?', a: 'Not necessarily — SCIP is a Waste Framework Directive obligation that predates the DPP. A DPP record can carry the same substance-of-concern data, but each product category’s delegated act sets what the passport itself must declare.' }, { q: 'What triggers a SCIP notification?', a: 'Any article placed on the EU market containing a Candidate List substance of very high concern above 0.1% weight by weight, per Article 9(1)(i) of the Waste Framework Directive, in effect since 5 January 2021.' }] },
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

// Preserve hand-authored seed pages, replace/append generated ones by slug.
const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const generated = DATA.map(buildEntry);
const genSlugs = new Set(generated.map((g) => g.slug));
const seeds = existing.filter((e) => !genSlugs.has(e.slug));
const merged = [...seeds, ...generated];

fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
console.log(`seeds preserved: ${seeds.length}`);
console.log(`generated pages: ${generated.length}`);
console.log(`total pages:     ${merged.length}`);
