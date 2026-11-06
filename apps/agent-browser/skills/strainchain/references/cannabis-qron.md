# Cannabis QRON Code Reference

## Contents
1. [QRON Payload Schema](#qron-payload-schema)
2. [Packaging Hologram Verification](#packaging-hologram-verification)
3. [Counterfeit Pattern Library](#counterfeit-pattern-library)
4. [Dispensary POS Integration](#dispensary-pos-integration)
5. [Consumer Scan Experience](#consumer-scan-experience)

## QRON Payload Schema

Every cannabis QRON code encodes a signed JSON payload:

```json
{
  "version": "1.0",
  "type": "strainchain",
  "brand": "Cookies",
  "strain": "Cereal Milk",
  "sku": "CKS-FLWR-3.5G-CERML",
  "batchId": "1A4060300002899000014847",
  "licenseId": "CCL21-0000123",
  "labId": "C8-0000014-LIC",
  "thcPct": 28.4,
  "cbdPct": 0.3,
  "weight": "3.5g",
  "packagedAt": "2025-08-01T00:00:00Z",
  "expiresAt": "2026-08-01T00:00:00Z",
  "coaUrl": "https://sclabs.com/coa/1A406030000289900001484",
  "coaHash": "0xabc123...",
  "anchorTx": "0xdef456...",
  "issuer": "did:web:strainchain.authichain.com",
  "signature": "base64url-encoded-ECDSA-256-signature"
}
```

### Required fields for valid cannabis QRON
- `batchId` — State track-and-trace ID
- `licenseId` — Producer/processor state license
- `labId` — Testing lab license ID
- `thcPct` — Tested THC percentage
- `signature` — ECDSA-256 signature over canonical payload
- `expiresAt` — Product regulatory expiry

## Packaging Hologram Verification

Legitimate cannabis QRON codes are paired with a physical hologram seal.
Use `screenshot` action then inspect for:

### Hologram indicators
- Iridescent rainbow pattern visible at slight angle (check for flat-colored counterfeit)
- Brand name laser-etched into hologram surface (not printed on top)
- Hologram serial number matches `data-hologram-id` in QRON payload
- Void pattern appears if hologram is peeled (tamper evidence)

### Common hologram counterfeits
- Flat silver sticker with printed logo = counterfeit → `hologram-fake`
- Color shifting only on label, not separate hologram = missing hologram → `hologram-missing`
- Hologram serial not in QRON payload = unlinked hologram → `hologram-unlinked`

## Counterfeit Pattern Library

### Known counterfeit signals for major brands

**Cookies (cookies.co)**
- Logo: Original uses specific Cookies script font — counterfeit often uses Arial Bold
- Packaging: Licensed products have child-resistant Exit Bag packaging
- Common fake: Black mylar bags with iron-on label — no exit bag compliance
- Flag: `cookies-packaging-noncompliant`

**Stiiizy (stiiizy.com)**
- Original pods have a flat matte finish; counterfeits often have glossy finish
- Authentic STIIIZY pods have a distinct window cutout — fakes fill this with opaque material
- License number format: C12-0000XXX-LIC
- Flag: `stiiizy-pod-visual-mismatch`

**Jeeter (jeeter.com)**
- Original pre-rolls have twist-end packaging with embossed Jeeter logo
- Counterfeit pre-rolls often lack the twist-end seal
- Flag: `jeeter-seal-missing`

## Dispensary POS Integration

When verifying at a dispensary point-of-sale:

### API verification endpoint
```
GET /api/strainchain/verify?qron=<encoded-payload>
```

Response:
```json
{
  "verdict": "authentic",
  "confidence": 0.94,
  "brand": "Cookies",
  "batchId": "1A4060300002899000014847",
  "coaVerified": true,
  "licenseValid": true,
  "trustScore": { "score": 0.942, "signature": "..." }
}
```

### Integration signals for POS systems
- Verdict = `authentic` → Allow sale, log scan event
- Verdict = `suspicious` → Hold product, flag for manager review
- Verdict = `tampered` → Seize product, trigger counterfeit alert
- Verdict = `inconclusive` → Request manual COA verification

## Consumer Scan Experience

When a consumer scans a cannabis QRON code, they should see:

1. **Authenticity badge** — Green "Authentic" or Red "Counterfeit Alert"
2. **Strain story** — AI-generated narrative about the strain: origin, terpene profile, effects
3. **Lab results** — THC/CBD chart from COA data
4. **Brand journey** — Farm → Processor → Lab → Dispensary timeline
5. **Reward minting** — QRON points earned for this verification scan
6. **Share button** — Social share: "I just verified my [Brand] [Strain] on StrainChain"

The consumer experience is the public face of the Authentic Economy:
every scan is both a verification AND an engagement moment.
