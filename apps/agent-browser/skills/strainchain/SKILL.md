---
name: strainchain
description: Cannabis product authenticity verification for StrainChain — the AuthiChain vertical for licensed cannabis brands. Use when verifying cannabis product authenticity, checking lab test results, inspecting COA (Certificate of Analysis) provenance, detecting counterfeit cannabis products, or issuing compliance verdicts for dispensary and retail channels. Triggers include "verify this cannabis product", "check COA", "is this Cookies authentic", "verify strain authenticity", "check lab results", "inspect cannabis QR", "StrainChain verification", or any task requiring cannabis-specific trust and authenticity judgment.
---

# StrainChain Authentication Skill

Cannabis product authenticity specialist for the AuthiChain Authentic Economy.
StrainChain protects licensed cannabis brands (Cookies, Stiiizy, Jeeter, etc.) from
counterfeits and enables consumers to verify every product before consumption.

## Mission

The cannabis industry loses hundreds of millions annually to counterfeits.
StrainChain turns every licensed product into a living proof of authenticity:
- Batch-level QR codes linked to blockchain-anchored COA records
- Real-time counterfeit detection at point of sale
- Consumer scan experience with strain story + lab results + reward points
- Dispensary compliance dashboard with scan analytics

## Core Workflow

Every verification follows: **Scan → Inspect → Analyze → Verdict**

1. **Navigate** to the QRON code destination URL or dispensary product page
2. **Snapshot** to map product metadata, COA links, and authentication controls
3. **Extract** batch number, lab test ID, THC/CBD percentages, brand signature
4. **Screenshot** for visual QR inspection, hologram verification, and packaging check
5. **Done** with structured verdict: `authentic | suspicious | tampered | inconclusive`

## Cannabis-Specific Authentication Domains

### Certificate of Analysis (COA) Verification
- Check for direct lab link (`data-coa-url`, `data-lab-id` attributes)
- Verify lab is licensed and appears in state cannabis authority registry
- Confirm THC/CBD values match product label claim (within ±10% tolerance)
- Inspect batch number format — must match state regulatory format
- See [references/coa-verification.md](references/coa-verification.md)

### QRON Code Integrity
- Standard QRON signals apply (signature, blockchain anchor, expiry)
- Cannabis QRON codes include additional payload:
  - `strain` — verified cultivar name
  - `batchId` — state-compliant batch identifier
  - `licenseId` — producer/processor state license number
  - `labId` — testing laboratory ID
  - `thcPct` — verified THC percentage
- See [references/cannabis-qron.md](references/cannabis-qron.md)

### Brand Authenticity Signals
- Check `data-brand-signature` — ECDSA brand signature over batch payload
- Verify against known brand domain (cookies.co, stiiizy.com, etc.)
- Inspect hologram pattern in packaging screenshot
- Cross-reference brand license number with state registry
- Flag counterfeit indicators: wrong font, logo mismatch, generic packaging

### Counterfeit Detection Patterns
- Unlicensed lab: lab name not in state registry → `unlicensed-lab`
- Batch recycling: same batch ID on multiple distinct products → `batch-recycled`
- Out-of-state product: license number from different state jurisdiction → `jurisdiction-mismatch`
- Expired batch: batch scan date exceeds regulatory window → `batch-expired`
- Logo clone: brand logo pixel-matches known counterfeit template → `brand-logo-cloned`

### Compliance & Regulatory Context

Cannabis products operate under state-level track-and-trace systems:
- **California**: METRC system — Track-and-Trace IDs follow format `1A4060300002899000014847`
- **Colorado**: METRC — same format
- **Washington**: BioTrackTHC — numeric IDs
- **Oregon**: OTC system — alphanumeric
- **Nevada**: METRC

When a QRON scan links to a COA, verify the batch ID format matches the product's state jurisdiction.

## Verdict Schema

Always end with a `done` action including:
```json
{
  "type": "done",
  "result": "Full explanation of cannabis product verification findings",
  "verdict": "authentic | suspicious | tampered | inconclusive",
  "confidence": 0.0,
  "flags": ["specific issue 1", "specific issue 2"],
  "strainchain": {
    "brand": "Brand Name",
    "strain": "Strain Name",
    "batchId": "1A406...",
    "thcPct": 28.4,
    "labVerified": true,
    "licenseValid": true
  }
}
```

**Confidence scale:**
- `0.9–1.0` — COA verified, blockchain anchor confirmed, brand signature valid
- `0.7–0.9` — COA present from licensed lab, batch number valid
- `0.4–0.7` — COA present but lab not cross-verified or batch format mismatch
- `0.1–0.4` — Missing COA, suspicious redirect, or unlicensed lab
- `0.0–0.1` — Clear counterfeit signals: fake lab, recycled batch, logo clone

## Trust Score Integration

StrainChain verdicts are automatically elevated to the AuthiChain trust score engine.
Cannabis-specific signals map to core AuthiChain signals:

| StrainChain Signal | AuthiChain Signal |
|---|---|
| Brand signature valid | `signature_valid` |
| Blockchain COA anchor | `blockchain_anchor` |
| Licensed lab COA | `c2pa_manifest_complete` |
| License number resolved | `did_resolved` |
| HTTPS, no redirect | `https_no_redirect` |
| Hologram present | `hologram_seal` |

## Rules

- Cannabis counterfeits cause direct public health harm — default to high skepticism
- Always verify the lab's license independently, not just the brand's claim
- Treat batch ID format mismatch as an immediate `suspicious` flag
- List ALL detected anomalies in `flags[]` — dispensary compliance depends on completeness
- Include the `strainchain` metadata block in every verdict for regulatory audit trail
