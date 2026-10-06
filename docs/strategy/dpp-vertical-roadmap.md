# AuthiChain DPP vertical roadmap

**Updated:** 2026-09-30  
**Status:** implementation roadmap; regulatory dates are sourced below and must be rechecked before customer-facing compliance claims.

## Architecture decision

Build **one DPP kernel**, not a separate passport stack for every industry.

Every vertical uses the same primitives:

1. Stable product identity: GS1 Digital Link where applicable, with GTIN/serial or batch/model identifiers.
2. Product record: versioned JSON/JSON-LD payload with issuer, manufacturer, economic operator, lifecycle state and provenance.
3. Evidence graph: supplier documents, certificates, declarations, test reports and hashes.
4. Signed attestation: Ed25519/JWS with JWKS discovery.
5. Durable status: active/revoked/superseded/expired state resolved fail-closed.
6. Access tiers: public, authenticated/interested-party, regulator/notified-body, and restricted commercial data.
7. Resolver: human HTML plus machine-readable JSON; content negotiation stays stable.
8. Audit trail: immutable event history for creation, update, evidence acceptance, revocation and export.
9. Export adapters: vertical-specific schemas without duplicating the underlying identity/evidence model.
10. Metering: readiness assessment, workspace generation, passport publication and API verification can become separately metered products.

## Vertical sequence

### 1. Battery — highest urgency

**Legal anchor:** Regulation (EU) 2023/1542 Article 77 requires an electronic battery passport from **18 February 2027** for each LMT battery, each industrial battery above 2 kWh, and each EV battery placed on the market or put into service. Article 78 requires interoperability with other EU DPPs and role-based access. See EUR-Lex.

**Product:** Battery DPP workspace + passport resolver.

**Core data modules**
- battery model / individual battery identity
- manufacturer and economic operator
- chemistry, capacity, voltage, mass
- carbon-footprint and recycled-content evidence
- durability/performance and state-of-health lifecycle data
- responsible sourcing / raw-material evidence
- repair, reuse, repurposing and recycling information
- conformity/test documentation
- access policy per Annex XIII audience

