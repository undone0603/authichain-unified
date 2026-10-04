# Changelog — authichain-verify

## Unreleased

Documentation only. No version bump in this change; the release that ships it is a separate PR. Verifier logic, CLI, types and example records are unchanged.

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
