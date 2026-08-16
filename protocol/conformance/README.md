# Conformance suite

**Apache-2.0.** 28 fixtures. An implementation is conformant when all 28 pass.

This exists so that "we implement the AuthiChain verification spec" is a
checkable claim rather than a marketing one. That is the whole point of the
protocol, applied to the protocol itself.

## Run it

```bash
node run.mjs --strict -- node ../verifier.mjs
```

Any language, any implementation:

```bash
node run.mjs --strict -- python3 verify.py
node run.mjs --strict -- ./target/release/verify
node run.mjs --strict -- go run ./cmd/verify
```

`--json` emits machine-readable results for CI.

## The contract

```
<command> <record.json> [anchor.json]
```

- Print a JSON object on **stdout** with a `verdict` field: `verified`,
  `valid-unanchored`, or `invalid`.
- When a fixture enables testnet anchors, `ALLOW_TESTNET=1` is set in the
  environment for that invocation.
- **Exit code is ignored.** Only stdout is read, so exiting non-zero on
  `invalid` is fine.

Under `--strict`, reason strings are checked too. Reason vocabularies are
implementation detail, so plain mode only compares verdicts — but an
implementation returning the right verdict for the wrong reason is still
suspect, so cite `--strict` in any published conformance claim.

## Fixtures are clock-independent

Time-sensitive cases use the year 2099 and the year 2000, so any plausible
system clock produces the same verdict. Implementations need no clock-injection
hook to conform.

## Reproducible

```bash
node generate.mjs
```

Signing keys derive from fixed seeds, so this reproduces every fixture byte for
byte. A fixture set nobody can regenerate is a fixture set nobody can audit.

## What the vectors cover

| Group | Count | What it catches |
|---|---|---|
| Valid paths | 3 | Baseline: signed record with and without a mainnet anchor |
| **Canonicalisation** | 4 | **Implementations that sign or hash raw file bytes instead of the JCS form** |
| Signature failures | 6 | Tampering, wrong key, truncated proof, missing multibase prefix, non-Ed25519 `did:key` |
| Required fields | 6 | Each mandatory field absent |
| Validity window | 2 | Not-yet-valid, expired |
| Anchor failures | 7 | Hash mismatch, testnet without opt-in, malformed/missing tx hash, non-CAIP-2 chain |

### The canonicalisation vectors matter most

`canon-key-order`, `canon-anchor-key-order`, `canon-nested` and `canon-unicode`
present records whose serialised key order is *not* sorted. An implementation
that signs `JSON.stringify(record)` instead of the RFC 8785 canonical form
passes every other test and fails these. It is the most common way a second
implementation silently diverges from the first, and the failure is invisible
until two parties disagree about a real product.

### Two vectors exist because this project shipped violations of them

`anchor-testnet-rejected` and `anchor-tx-truncated`. The repository previously
published a "Global Authenticity Index" listing Hermès and Pfizer as verified
assets, anchored to Polygon **Amoy testnet**, with one transaction hash of 49
hex characters instead of 64. Both are now failing test cases rather than
prose warnings.

## The suite has teeth

A conformance suite that cannot fail is worthless, so it is validated against
deliberately broken implementations:

| Implementation | Result |
|---|---|
| Reference verifier | **28/28** (strict) |
| Stub that always returns `verified` | 4/28 |
| Correct Ed25519 but signs raw `JSON.stringify` instead of JCS | 20/28 — fails every valid-signature fixture |

The third case is the interesting one: a plausible, well-intentioned
implementation with one wrong line fails loudly rather than subtly.

## Claiming conformance

Publish the output of:

```bash
node run.mjs --strict --json -- <your command>
```

`conformant: true` with `passed: 28`. Include the manifest `version` from
`manifest.json` so the claim is pinned to a fixture set.

Independent implementations are the point. If a fixture looks wrong, open an
issue — a bug in the suite is more valuable to find than a bug in a verifier.
