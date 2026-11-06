# AgentZ risk-tiered execution and fallback policy v0.1
Prepared 2026-11-03. Applies to GENIUS Evidence Passport pilot; proposal only until independently reviewed.

## Green — autonomous
Documentation, local offline tests, synthetic fixtures, format checks, static analysis and draft patches. Automatically execute and preserve SHA-256 evidence.

## Yellow — bounded
Public read-only research, approved public endpoint checks, draft PRs, individualized nonbinding outreach. Require explicit scope, rate limits, source timestamps and auditable receipts. No automatic retries after an explicit deny.

## Orange — controlled
Production deployment, agent enrollment, external signing identity, integration changes and commercial offers. Require exact-head tests, independent reviewer, rollback plan, scoped authorization, and policy-engine approval.

## Red — restricted
Financial transfers, accepting binding contracts, regulated custody/issuance, sensitive government data, access to non-public government systems, or removal of mandatory safety controls. Require lawful delegated authority and any necessary security, legal, procurement and compliance approvals. No automated escalation from lower tiers.

## Blocker classification and fallback
- Transient (network timeout, rate limit): bounded backoff with retry budget and idempotency key.
- Infrastructure unavailable (CI runner, provider outage): run equivalent checks on a genuinely isolated authorized environment; mark evidence as alternate-run, not CI pass.
- Permission denied (403, branch protection): prepare local patch or draft PR and request authorized review; never switch identities or bypass access control.
- Tool policy blocked: stop that action, preserve sanitized context and produce a patch artifact for independent review. Do not rephrase or reroute to evade the restriction.
- Validation failed: fix cause, rerun exact-head tests, and retain failing evidence.
- External operator silent: no assumed consent, no repeated unsolicited messages; wait or find another opt-in participant.

## Execution contract
Every action records risk tier, intent, authorized principal, target, time, input digest, outcome, retry count, and rollback instructions. No claim of completion without observed evidence. No automatic release on draft PRs or queued checks.
