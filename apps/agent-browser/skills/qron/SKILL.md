---
name: qron
description: QRON code generation, batch management, and consumer scan orchestration for the AuthiChain Authentic Economy. Use when generating QRON codes for a brand, creating product batches, orchestrating consumer scan flows, minting rewards, managing QR code redemption, or integrating QRON into Shopify or POS systems. Triggers include "generate QRON codes", "create a batch", "set up QR codes for my products", "QRON batch generation", "consumer scan flow", "mint rewards", "Shopify QRON integration", or any task involving QRON code creation or management.
---

# QRON — Authentic Economy Code System

QRON is the physical-digital bridge of the AuthiChain Authentic Economy.
Every QRON code is a signed, blockchain-anchored gateway from a physical product
to a digital truth — carrying the product's full provenance, enabling consumer
verification, and minting rewards on every scan.

## What QRON Is

QRON codes are not just QR codes. They are:
- **Cryptographically signed** — Each code carries an ECDSA-256 signature over the product payload
- **Blockchain anchored** — The batch manifest is anchored to a public chain (Polygon/Hedera)
- **Time-bounded** — Expiry timestamps prevent code recycling and replay attacks
- **Reward-enabled** — Every consumer scan mints QRON points tied to the consumer's wallet
- **AI-enriched** — Each scan triggers AI story generation about the product's origin

## Core Workflows

### Workflow 1: Brand Onboarding & Batch Generation

```
Brand enters product info → System generates batch → QRON codes created →
PDF sheet downloaded → Codes applied to packaging → Products ship
```

Actions:
1. **Navigate** to the QRON generator (`/qron/generate` or brand dashboard)
2. **Fill** brand name, product name, batch size, description fields
3. **Submit** → system generates signed QRON payloads
4. **Extract** the download link for the PDF code sheet
5. **Done** — batch created, codes ready for printing

### Workflow 2: Consumer Scan & Verification

```
Consumer scans QRON → QRON URL resolves → Authenticity checked →
Story generated → Rewards minted → Result displayed
```

Actions:
1. **Navigate** to the QRON URL (`/verify/<encoded-payload>`)
2. **Snapshot** to map verification result, story section, reward display
3. **Extract** verdict, confidence, brand name, product story
4. **Screenshot** for visual confirmation of authenticity badge
5. **Done** — structured verdict with reward confirmation

### Workflow 3: Shopify Integration

```
Merchant installs QRON app → Selects products → Codes generated →
Metafields updated → QR codes shown on product pages
```

Actions:
1. **Navigate** to Shopify admin (`/admin/apps/qron`)
2. **Click** "Generate QRON Codes" button
3. **Extract** batch ID and generated code count
4. **Navigate** to product page to verify metafield update
5. **Done** — Shopify products now carry QRON authentication

## QRON Payload Structure

```json
{
  "v": "1",
  "productId": "brand-slug/sku-identifier",
  "batchId": "batch-20260304-001",
  "brand": "Brand Name",
  "name": "Product Name",
  "packagedAt": "2026-03-04T00:00:00Z",
  "expiresAt": "2027-03-04T00:00:00Z",
  "anchorTx": "0x...",
  "issuer": "did:web:authichain.com",
  "signature": "base64url..."
}
```

The payload is base64url-encoded and embedded in the QR code URL:
```
https://verify.authichain.com/q/<base64url-payload>
```

## Batch Generation Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `brand` | Yes | Brand name (max 64 chars) |
| `productName` | Yes | Product display name |
| `sku` | Yes | Internal SKU identifier |
| `batchSize` | Yes | Number of QRON codes to generate (1–10,000) |
| `description` | No | Product description for AI story seed |
| `expiresInDays` | No | Default 365 days |
| `vertical` | No | `strainchain` for cannabis, `default` otherwise |
| `webhookUrl` | No | Receive POST when batch is sealed on-chain |

## Reward System

Every consumer scan mints QRON points to the scanner's account:

| Action | Points |
|--------|--------|
| First scan of a batch code | 100 |
| Re-scan (loyalty) | 10 |
| Social share after scan | 25 |
| Scan streak (7 days) | 500 bonus |
| Counterfeit report confirmed | 1,000 |

Points are stored in Supabase (`rewards` table) and displayed on the consumer scan page.
Future: migrate to on-chain $QRON token when tokenomics launch.

## Counterfeit Alert System

When a QRON scan detects tampering:
1. Verdict `tampered` triggers an alert
2. Alert is logged in the brand's dashboard (`counterfeit_alerts` table)
3. Geolocation of scan is recorded
4. Brand is notified via webhook
5. Consumer sees: "⚠️ This product may be counterfeit. Please report to the retailer."

## Rules

- Never generate codes without a valid brand signature — unsigned codes are invalid by design
- Always anchor each batch on-chain before codes are distributed — anchoring is non-optional
- Expiry must be set — eternal codes undermine the system's time-bounded trust model
- Consumer scan page must show the AI-generated story — this is the engagement moment
- Every verdict must include a canonical AuthiChain trust score
