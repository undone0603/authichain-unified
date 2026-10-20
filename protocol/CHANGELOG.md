# Changelog — authichain-verify

## Unreleased

No version bump in this change; the release that ships it is a separate PR. `verifier.mjs` verdicts, types, and example records are unchanged.

- `passport.mjs`: a product passport is a `DigitalProductPassport` whose digital identity is `credentialSubject.id`. `scanProvesGenuine` is true only when the reference verifier returns `verified`. A `gtin`, when present, must be 14 digits. This package does not assign one.
- `authichain-verify` prints that passport scan and exits 0 only when it is genuine. Types for the passport export ship in `passport.d.ts`.
- The verify worker and the product pages call the same scan when a stored passport is present. A registry status is not that proof.
- `storePassport` places an already-signed passport on a metadata object. The digital identity stays `credentialSubject.id`. It does not assign a GTIN and it does not write a database.
- A product scan that omits its own record uses that stored passport and its anchor. The expected digital identity is the product subject id, or `credentialSubject.id` on the stored passport. A registry status is not that identity. No GTIN is assigned.
- Product verify routes report that scan. An active certificate, a model reply, or a row is not a genuine passport.
- The internal trust-score route records caller-supplied flags beside that scan. An omitted flag is false. `verified` follows the stored passport when a product id is present. A flag tally is not a genuine passport.
- The public product verify API records registry and anchor evidence. `verified` stays false. This route does not scan a product passport. A confirmed anchor receipt is not that scan.
- `GET /api/v1/verify` reports the passport stored on the certification. An approved row is not signed as verified.
- The industrial telemetry dashboard does not invent a verified scan, and that ingest does not anchor. A materials table is titled a product passport only when the stored passport scans genuine. A flag tally is not a passport.
- Telemetry anchoring stays off. The StrainChain description does not claim a METRC or BioTrack connection. A pharma category is not a DSCSA profile.
- A HubSpot anchor-proof label does not write a chain transaction. A visual image compare is not a passport scan. The StrainChain home states the $49 cultivar passport and does not claim a METRC or BioTrack connection.
- The Next StrainChain home and the supply-chain page state that same $49 passport. A recorded supply-chain event does not scan a passport. The shadow brand catalog does not describe a METRC, BioTrack, or DSCSA connection.
- A cannabis strain lookup scans the stored passport. Omitted cannabinoid numbers stay empty. The metering stub stays at zero and is not a passport scan.
- A seal serial is stored only as `credentialSubject.sealSerialSha256`. `checkSealSerial` reports that commitment as `productBinding` and does not change `genuine`. A second presentation is the same passport. Evidence beside the passport is outside the signature. This check is not a verifier verdict, and the 28 conformance fixtures are unchanged.
- A medical category is not a device profile. `mapDbToIdentity` stays `generic-provenance` and does not assign a UDI.
- An inspection evidence row does not set `physical_binding`. A missing manufacturing date is not the harvest word Recent, and a missing rarity is not filled with 50. The asset story does not say the product is verified or on a Bitcoin truth layer.
- A DSCSA package record is transaction information for one package id. It is not an FDA compliance determination, and it does not set `genuine`. A missing expiration is not the current time.
- `storeDscsaPackageEvidence` appends that package row only when the five fields are supplied. A category, an inspection row, or a missing passport does not create it. The row does not set `genuine`.

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
