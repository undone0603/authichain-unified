# Competitor Research Report

**Research date:** 2026-08-24  
**Niche:** Blockchain-backed product authentication, provenance, and Digital Product Passports (DPPs)  
**Target market assumption:** Global enterprise manufacturers and regulated supply chains, with emphasis on pharma, luxury, food/beverage, and industrial goods.

## Executive summary

AuthiChain sits at the intersection of three markets:

1. **Product authentication and anti-counterfeiting** — closest comparisons: Scantrust and Authena.
2. **Digital Product Passport and supply-chain data infrastructure** — closest comparisons: Spherity, Circularise, and Avery Dennison atma.io/ReadyDPP.
3. **Vertical blockchain networks and industry platforms** — relevant alternatives: Chronicled/MediLedger in pharma and VeChain for broader blockchain deployments.

The competitive pattern is clear: larger vendors sell enterprise programs, integrations, and implementation services, while public pricing is uncommon. Scantrust is the notable exception with self-serve Pro pricing reported by third-party comparison sites. AuthiChain’s visible opportunity is a more accessible, API-first product that combines QR verification, certificates, provenance events, blockchain anchoring, and operational automation in one platform.

## Phase 1 — Discovery

### Direct competitors

- **Scantrust** — secure QR codes, anti-counterfeiting, traceability, DPPs, dynamic content, and analytics.
- **Authena** — unit-level product authenticity, IoT/NFC/QR identifiers, blockchain-backed DPPs, and supply-chain monitoring.

### Adjacent competitors

- **Spherity VERA** — verifiable product data and DPP management, with strong decentralized-identity and compliance positioning.
- **Circularise** — supplier-data collection, mass-balance/chain-of-custody traceability, and permissioned DPP disclosures.
- **Avery Dennison atma.io / ReadyDPP** — connected-product cloud and full-service DPP offering, backed by a major labeling/RFID company.

### Vertical/platform alternatives

- **Chronicled / MediLedger** — pharma network focused on DSCSA-related interoperability, contract communication, chargebacks, and trading-partner alignment.
- **VeChain** — blockchain ecosystem and enterprise application platform; a platform-level alternative rather than a narrowly comparable SaaS product.

## Phase 2 — Structured comparison

| Competitor | Primary buyer/use case | Publicly evidenced features | Positioning | Pricing evidence |
|---|---|---|---|---|
| **Scantrust** | Global brands, packaging, anti-counterfeit, compliance, traceability | Secure and standard QR codes; QR campaign management; dynamic redirects and landing pages; authentication without a special app; supply-chain workflow apps; analytics; GS1 Digital Link readiness; DPP and EU wine labels | “All-in-one QR code solution” for brands that need customer engagement, compliance, counterfeit detection, and traceability | **Medium confidence:** third-party comparison pages report Scantrust Pro at about $250/month for 50 QR codes and Pro Plus at about $650/month for 100. Enterprise appears sales-led. Verify directly before using commercially. |
| **Authena** | Pharma, luxury, cosmetics, food/beverage; unit-level authentication and traceability | Blockchain-protected product identity; QR/barcode/NFC identifiers; DPP landing pages; authenticity and sustainability data; IoT sensors, geo-location, tags and seals; producer dashboard; live alerts and analytics; consumer app/NFC interaction | “Gateway-free, unit-level traceability for regulated supply chains” | **High confidence:** no public product price found; sales/demo-led. |
| **Spherity VERA** | Global manufacturers needing DPP compliance and verifiable product data | Create, manage, and share verifiable DPP data; web-based VERA Studio; decentralized identity/verifiable credentials; white-label/customizable DPP examples; battery/passport and regulated-sector use cases | Digital identity and trusted data infrastructure for compliance and circularity | **Medium confidence:** public search results did not expose official pricing; comparison sites describe other DPP vendors’ transparent tiers, but do not establish VERA’s price. Treat as quote-based until confirmed. |
| **Circularise** | Manufacturers and complex multi-tier supply chains, especially batteries, chemicals, automotive, and materials | Collect n-tier supplier declarations/evidence; trace mass balance and chain of custody; share permissioned DPP disclosures tied to identifiers/QR; regulation-specific use cases including battery, CRM, ESPR, Euro 7, ELV, and ISCC | “Supply chain traceability software for faster compliance” | **High confidence:** pricing page exists, but no amount was exposed in the retrieved public content; appears contact/sales-led. |
| **Avery Dennison atma.io / ReadyDPP** | Apparel and product brands needing connected IDs, labels, and DPP service | Connected product cloud; unique digital IDs; integrated full-service DPP creation and management; certificate management; analytics; DPP-as-a-Service; label/RFID ecosystem | Enterprise DPP readiness with reduced implementation complexity and physical-product connectivity | **High confidence:** no public SaaS price found; likely enterprise quote plus physical-label/service costs. |
| **Chronicled / MediLedger** | Pharma manufacturers, wholesalers, GPOs, health systems, and medical-surgical buyers | Permissioned blockchain network; real-time contract pricing and eligibility alignment; customer master data; contract communication; chargeback claims/adjudication; GPO roster management; industry-specific network effects | Pharma business-rule automation, revenue protection, and trading-partner alignment | **Medium confidence:** third-party software listing says annual subscription pricing is not disclosed and requires a direct quote. Official site is demo-led. |
| **VeChain** | Enterprises and developers seeking a blockchain ecosystem for sustainability, supply chain, and real-world applications | Public blockchain ecosystem; wallets, apps, developer tools, grants/support; enterprise-oriented trust layer; historical supply-chain/product-authentication use cases; VET/VTHO network model | Broad blockchain infrastructure and ecosystem rather than a single DPP/authentication SaaS package | **High confidence:** no comparable SaaS list price found; network costs and implementation costs vary by application. |

