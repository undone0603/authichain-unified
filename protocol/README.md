# AuthiChain Verification Protocol

**Apache-2.0.** Anyone may implement this, including competitors.

- [`SPEC.md`](./SPEC.md) — the specification (v0.1.0 draft)
- [`verifier.mjs`](./verifier.mjs) — reference verifier, zero dependencies (`node:` builtins only). Verified on Node 22; the APIs it uses are available from Node 18.
- [`LICENSE`](./LICENSE) — Apache License 2.0

## Why this directory is open while the rest of the repo is not

A specification others are forbidden to implement is not a standard. A verifier
nobody can run independently is not proof. Categories are led by whoever owns the
reference definition, and you cannot own one you won't let anyone use.

What stays proprietary is the platform: the multi-agent scoring pipeline, the
edge network, the operational tooling, and the AuthiChain trademarks. Those are
the actual moat. The wire format never was — publishing it costs nothing that
was ever defensible and makes every other implementation measurable against
this one.

Apache-2.0 rather than MIT specifically for the patent grant. That is what lets
an enterprise legal team sign off on implementing the spec.

## Run it

```bash
node verifier.mjs record.json [anchor.json]
```

Exits `0` for `verified` / `valid-unanchored`, `1` for `invalid`. Output:

```json
{
  "verdict": "verified",
  "reasons": [],
  "checks": { "signature": true, "anchorHash": true }
}
```

No network access. No AuthiChain account. Nothing here phones home — verification
you have to ask us to perform for you would defeat the purpose.

To accept testnet anchors (they are rejected by default, see below):

```bash
ALLOW_TESTNET=1 node verifier.mjs record.json anchor.json
```

## Three verdicts, no partial credit

| Verdict | Meaning |
|---|---|
| `verified` | Signature valid; anchor present, well formed, mainnet, hash matches |
| `valid-unanchored` | Signature valid; no anchor supplied |
| `invalid` | Any required check failed |

There is no score in this layer. A score is a product feature; a verdict is what
a verifier owes you.

## Two rules worth calling out

Both exist because this repository previously shipped a "Global Authenticity
Index" that violated them, listing Hermès and Pfizer as verified assets on
**Polygon Amoy testnet**, one with a transaction hash of 49 hex characters
instead of 64. A conforming verifier refuses both, and there are tests for it:

- **A testnet anchor is not proof.** Rejected unless the caller explicitly opts
  in. Presenting testnet anchors as production evidence is the most common way
  this class of system misleads people.
- **A malformed transaction hash is rejected, not displayed.** Render a truncated
  hash and you have published something that looks like proof and links nowhere.

## Status

v0.1.0 draft. Not yet stable. Known gaps, both documented in `SPEC.md` §8:

- **No revocation.** A record signed by a compromised key stays cryptographically
  valid. Planned for v0.2 via `credentialStatus`.
- **Signatures prove authorship, not truth.** An issuer can sign a false
  statement and this layer will correctly report `verified`. Defending against
  that lives above this specification, not in it.

Feedback and independent implementations are the point. Open an issue.
