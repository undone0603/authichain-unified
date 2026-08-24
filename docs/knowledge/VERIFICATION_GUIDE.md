# AuthiChain Verification Guide

## How Product Verification Works

AuthiChain uses a **5-Agent AI Consensus Protocol** to verify physical products. Each product scan triggers parallel analysis by five specialized agents:

### The Five Agents

| Agent | Weight | What It Does |
|-------|--------|--------------|
| **Guardian** | 35% | Cryptographic hash validation, anti-counterfeit pattern detection |
| **Archivist** | 20% | Provenance history lookup, SKU truth graph traversal |
| **Sentinel** | 25% | Anomaly detection, geographic clustering analysis |
| **Scout** | 8% | Product classification, category-specific heuristics |
| **Arbiter** | 12% | Final consensus adjudication, confidence calibration |

### Verification Flow

1. **Scan** — Consumer scans a QRON code on the product (or enters serial number)
2. **Decode** — QR data is decoded; ES256 signature is validated
3. **Lookup** — Product record retrieved from blockchain (Polygon ERC-721)
4. **Analyze** — All 5 agents run in parallel with independent scoring
5. **Consensus** — Weighted scores combined; final verdict rendered
6. **Record** — Verification event logged on-chain with timestamp + geolocation

### Trust Score Calculation

```
Trust Score = (Guardian × 0.35) + (Archivist × 0.20) + (Sentinel × 0.25) + (Scout × 0.08) + (Arbiter × 0.12)
```

- **90-100**: Verified Authentic (green badge)
- **70-89**: Likely Authentic (yellow badge, manual review recommended)
- **50-69**: Suspicious (orange badge, hold product)
- **0-49**: Likely Counterfeit (red badge, report filed)

### Supported Verification Methods

- **QR/QRON Scan** — Primary method; artistic AI QR codes with embedded cryptographic data
- **NFC Tap** — For products with NFC chips (luxury goods, electronics)
- **Serial Number** — Manual entry for products without scannable markers
- **Visual Match** — AI image comparison against registered product photos
- **Batch/Lot Lookup** — Supply chain verification via batch identifiers

### Anti-Counterfeiting Features

- Time-locked verification windows (first scan within 30 days of manufacture)
- Geographic geo-fencing (alerts if scanned outside authorized distribution zones)
- Scan velocity monitoring (too many scans from one location = suspicious)
- Supply chain gap detection (missing intermediate custody events)
- Cross-reference with known counterfeit patterns database

### Industries Served

- **Luxury Goods** — Handbags, watches, jewelry, designer clothing
- **Pharmaceuticals** — Drug authenticity, cold chain verification
- **Electronics** — Components, batteries, chargers
- **Cannabis** — Strain verification, lab cert validation (via StrainChain)
- **Government Documents** — Certificates, permits, licenses (via GovChain)
- **Food & Beverage** — Origin verification, organic certification