### Feature matrix

Legend: **Yes** = explicitly evidenced on the reviewed material; **Partial** = adjacent or dependent on implementation; **Unknown** = not established from public evidence.

| Capability | AuthiChain codebase | Scantrust | Authena | Spherity | Circularise | atma.io/ReadyDPP | MediLedger | VeChain |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| QR-linked verification | Yes | Yes | Partial | Partial | Yes | Yes | Partial | Partial |
| NFC support | Partial | Unknown | Yes | Partial | Unknown | Partial | Unknown | Partial |
| Product authentication / anti-counterfeit | Yes | Yes | Yes | Partial | Partial | Partial | Partial | Partial |
| Digital Product Passports | Yes | Yes | Yes | Yes | Yes | Yes | Partial | Partial |
| Multi-tier supply-chain traceability | Yes | Yes | Yes | Yes | Yes | Yes | Pharma-focused | Partial |
| Sustainability / compliance data | Yes | Yes | Yes | Yes | Yes | Yes | Pharma-focused | Yes |
| Blockchain anchoring or verification | Yes | Partner/integration | Yes | Identity/blockchain-oriented | Blockchain-oriented | Unknown from reviewed page | Permissioned blockchain | Native blockchain |
| Consumer-facing experience | Yes | Yes | Yes | Yes | Yes | Partial | No/limited | Partial |
| API/integration orientation | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Public self-serve pricing | Project plan visible in repo | Reported for Pro tiers | No evidence found | No evidence found | No amount found | No evidence found | No evidence found | No comparable price |

## Positioning analysis

### Scantrust: strongest QR and packaging competitor

Scantrust is closest when the buying trigger is “put a secure, trackable QR code on products quickly.” Its advantages are mature QR workflows, no-special-app authentication, packaging/printing relationships, GS1 readiness, and broad brand references. Its likely weakness relative to AuthiChain is that blockchain is not the center of the story; the product is primarily a secure QR, content, and traceability platform.

### Authena: strongest feature-level overlap

Authena overlaps heavily with AuthiChain’s intended narrative: product identity, anti-counterfeiting, DPP, blockchain, consumer verification, and regulated industries. Its differentiation is hardware/IoT depth, NFC and seals, real-time condition monitoring, and a strong luxury/pharma/food focus. AuthiChain should avoid competing on “blockchain” alone and instead emphasize faster onboarding, simpler API access, transparent entry pricing, and operational automation.

### Spherity: strongest identity/compliance competitor

Spherity frames the problem around verifiable data and digital identity. It is a serious competitor for buyers who prioritize credentials, trust frameworks, and EU compliance architecture over consumer marketing. AuthiChain can differentiate with a more visible end-user verification journey and packaged QR/certificate workflows, while treating verifiable credentials and GS1 interoperability as roadmap or partnership areas.

