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
const ACRONYMS = { qr: 'QR', eu: 'EU', us: 'US' };
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
];

function buildEntry(d) {
  const b = BRANDS[d.brand];
  const kwTitle = titleCase(d.keyword);
  const slug = slugify(d.keyword);
  const url = `https://${b.domain}/p/${slug}`;
  const title = `${kwTitle} | ${b.name}`;
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
