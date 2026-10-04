# StrainChain (strainchain.io) — Economy Map

_Generated: 2026-04-07 | Source: Stripe Live + Codebase Audit_

---

## 1. SUBSCRIPTION TIERS

| Tier             | Monthly | Scans/mo  | Brands    | Features                                     |
| ---------------- | ------- | --------- | --------- | -------------------------------------------- |
| **Basic**        | $199/mo | 500       | 1         | NFT minting, basic analytics, email support  |
| **Professional** | $499/mo | 2,500     | 5         | NFT trading, compliance reports, API access  |
| **Enterprise**   | $999/mo | Unlimited | Unlimited | White-label, custom reporting, SLA guarantee |

---

## 2. ADD-ONS & PARTNERSHIPS

| Product                    | Price   | Description                                 |
| -------------------------- | ------- | ------------------------------------------- |
| Dispensary Partnership     | $299/mo | Consumer-facing blockchain provenance layer |
| Bitcoin Strain Certificate | $49     | Ordinal inscription for strain batch        |

---

## 3. CANNABIS-SPECIFIC FEATURES

### Compliance Integration

- **Metrc** seed-to-sale tracking compatibility
- **BioTrack** compliance layer
- Not a replacement — works alongside existing compliance systems
- Adds consumer trust and brand differentiation

### Lab Results Verification

- THC/CBD potency verification on blockchain
- Terpene profile authentication
- Pesticide/mycotoxin clearance certificates
- Blockchain-anchored lab result QR codes

### Strain Provenance

- Cultivation facility tracking
- Processing/extraction events
- Batch certificate generation
- Consumer scan reveals: strain origin, lab results, Bitcoin-anchored batch certificate

### Industry Workflow (from lib/industries.ts)

1. **Cultivation** — Growing and monitoring
2. **Processing** — Extraction and preparation
3. **Testing** — Lab analysis and certification
4. **Distribution** — Licensed transport and logistics
5. **Retail** — Dispensary sale with consumer verification

---

## 4. TARGET MARKET

### Primary Verticals

- Licensed dispensaries (recreational + medical)
- Cannabis cultivators and processors
- Multi-state operators (MSOs)
- Cannabis brands seeking differentiation

### Outreach Pipeline

- Michigan dispensary outreach campaign (app/outreach/michigan-dispensaries/)
- Automated drip sequences via outreach system
- CRM integration for dispensary leads

### Market Size

- US cannabis market: **$40B** (from lib/industries.ts)
- Authentication TAM: ~$4B (10% of market)

---

## 5. QRON TOKEN INTEGRATION

StrainChain shares the AuthiChain QRON token economy:

| Event                 | QRON Flow                               |
| --------------------- | --------------------------------------- |
| Consumer product scan | 0.05 QRON fee (staking discounts apply) |
| Fee split             | 40% stakers, 40% treasury, 20% burn     |
| Staking tiers         | Same bronze/silver/gold/platinum ladder |

Dispensaries can stake QRON to reduce per-scan costs:

- **Bronze** (1,000 QRON / $49) → 10% discount
- **Silver** (10,000 / $349) → 25% discount
- **Gold** (100,000 / $2,499) → 40% discount
- **Platinum** (1M / $14,999) → 60% discount

---

## 6. BLOCKCHAIN LAYER

- **Polygon NFT** — ERC-721 certificates via AuthiChainNFT contract
- **Bitcoin Ordinal** — Permanent L1 inscription for premium batches
- **Dual-chain proof** — Both layers for enterprise customers
- Contract: `0xc3143254997d48fdc9983d618fb2e10067673eb5`

---

## 7. CROSS-PLATFORM CONNECTIONS

| Connection          | Detail                                     |
| ------------------- | ------------------------------------------ |
| AuthiChain contract | Shared NFT certificate contract on Polygon |
| QRON token          | Shared per-scan fee economy                |
| StoryMode           | Strain origin stories via HeyGen pipeline  |
| QRON Art            | AI QR codes for dispensary product labels  |
| Fee Flows           | Shared fee_flows ledger                    |
| Staking             | Same QRON staking tier system              |

---

## 8. REVENUE STREAMS

| Stream                      | Model        | Range                 |
| --------------------------- | ------------ | --------------------- |
| Dispensary Subscriptions    | Recurring    | $199 - $999/mo        |
| Dispensary Partnerships     | Recurring    | $299/mo               |
| Bitcoin Strain Certificates | One-time     | $49                   |
| Per-Scan Fees               | Usage (QRON) | 0.02 - 0.05 QRON/scan |
| QRON Staking Bundles        | One-time     | $49 - $14,999         |