### Circularise: strongest deep supply-chain data competitor

Circularise is strongest where the hard problem is collecting evidence from many supplier tiers, preserving confidentiality, tracing mass balance, and producing audit-ready disclosures. AuthiChain’s opportunity is to lead with product-level identity and verification, then add deeper supplier-data workflows for customers who need them.

### Avery Dennison atma.io: strongest physical-label distribution competitor

Avery Dennison combines software with the physical labeling/RFID layer. This creates distribution and implementation advantages that a software-only startup will not easily match. AuthiChain should position as label-agnostic and integration-friendly, allowing customers to keep their existing printers, tags, and ERP systems.

### Chronicled/MediLedger: strongest pharma-network benchmark

MediLedger wins through industry participation and a specific pharma business process: trusted alignment among manufacturers, wholesalers, GPOs, and health systems. It is not a direct replacement for a consumer-facing authenticity passport. AuthiChain should treat it as a potential integration or ecosystem benchmark rather than claim to replace it in pharma settlement and chargeback workflows.

### VeChain: strongest blockchain-platform alternative

VeChain provides broad infrastructure and ecosystem reach, but customers generally need an application layer, implementation partner, or custom development. AuthiChain can sell the finished workflow—product registration, QR verification, certificates, dashboards, APIs, and operational automation—rather than asking customers to assemble a blockchain application themselves.

## Report: opportunities for AuthiChain

1. **Own the accessible enterprise entry point.** Publicly communicate a small pilot or starter plan while competitors mostly require a demo.
2. **Make the product-layer workflow obvious.** Show: register product → issue certificate → print/link QR → verify → log scan → anchor proof → export audit record.
3. **Stay chain-agnostic in the customer promise.** Blockchain should support integrity, not become the only buying reason.
4. **Lead with interoperability.** Emphasize APIs, GS1 Digital Link, existing label/ERP systems, and exports to compliance systems.
5. **Package vertical pilots.** Create separate offers for pharma DSCSA readiness, luxury authentication, and EU DPP/supply-chain compliance.
6. **Use automation as a differentiator.** The repository contains AgentZ workflows, scheduled jobs, webhook handlers, CRM integrations, and resilience patterns that can support a more operational product than a simple QR verification page.
7. **Be precise about claims.** A blockchain record proves that a particular record was anchored; it does not independently prove that every upstream data claim is true. Competitor messaging should be evaluated on this distinction.

## Research limitations

- Most enterprise vendors do not publish full pricing, implementation fees, volume tiers, or contract minimums.
- Search and public pages establish vendor claims, not independent product validation.
- Feature cells marked “Partial” or “Unknown” require demos, documentation, or technical trials before being used in a sales battlecard.
- This is a first-pass market scan, not a legal, security, or procurement assessment.

## Sources

- [Scantrust](https://www.scantrust.com/) — product scope, secure QR, traceability, DPP, GS1, and Pro references.
- [Scantrust pricing signal via MyProductPassport comparison](https://myproductpassport.eu/compare/scantrust) — reported Pro/Pro Plus amounts; third-party source.
- [Authena](https://authena.io/) — industries, authentication, IoT, dashboards, and product scope.
- [Authena DPP](https://authena.io/dpp-digital-product-passport/) — blockchain-protected identity, QR/barcode/NFC, DPP and sustainability data.
- [Spherity](https://www.spherity.com/) — digital identity and business trust positioning.
- [Spherity VERA search result](https://www.spherity.com/digital-product-passport) — VERA DPP description.
- [Circularise](https://circularise.com/) — Collect, Trace, Share modules and regulation-specific use cases.
- [Avery Dennison ReadyDPP](https://www.averydennison.com/na/en/industries/apparel/solutions/supply-chain-solutions/digital-product-passport) — full-service DPP positioning.
- [atma.io DPP](https://www.atma.io/digital-product-passport) — ReadyDPP and connected-product context.
- [Chronicled / MediLedger](https://www.chronicled.com/) — pharma network, contract communication, and chargeback capabilities.
- [VeChain](https://vechain.org/) — current ecosystem and enterprise blockchain positioning.
