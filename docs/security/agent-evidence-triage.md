# AgentZ evidence triage — agent impersonation and QR scan anomalies

Status: **source-level read-only proposal**, not production detection. Checked: 2026-11-01.

## Trust boundaries

1. The canonical AuthiChain AgentPassport / signed-message verifier remains authoritative for cryptographic assertions, issuer revocation, agent capabilities, replay protection, policy and intent. See `workers/authichain-verify-worker/src/agent-verifier.ts`. Do not pass self-reported `valid` values from AgentCards, prompts, a web search, or MCP returns into authorization.
2. `agentz.core.agent_threats.triage_agent_verification(result, from_canonical_verifier=True)` is **read-only triage**. Its `valid_signed_message_only` status is not an authorization decision or proof of who physically operates the agent. The caller must have received the result through a trusted canonical verifier channel. Default `from_canonical_verifier=False` produces `indeterminate`, even for a claimed positive signature. Replay, mismatched identity, invalid signatures and intent mismatches request human review; they **do not** prove a fake/counterfeit agent.
3. `agentz.core.alerts.detect_suspicious_activity` reads from `scan_events` and returns an investigation ticket only for 11+ unique event IDs in a ten-minute window from 3+ distinct sessions and 2+ distinct city/country locations for a single QRON identifier. The source schema was checked read-only against the QRON-v2 Supabase project: `id`, `qron_id`, `scanned_at`, `city`, `country`, `session_id` exist. It neither reads nor logs `ip_address` or `user_agent`. Geographic data and session IDs may be spoofed. A batch QR is expected to repeat. This signal is **not** counterfeit or physical-authenticity proof.
4. Database failures or absent required observations are *unknown*, not clean. No outbound message, takedown, revocation, product withdrawal, or change to payment/production flags occurs. The alert logger is local, without consumer contact or external reporting.
5. Only an independent signed record, current issuer authorization, durable revocation state and appropriate physical-world supply-chain evidence can support further verification. A web page, an A2A card, a successful TLS connection, and a valid cryptographic signature each establish **different things**.

## Response playbook

On `suspicious_evidence`: preserve sanitized event time, canonical verifier result, issuer/key ID, claimed agent ID and action intent; hold the requested high-impact action through the existing signed-message policy gate; review the original signed payload, trusted key source, revocation and replay ledger. Use independent authorized human review before declaring impersonation. Do not post public accusations.

On `MULTI_LOCATION_SCAN_BURST`: inspect serialization vs batch scope, source system, deduplication, device retries, clock drift, product provenance, and separate observations. Contact the legitimate issuer through a trusted channel if warranted. A false alarm must be documented and cleared without asserting counterfeit status.

**Medical, aviation, or other life-critical goods:** a scan anomaly must not be substituted for a professional safety assessment. Relevant authorized trading partners should use their established incident investigation/quarantine procedures; do not autonomously quarantine or declare medicine illegitimate. See FDA DSCSA verification guidance and WHO substandard/falsified medical-product identification guidance.

## Testing

```bash
PYTHONPATH=. python -m pytest -q agentz/tests/test_agent_threats.py agentz/tests/test_scan_alerts.py
```

Local isolated proof on the four exact GitHub source blobs: **24 passed**. This does not establish full repository CI, live agent identity verification, a live anomaly, or any lives saved. A connected QRON-v2 read-only aggregate query showed 30 stored scan events and 0 events in the prior ten minutes at the time checked.

## Primary references

- A2A specification: https://github.com/a2aproject/A2A/blob/main/docs/specification.md (agent identity, optional JWS card signing, transport authentication and authorization)
- OWASP MCP Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html (tool poisoning, confused deputy, least privilege)
- FDA DSCSA verification: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/verification-systems-under-drug-supply-chain-security-act-certain-prescription-drugs
- WHO training toolkit: https://www.who.int/publications/m/item/identifying-suspected-substandard-andfalsified-medical-producs-%28sfmps%29-forhealthcare-professionals

## Release requirements

Independent code-owner review, real CI on the exact head, protected deployment gate, authenticated verifier integration test, separate privacy/retention review and calibrated false-positive review. **Do not deploy automatically from this branch.**
