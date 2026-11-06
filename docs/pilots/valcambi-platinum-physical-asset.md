# AuthiChain physical-asset pilot: Valcambi 2.5 g platinum

**Observation date:** 2026-11-02 · **Status:** EVIDENCE_ONLY_UNVERIFIED · **Cost:** $0

## Scope
A real, owner-submitted photograph-based pilot for the AuthiChain physical-to-digital evidence workflow. No manufacturer endorsement, product authenticity, legal ownership, paid sale, or production attestation is claimed.

## Source and limits
- Two original user-submitted photographs appear to depict a Valcambi Suisse 2.5 g platinum bar in assay-style packaging. The file bytes are retained privately; only SHA-256 fingerprints are published.
- [Valcambi's official minted-bars catalogue](https://valcambi.com/product/minted-bars/) lists 2.5 g Pt 999.5, 11.50 × 19.00 × 0.75 mm, and two-letter/six-digit numbering with a serialized certificate.
- **Photographs do not authenticate the metal, specific serial, package seal, provenance, custody, or manufacturer issuance.**
- The [public JSON observation](../../protocol/samples/physical-assets/valcambi-pt25.public.json) contains NO full serial, source image, contact details, fabricated issuer signature, GTIN, or live registry ID.

## Public truth boundary
Use title **Valcambi 2.5 g Platinum — photo evidence pilot** and status **EVIDENCE ONLY — NOT AUTHENTICATED**.
- Observed: branding, stated 2.5 g mass, Pt 999.5 markings, assay-style package.
- Recorded: hash of each original photo for future byte-level integrity comparison.
- Not checked: exact bar/certificate serial match, physical binding, composition, condition or tampering, ownership, custody, manufacturer or dealer attestation.
- Not issued: AuthiChain signed claim, active verification record, on-chain anchor or production QR.

## Safe completion sequence
1. Check retained private photo bytes against published hashes. Test that changes to the files fail hash validation.
2. Print **demo-only QR** that links to this public pilot or review page with `NOT AUTHENTICATED` prominently displayed. A link to a GitHub document is not a production seal.
3. Privately confirm serial match and record purchase/custody documentation where available.
4. Obtain qualified bullion dealer/assayer inspection or non-destructive test if metal authenticity is requested. A brand photo match cannot replace this.
5. Only with issuer authority, operational registry and policy checks, issue a signed evidence-bound record with revocation status and an actual identifier.
6. Test browser + agent/MCP reads; distinguish verified **record** from physically genuine metal. Unknown or NOT_FOUND must never be presented as counterfeit.

## Gates
- `node --test protocol/samples/physical-assets/valcambi-pt25.test.mjs`
- No manufactured GS1 GTIN, false Valcambi issuer identity or counterfeit verdicts.
- Do not publish the full serial or source images without separate consent.
- No production registration or deployment is performed by this pilot PR.
