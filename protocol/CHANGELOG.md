# Changelog — authichain-verify

## Unreleased

No version bump in this change; the release that ships it is a separate PR. `verifier.mjs` verdicts, types, and example records are unchanged.

- `passport.mjs`: a product passport is a `DigitalProductPassport` whose digital identity is `credentialSubject.id`. `scanProvesGenuine` is true only when the reference verifier returns `verified`. A `gtin`, when present, must be 14 digits. This package does not assign one.
- `authichain-verify` prints that passport scan and exits 0 only when it is genuine. Types for the passport export ship in `passport.d.ts`.
- The verify worker and the product pages call the same scan when a stored passport is present. A registry status is not that proof.
- `storePassport` places an already-signed passport on a metadata object. The digital identity stays `credentialSubject.id`. It does not assign a GTIN and it does not write a database.
- A product scan that omits its own record uses that stored passport and its anchor. The expected digital identity is the product subject id, or `credentialSubject.id` on the stored passport. A registry status is not that identity. No GTIN is assigned.

Claims corrected so every named standard is either what the code does or is labelled as planned:

- README: removed a bullet describing an optional carriage profile. It linked to a repo directory that is not in the npm package.
- SPEC §2: removed the settlement-carriage row and the dual-digest hashing note. Neither ships in this package; the verifier hashes with SHA-256 only.
- SPEC §2: removed the claim that a third-party VC 2.0 verifier will validate the signature. The spec now says records follow the W3C VC Data Model 2.0 structure and have not been tested with third-party VC verifiers.
- SPEC §7: "conforms" now reads "conforms to this specification".
- SPEC §8: post-quantum signatures (ML-DSA, FIPS 204) are listed as planned, not implemented.
- SPEC §9 (optional carriage profile) removed. It described code that is not in this package.
- `CHANGELOG.md` now ships in the package.

## 0.1.1 — 2026-09-29

- README: install from npm and a worked offline check of the Polygon mainnet demonstration record.
- Ship `examples/polygon-anchor-1.{record,anchor}.json`.
- Author and copyright: Zachary Kietzman (AuthiChain).

## 0.1.0 — 2026-09-27

- First npm release of the offline reference verifier.
