# StrainChain Cannabis Verification FAQ

## What is StrainChain?

StrainChain is AuthiChain's cannabis-specific vertical (strainchain.io). It provides seed-to-sale verification, strain authenticity validation, and compliance tools for licensed cannabis operators.

## How Does Strain Verification Work?

1. **Genetics Registration** — Cultivator registers strain genetics (parent lineage, phenotype markers)
2. **Lab Integration** — COA (Certificate of Analysis) hash stored on-chain
3. **Batch Tracking** — Each batch gets a unique QRON with embedded cannabinoid data
4. **Consumer Scan** — End user scans to verify strain authenticity and view lab results

## What Data is Verified?

- **Strain name and genetics** — Cross-referenced against registered cultivar database
- **THC/CBD percentages** — Compared against lab-certified values (±2% tolerance)
- **Terpene profile** — Top 5 terpenes validated against strain type expectations
- **Batch/lot number** — Traced through supply chain custody events
- **Lab certificate** — SHA-256 hash compared against registered COA
- **METRC compliance** — Tag number validated against state tracking system

## Rarity Score

StrainChain calculates a "Rarity Score" for each strain based on:
- Genetic uniqueness (fewer registered crossbreeds = rarer)
- Terpene profile complexity
- THC/CBD ratio distinctiveness
- Geographic distribution (fewer grow sites = rarer)
- Award history (Cannabis Cup wins, etc.)

## Compliance Features

- **METRC Integration** — Automatic tag validation for CA, CO, OR, MI, and 20+ states
- **BioTrack Support** — Planned integration for NM, IL states
- **Lab Cert Anchoring** — Immutable lab results prevent post-certification tampering
- **Recall Tracking** — Instant consumer notification if batch is recalled
- **Age Verification** — Optional age-gate for consumer-facing scans

## For Dispensaries

- Verify incoming inventory authenticity before shelving
- Display QRON codes on product labels for customer trust
- Real-time alerts if counterfeit products enter supply chain
- Customer loyalty integration (scan-to-earn $QRON tokens)

## For Cultivators

- Register proprietary genetics with blockchain proof
- Prove provenance for premium/craft strains
- Detect unauthorized clones or mislabeled products
- Connect directly with dispensaries (B2B marketplace)

## Pricing

| Tier | Monthly | Verifications | Features |
|------|---------|---------------|----------|
| Starter | $29 | 500/mo | Basic strain verification |
| Professional | $99 | 5,000/mo | + Lab cert anchoring, METRC sync |
| Enterprise | $299 | Unlimited | + API access, white-label, priority support |

## Frequently Asked Questions

**Q: Does StrainChain work in all legal states?**
A: Yes. StrainChain operates in all US states with legal cannabis programs (medical or recreational). We support METRC and BioTrack tracking systems.

**Q: Can consumers use StrainChain without an account?**
A: Yes. Scanning a QRON code is free and requires no account. The consumer sees strain info, lab results, and authenticity status instantly.

**Q: How does this prevent fake lab results?**
A: Lab certificates are hashed at time of issue and stored on Polygon. Any modification to the PDF or data would produce a different hash, immediately flagging tampering.

**Q: What about patient privacy?**
A: StrainChain never collects or stores patient information. Scans are anonymous. Only the product is verified, not the person scanning it.

**Q: Integration with existing POS?**
A: We provide REST API and webhook integrations for Dutchie, Jane, Treez, and custom POS systems. Enterprise tier includes dedicated integration support.
