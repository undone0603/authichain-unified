# Government A2A outreach and hardened GENIUS pilot requirements
Prepared 2026-11-03. Design review only; not a government solicitation, approval, procurement award, or agency partnership.

## Authoritative sources
- GSA AI acquisition and pilots: https://www.gsa.gov/artificial-intelligence/buy-ai
- GSA AI governance directive CIO 2185.1C (2026-03-11): https://www.gsa.gov/directives-library/accelerating-responsible-use-of-artificial-intelligence-at-gsa
- FAR 10 responsible industry engagement: https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-10
- FAR 15.603 unsolicited proposals: https://www.acquisition.gov/far/15.603
- CISA allied guidance on agentic AI (2026-05-01): https://content.govdelivery.com/accounts/USDHSCISA/bulletins/41544ff
- NIST agent IAM tenets (2026-10-27): https://www.nist.gov/blogs/cybersecurity-insights/design-tenets-agent-identity-management-systems
- NIST AI Agent Standards Initiative (2026-02-17): https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure

## Government outreach rules
1. Research the agency's actual mission, published acquisition forecasts, RFIs, sources-sought notices and vendor engagement channels first. Do not impersonate agency staff or treat a public technical discussion as procurement consent.
2. Lead with a specific public-document evidence problem and a bounded 15-minute asynchronous review; provide one-page capability statement, reproducible synthetic fixture, limitations, and independent test evidence. Avoid claims of FedRAMP authorization or ATO.
3. Use official procurement channels and published contacts; send individualized, low-volume correspondence. No scraping private addresses, mass unsolicited agent messages, autonomous bid submissions, lobbying, or contingent-fee procurement arrangements.
4. Respect FAR 10 market research and FAR 15.6: an ordinary commercial offer is not automatically a valid unsolicited proposal. Respond to actual solicitations through their stated process.
5. Before any federal-data processing or deployment in agency systems: agency security and privacy review, applicable FedRAMP/ATO assessment, data handling agreement, accessibility, records retention, supply-chain controls, and acquisition authority.
6. No government logo, endorsement, agency affiliation, authorization, or contracting status without evidence.

## Hardened requirements — fail closed
- H1 Agent identity: unique cryptographically verifiable AgentZ identity per workload, no shared human credential, provenance and key rotation/revocation.
- H2 Mandate: signed task mandate specifying requester, exact allowed methods and origins, UTC expiry, nonce, budget $0, public-only data class, maximum requests and output destination. No default delegation.
- H3 Policy engine: deterministic allowlist before model reasoning or tool execution; zero standing privilege; deny by default; prohibit money movement, signing contracts, issuer compliance verdicts, regulated data and side-effect tools.
- H4 MCP: strict JSON-RPC schema validation, protocol version negotiation, authentication where needed, tool input limits, content type and origin checks, no hidden tool registration or dynamic permission escalation.
- H5 A2A: Agent Card identity and URL verified out of band; signed task envelope with replay protection; treat agent-provided instructions and returned documents as untrusted data; bounded task state machine.
- H6 Fetch: **no remote fetch enabled in this draft**. Before activation, enforce hostname allowlist, DNS resolution checks for private/link-local/metadata IPs, redirect revalidation, TLS, egress restrictions, size/time ceilings and SSRF adversarial tests.
- H7 Evidence: source URL, UTC observation, source digest, status and signature verification result recorded separately; document hash alone does not establish authenticity, reserves, legal authorization or compliance.
- H8 Audit: append-only receipt chain, idempotency keys, retention limits, redaction, privacy review, reproducible independent verifier and incident escalation.
- H9 Testing: exact-head isolated runner, static analysis, unit/adversarial tests, third-party review, rollback and incident plan. No PR merge or deployment while protections fail.
- H10 Outreach: explicit agency opt-in for any non-public interaction; no agency endpoints probed merely because discoverable; no payment request before deliverable, authority and contracting path are validated.

## A2A/MCP delivery contract (future)
MCP tools: genius_sources_list, genius_evidence_verify, genius_manifest_build, genius_report_get. All read-only and bounded to pre-approved public fixtures. A2A skill: genius_evidence_review. Outputs use observed / not_found / inconclusive / not_tested; never automatic COMPLIANT or NONCOMPLIANT. Independent reviewer must reproduce manifest SHA-256.

## Proposed D.C. route
Phase A: publish synthetic fixtures and independent test evidence, no agency contact.
Phase B: review GSA/NIST/OCC public vendor engagement and identify the correct acquisition/innovation intake channel. Government is potential stakeholder, not assumed customer.
Phase C: submit a short factual capability statement through a published authorized channel, only after security claims are independently verified.
Phase D: accept a scoped public-data evaluation from an authorized operator, return reproducible evidence and obtain written acceptance.
Phase E: pursue a compliant procurement or independent private-sector paid pilot, without misrepresenting either as awarded.

## Review gate
Security review must reject: unsigned or expired mandates, prompt-injection overrides, URL-to-internal-network SSRF, stale or revoked signer, replayed task IDs, fabricated issuer authority, claims of FedRAMP/ATO without authorization, and any autonomous government commitment or contract acceptance.
