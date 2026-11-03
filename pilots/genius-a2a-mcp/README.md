# GENIUS Evidence Passport — A2A / MCP D.C. pilot
Status: **experimental, public-data-only, nonbinding**. Not a stablecoin issuer, compliance certification, or government partnership.

## Regulatory basis (checked 2026-11-03)
- [OCC final rule bulletin, Oct 21 2026](https://www.occ.gov/news-issuances/bulletins/2026/bulletin-2026-50.html), effective January 18 2027.
- [OCC application and waiver guidance](https://occ.gov/news-issuances/bulletins/2026/bulletin-2026-51.html): application intake pending OMB approval.
- OCC separately addresses BSA/AML and sanctions. Do not represent these as covered by this evidence pilot.

## Architecture
Requester agent → A2A Agent Card → explicitly approved assessment task → MCP read-only tools → evidence manifest → independent auditor.

A2A skill: `genius_evidence_review`. MCP tools (planned): `genius_sources_list`, `genius_evidence_verify`, `genius_manifest_build`, `genius_report_get`. All are informational, no trading, minting, wallets, custody, issuer onboarding, account data, signing authority, or regulatory conclusions. No endpoint deployed in this branch.

Inputs: public URL allowlist, UTC timestamp, document bytes/digest, attestor metadata, optional public authorization citation. Outputs: evidence states `observed`, `not_found`, `inconclusive`, `not_tested`; never convert missing source to fraud or noncompliance. SHA-256 is integrity only, not legal validity or reserve sufficiency.

## Agent Card
`agent-card.json` is a **draft example** with `example.invalid` endpoint, not an operational claim. Replace with independently verified HTTPS endpoint only after deployment and tests.

## Bounded commercial flow
1. Publish synthetic fixtures and schema.
2. Independent review and exact-head CI on isolated runner; no merge without approval.
3. Invite D.C.-relevant issuer compliance teams or independent auditors to opt in to an asynchronous public-document pilot.
4. Obtain explicit written task acceptance and allowlisted URLs; execute read-only assessment.
5. Deliver timestamped evidence with reproducible SHA-256, and obtain signed customer acceptance.
6. Offer a paid scoped engagement through already-authorized billing, only after confirming deliverability; never claim sale before independent payment and fulfillment.

## Acceptance criteria
No side effects; unknown claims remain inconclusive; changed bytes change digest; manifest deterministic; all public evidence attributable to source URL and observation time; external reviewer reproduces hash; no issuer compliance verdict.
