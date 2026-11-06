# Certificate of Analysis (COA) Verification Reference

## Contents
1. [COA Signal Hierarchy](#coa-signal-hierarchy)
2. [Lab Legitimacy Checks](#lab-legitimacy-checks)
3. [Batch Number Validation](#batch-number-validation)
4. [THC/CBD Claim Matching](#thccbd-claim-matching)
5. [Flags Reference](#flags-reference)

## COA Signal Hierarchy

Collect COA signals in this order (strongest → weakest):

| Priority | Signal | Weight |
|----------|--------|--------|
| 1 | Lab is licensed + COA hash blockchain-anchored | +0.40 |
| 2 | Direct COA PDF from licensed lab domain | +0.30 |
| 3 | Batch number matches state track-and-trace format | +0.15 |
| 4 | THC/CBD values within ±10% of label claim | +0.10 |
| 5 | Lab test date within regulatory validity window | +0.05 |
| — | Unlicensed or unknown lab | -0.40 |
| — | COA PDF domain ≠ lab's registered domain | -0.25 |
| — | Batch number format mismatch for state | -0.20 |
| — | THC/CBD values outside ±10% of label | -0.25 |
| — | COA test date expired (>12 months) | -0.15 |

## Lab Legitimacy Checks

### What to look for
```
data-lab-id="..."              → Laboratory license ID
data-lab-name="..."            → Laboratory name
data-lab-domain="..."          → Lab's registered web domain
data-coa-url="https://..."     → Direct link to COA PDF
data-coa-hash="0x..."          → Blockchain-anchored COA hash
```

### Known legitimate California labs
- SC Labs (sclabs.com)
- Steep Hill (steephill.com)
- Encore Labs (encorelabs.com)
- Cannalysis (thecannalysis.com)
- PharmLabs (pharmlabssd.com)

### Verification steps
1. Extract `data-lab-id` and cross-reference with state license registry
2. Fetch the COA URL — verify the domain matches the lab's registered domain
3. If `data-coa-hash` present: note as blockchain anchor supporting evidence
4. Check that the issuing lab is not on any state violation/suspension list

## Batch Number Validation

### METRC format (CA, CO, NV, OR, MI, etc.)
```
Valid format:   1A4060300002899000014847
Pattern:        1A + [4 hex chars] + [17 digits]
Length:         24 characters total
```

### BioTrackTHC format (WA, NM)
```
Valid format:   10000102000001234567
Pattern:        Numeric only, 20 digits
```

### Validation steps
1. Extract batch ID from `data-batch-id` or page content
2. Determine state jurisdiction from brand license prefix
3. Validate format against expected pattern
4. Flag `batch-format-invalid` if pattern doesn't match

### Batch recycling detection
- Same batch ID appearing across products of different packaging/weights = counterfeit indicator
- Legitimate batches are tied to a specific SKU and quantity

## THC/CBD Claim Matching

### Label vs COA tolerance
Cannabis regulations allow ±10% of the stated value on labels.

| Label claim | Acceptable COA range |
|-------------|---------------------|
| 25% THC | 22.5% – 27.5% |
| 0.5% CBD | 0.45% – 0.55% |
| 30% THC | 27.0% – 33.0% |

### What to check
```
data-thc-pct="28.4"           → THC percentage on label
data-cbd-pct="0.8"            → CBD percentage on label
```

Compare against COA PDF values. Flag `potency-claim-mismatch` if outside tolerance.

## Flags Reference

| Flag | Severity | Description |
|---|---|---|
| `unlicensed-lab` | Critical | Testing lab is not in state registry |
| `coa-domain-mismatch` | High | COA PDF hosted on different domain than lab |
| `batch-format-invalid` | High | Batch number doesn't match state format |
| `batch-expired` | High | Batch test date exceeds regulatory window |
| `batch-recycled` | Critical | Batch ID reused across distinct products |
| `potency-claim-mismatch` | High | Label potency outside COA ±10% tolerance |
| `coa-missing` | High | No COA link present on product page |
| `coa-hash-unverified` | Medium | Blockchain COA anchor not resolvable |
| `lab-suspended` | Critical | Lab has active state violation/suspension |
| `jurisdiction-mismatch` | High | License number from wrong state |
