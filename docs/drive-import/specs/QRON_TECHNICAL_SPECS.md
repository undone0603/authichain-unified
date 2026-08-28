# QRON Anti-Counterfeit Platform: Technical Specifications

Document Version: 1.0  
Date: February 14, 2026  
Author: QRON Development Team

Source: Google Drive document `1_H9E403vS9lSqHbHFsPFUafyViN9yet6MDTl6tmoNPU`

## 1. SKU Database Schema (Supabase/PostgreSQL)

Table: `skus`

- id: uuid (primary key, default: gen_random_uuid())
- brand_id: uuid (foreign key to brands.id)
- canonical_id: text (brand's internal SKU/product ID)
- category: text (e.g., 'Luxury Fashion', 'Pharmaceuticals')
- first_seen_year: integer
- known_channels: text[] (array of official retailers/regions)
- historical_incidents: integer (count of known fakes/recalls)
- historical_confidence_score: float (0-100 base risk)
- metadata: jsonb
- created_at: timestamptz (default: now())

```sql
CREATE TABLE skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id),
    canonical_id TEXT NOT NULL,
    category TEXT,
    first_seen_year INTEGER,
    known_channels TEXT[],
    historical_incidents INTEGER DEFAULT 0,
    historical_confidence_score FLOAT DEFAULT 100,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_skus_brand_id ON skus(brand_id);
CREATE INDEX idx_skus_canonical_id ON skus(canonical_id);
```

## 2. Truth Claims API Specification

Endpoint: `POST /v1/truth-claims`  
Description: Allows users to submit crowd-verification data for a specific product scan.

Request body:

```json
{
    "scan_id": "uuid",
    "sku_id": "uuid",
    "user_id": "uuid",
    "claim_type": "enum ('authentic', 'suspicious', 'confirmed_fake')",
    "details": {
        "retailer": "text",
        "price_paid": "float",
        "condition": "enum ('new', 'used', 'refurbished')",
        "packaging_integrity": "integer (1-5)",
        "comments": "text"
    },
    "photos": ["url_1", "url_2"]
}
```

Response (201 Created):

```json
{
    "claim_id": "uuid",
    "status": "pending_consensus",
    "potential_reward": "float (QRON)"
}
```

## 3. Reward Formula Implementation (Node.js/TypeScript)

```ts
function calculateReward(
    baseReward: number,
    isHighRiskSku: boolean,
    isEarlyDetection: boolean,
    userReputation: number
): number {
    const rarityMultiplier = isHighRiskSku ? 2.5 : 1.0;
    const earlyDetectionBonus = isEarlyDetection ? 5.0 : 0;

    // Reward = (Base * Multiplier * Reputation) + EarlyBonus
    let finalReward = (baseReward * rarityMultiplier * (userReputation / 100)) + earlyDetectionBonus;

    return Math.round(finalReward * 100) / 100;
}
```

---

## REPORT: The $4.5T Shadow Economy: Reclaiming Trust with QRON & AuthiChain

### 1. EXECUTIVE SUMMARY

The global trade in counterfeit and pirated goods is estimated to be between $1.7 trillion and $4.5 trillion USD annually. This "fake economy" is now comparable to a top-10 global economy, siphoning revenue from legitimate brands, endangering consumer safety, and funding organized crime. QRON, in partnership with AuthiChain, introduces "Proof-of-Origin Rails"—a cryptographic protocol designed to compress counterfeit margins to zero by hashing historical product data and incentivizing crowd-sourced truth verification.

### 2. THE ANATOMY OF THE PROBLEM

Historically, counterfeits cluster in high-growth, low-friction environments:

- Online Marketplaces: E-commerce scales faster than regulation, allowing fakes to proliferate in "gray markets."
- Fragmented Supply Chains: Lack of end-to-end visibility creates entry points for illicit goods.
- Information Asymmetry: Consumers lack the tools to verify authenticity at the point of sale.

Key affected sectors include Luxury Fashion, Pharmaceuticals (where fakes are life-threatening), Consumer Electronics, and Industrial/Auto parts.

### 3. THE SOLUTION: PROOF-OF-ORIGIN RAILS

QRON solves the trust gap by bridging compliance-grade ledgers with consumer-facing cryptographic art:

- AuthiChain (The Ledger): A tamper-evident record of every issued product identity, batch event, and revocation.
- QRON Seals (The Interface): Invisible or branded QR art encoding ES256-signed tokens, verifiable in milliseconds via standard smartphones.
- Hashing the Past: By importing historical SKU data, we create a "truth graph" that identifies anomalous scan patterns and flags high-risk batches before they reach the consumer.

### 4. THE TRUTH NETWORK: INCENTIVIZED VERIFICATION

We transform every consumer into a "truth fighter" through the $QRON reward ecosystem. By scanning products and submitting truth claims, users help map the global counterfeit landscape in real-time.

- Reputation-Based Rewards: High-accuracy verifiers earn greater QRON rewards.
- Brand Protection: Brands receive instant anomaly alerts and geographic heatmaps of counterfeit activity.

### 5. CONCLUSION

The $4.5T counterfeit crisis is not just a loss of revenue; it is a loss of truth. QRON provides the rails for a new era of transparency, where authenticity is a verifiable cryptographic fact.
