# Founder-Only Autonomous Business

AuthiChain Unified is operated as a one-founder, machine-run business. The repository is the control plane; GitHub Actions, Cloudflare, Supabase, Stripe and existing AgentZ rails perform the repetitive work.

## Business model

The machine sells a small set of self-serve products through the live checkout surface. Product truth lives in `src/lib/plans.ts`; this document does not duplicate Stripe IDs or invent pricing.

The primary funnel is:

`owned/earned demand → verified lead signal → checkout → paid event → automatic fulfillment → verification evidence → retention/dunning → founder exception`

### Product ladder

- $19/mo QRON Launch — recurring entry product.
- $29 Starter Pack — low-friction one-time entry.
- $49 StrainChain Passport — vertical product.
- $299 EU DPP Readiness — high-intent diagnostic/service product.
- $299 Made in USA Claim File — substantiation-support product.
- $2,500 Made in USA Audit Bundle — higher-value async engagement.

The source of truth for availability and live payment configuration is `src/lib/plans.ts` plus the Stripe watchdog. The business automation must never hard-code a second price catalogue.

## Founder role

The founder is the only principal/operator. The machine may discover, qualify, draft, send within existing outreach gates, convert, fulfill, monitor, report, and prepare deterministic fixes.

The founder is intentionally removed from routine operations. The founder only handles decisions that can create material legal, financial, security, reputation, or infrastructure risk.

## Authority and capacity boundaries

The company is AI-operated, founder-governed. An agent acts only inside the
written authority in `docs/OPERATING_CHARTER.md` and
`.github/autonomy.json`; it does not become a legal principal or an
independent decision maker.

| Area                     | Autonomous work                                                                     | Founder-only decision                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| System health            | Probe, diagnose, open an alert, defer non-urgent work, and prepare a reversible fix | Accept operational risk outside documented guardrails                                               |
| Founder capacity         | Summarize workload and create non-urgent buffers from founder-provided availability | Collect or infer personal health data, or make a health, employment, or financial decision          |
| Growth and scale         | Measure funnels, suggest changes, and run approved bounded experiments              | Raise a spend/rate limit, create a new commercial commitment, or accept capital/inventory risk      |
| Customer interaction     | Answer and follow up through approved, consent-safe content and escalation paths    | Sign contracts, make legal/regulatory claims, negotiate unapproved terms, or override refund policy |
| Money and infrastructure | Create approved checkout sessions; reconcile and alert on payments and health       | Price/SKU changes, refunds, payouts, transfers, secrets, DNS/access, or production migrations       |

Personal health and wearable data are not inputs to the operating system by
default. Any optional founder-provided signal must be private,
minimum-necessary, advisory-only, revocable, and limited to reducing
non-urgent load. It cannot be used for medical assessment or for any decision
about a person.

## Scaling discipline

Every autonomous optimization uses the same bounded loop:

`measure → propose → bounded experiment → verify → retain or revert`

An experiment must have an observable metric, a time/spend/rate cap, a
rollback path, and a condition that opens an `ops-alert` or
`approval-needed` issue. Agents never trade consent, privacy, authentication,
payment safety, deliverability, or truthfulness for conversion.

## Autonomous loops

### Acquire

Run owned content/SEO, buyer-signal detection, community listening, government opportunity ingestion, and gated first-touch outreach.

Cold outreach remains subject to `.github/autonomy.json`, the deliverability breaker, provenance/send guards, opt-out handling, and the `OWNER_LIVE_SEND` gate. A breaker trip is an automatic stop, not an instruction to work around it.

### Convert

Warm leads move to the appropriate live checkout or written async proposal. The machine should prefer a self-serve checkout over a call. No invented customer, certification, urgency, result, or logo.

### Fulfill

A successful payment triggers the existing provisioning path. Fulfillment evidence should contain the subject identifier, attestation/JWS where applicable, JWKS reference, evidence digest, verification result, timestamp, and deployment/version identifier.

### Retain

Subscription health, failed-payment dunning, customer-health scoring, and win-back run without founder involvement. Material exceptions become approval/ops issues.

### Operate

Checkout, production, schema, integration, estate, and verification health loops continuously test the money path and trust path. Failed loops fail closed where money, privacy, or deliverability is involved.

### Improve

The repair loop may open deterministic draft PRs. Content/AI suggestions remain suggestions. Security, revenue, schema, charter, secret, and DNS changes remain founder-gated.

## Founder command center

The founder should need only:

1. Owner digest — weekly numbers and exceptions.
2. GitHub approval issues — rare decisions.
3. GitHub ops-alert issues — failures requiring intervention.

Silence means healthy.

## Operating rules

- One canonical repo: `undone0603/authichain-unified`.
- Cloudflare-first production authority.
- No second orchestration framework.
- No parallel price catalogue.
- No autonomous secrets/DNS/production-schema mutation.
- No autonomous merge of security/revenue/schema/charter changes.
- No claims that cannot be verified from system evidence.
- No bypass of deliverability, payment, authentication, or revocation gates.

## Revenue definition

Count revenue only from verified payment events, not proposals, clicks, traffic, or typed-in estimates. Founder charges and internal test transactions are excluded according to the existing reporting rules.

## Exit condition

The system is successful when the founder can stop checking dashboards and still receive only:

- a compact revenue/health digest;
- an approval request when a genuine founder decision is required;
- an ops alert when automation cannot safely continue.

The goal is not zero humans. It is one human with no routine operating workload.