**Existing repo assets to reuse**
- `workers/authichain-com/src/battery-passport-page.ts`
- battery gap calculator / Annex XIII mapping
- `dpp_readiness` offer
- signed attestation/JWKS
- GS1 resolver
- supplier evidence registry (#1431)

**Next implementation slice**
- bind battery passport records to the supplier-evidence registry
- create a battery-specific normalized schema and validation adapter
- implement public/interested-party/authority access policies
- produce machine-readable JSON and signed export
- add fixture battery with negative cases
- keep the readiness assessment separate from the legal passport itself

### 2. StrainChain — provenance passport, not an EU-ESPR claim

StrainChain should use the same DPP kernel but remain a **genetics/provenance passport** rather than claiming an ESPR DPP obligation.

**Identity layers**
- issuer/farm
- cultivar identity
- batch/lot
- individual physical unit where applicable
- CoA as evidence bridge

**Core data**
- lineage with evidence-backed edge status
- raw cannabinoid/terpene panel
- derived totals calculated at render time
- certificate hashes
- issuer signature
- prior-art timestamp / anchor
- revocation and replacement history
- export controlled by the breeder

**Guardrails**
- no inference of parentage from names alone
- no silently corrected CoA values
- no platform ownership of breeder genetics
- distinguish cultivar dossier from unit passport
- no medical, regulatory, or potency guarantee from provenance data

**Next implementation slice**
- connect existing genetics certificate reconciliation to durable evidence records
- hash/sign a canonical certificate set
- anchor the fingerprint using the existing seal/Polygon path
- expose `/passport/[id]` through the existing resolver
- add export + revoke flows

### 3. Textiles/apparel

The Commission lists textiles/apparel as a priority ESPR product group; the current Commission economic-operator page gives an indicative **2027** work-programme timeline. Inclusion in the working plan is not itself a mandatory DPP date; product-specific rules determine the final legal obligation.

**Passport modules**
- product/material identity
- fibre composition
- supplier/factory chain
- recycled content
- substances of concern
- durability/repairability
- environmental information where required
- care/repair/reuse information
- end-of-life/recycling route
- evidence provenance per claim

**Best first pilot:** apparel SKU with BOM + supplier evidence + material certificates + QR resolver.

### 4. Electronics / ICT

The Commission's current economic-operator page gives an indicative **2029** timeline for ICT products under the first ESPR working plan. Do not label electronics DPP as mandatory before the product-specific rules say so.

**Passport modules**
- model + serial
- BOM/component provenance
- critical materials
- recycled content
- repairability and spare parts
- firmware/software lifecycle
- warranty/service events
- battery linkage where present
- WEEE/end-of-life data
- supplier declarations and test evidence

**Differentiator:** link finished-device passport to component evidence without creating a second identity system.

### 5. Iron / steel and aluminium

The Commission's current timeline identifies iron/steel for 2026 and aluminium for 2027 as indicative working-plan milestones. Treat these as rulemaking milestones, not automatic DPP compliance dates.

**Passport modules**
- heat/lot identity
- mill/manufacturer
- recycled content
- origin and chain-of-custody evidence
- carbon/environmental footprint
- conformity/test certificates
- transformation events
- downstream product linkage

This vertical also fits the existing Made-in-America / origin evidence work.

### 6. Furniture / mattresses / tyres

The Commission's current indicative timeline is furniture 2028, mattresses 2029, and tyres 2027. Build these as configuration profiles on the same kernel rather than separate applications.

Common modules:
- identity
- materials/BOM
- supplier evidence
- durability
- repairability
- recycled content
- environmental data
- end-of-life route

### 7. Sector-specific DPPs outside the core ESPR sequence

Keep adapters for batteries, packaging, critical raw materials, toys, construction products, and detergents separate from the generic ESPR profile. The Commission explicitly notes that these can be governed by standalone EU legislation.

The adapter boundary is:

`sector rule -> required fields/access -> AuthiChain canonical record -> signed resolver/export`

Never encode a sector-specific legal threshold into the canonical identity model.

## Shared implementation backlog

**P0 — kernel**
- [ ] canonical DPP record schema
- [ ] product/version identity
- [ ] evidence graph linkage
- [ ] signed attestation
- [ ] durable status lookup
- [ ] resolver JSON/HTML contract
- [ ] audit events
- [ ] access-tier policy
- [ ] export/version negotiation

**P1 — battery**
- [ ] Annex XIII data-point adapter
- [ ] battery access tiers
- [ ] lifecycle/state-of-health event model
- [ ] battery fixtures and negative tests
- [ ] registry/export integration

**P1 — StrainChain**
- [ ] certificate evidence linkage
- [ ] canonical certificate hashing
- [ ] anchor + verification
- [ ] breeder-controlled export/revoke
- [ ] resolver passport route

**P2 — textiles**
- [ ] material/BOM adapter
- [ ] supplier evidence mapping
- [ ] recycled-content and substances evidence
- [ ] repair/circularity module

**P2 — electronics**
- [ ] component/BOM graph
- [ ] firmware/service events
- [ ] repairability/spares
- [ ] WEEE/end-of-life evidence

**P3 — metals / furniture / tyres / mattresses**
- [ ] profile definitions
- [ ] evidence mappings
- [ ] export fixtures
- [ ] product-specific ruleset adapters once legal acts mature

## Commercial packaging

Keep the commercial surface thin:

- **Free:** DPP readiness check.
- **$299:** AuthiChain workspace, self-serve activation, and 50 workspace generations.
- **Passport workspace:** publish signed passport records from verified evidence.
- **API:** machine verification / resolver / evidence lookup.
- **Enterprise:** supplier network, bulk ingestion, exports, audit packages and metered verification.

StrainChain remains a separate provenance SKU. Battery and ESPR verticals can share the DPP workspace without sharing customer-facing branding.

## Regulatory-source rule

Customer-facing dates must be sourced from current Commission/EUR-Lex material. A working-plan year is an implementation target, **not** a legal compliance date. Only a product-specific adopted act/regulation should be rendered as a mandatory deadline.

## Immediate execution order

1. Finish #1431 supplier evidence vertical slice.
2. Add the canonical DPP record/evidence linkage without creating a second status system.
3. Build the battery adapter against the existing gap-map and signed-attestation infrastructure.
4. Build StrainChain certificate-to-passport linkage.
5. Add textiles/electronics profile fixtures.
6. Add metals/furniture/tyres/mattresses as configuration profiles.
7. Add regulatory-change detection so profile status can move from expected to law without hand-editing product logic.
