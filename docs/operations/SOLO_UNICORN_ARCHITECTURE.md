# Solo Unicorn architecture

## Purpose

The Solo Unicorn model is a founder-led company that scales through a unified
ecosystem of AI tools and bounded automation rather than additional operating
headcount. The founder remains the architectural authority: setting vision,
ethical constraints, approval boundaries, and the rules that determine what
the system may do alone.

This document is an operating model. It does not override the
[operating charter](../OPERATING_CHARTER.md) or
`.github/autonomy.json`; those remain the executable authority for automation.

## Control model

The system optimizes for reliable outcomes, not maximum autonomy:

```text
founder intent + written policy
        ↓
evidence-backed recommendation
        ↓
bounded automated execution or approval queue
        ↓
observable outcome + reversible record
```

Every automation must have an owner, an evidence source, a measurable outcome,
a failure mode, and a switchboard entry. It must fail closed when the required
evidence or authorization is unavailable.

## Pillars

### 1. Health

**System health** covers availability, deploy status, security checks, data
integrity, cost, and the freshness of scheduled loops. The health lane may
monitor, classify failures, open alerts, and prepare deterministic repair work.
Production fixes remain subject to the charter's deployment and merge rules.

**Founder capacity** is protected through workload-aware recommendations:
summarize pending approvals, batch non-urgent decisions, and defer
non-essential work when the founder chooses. This repository does not collect,
store, or act on biometric, sleep, stress, or other health data. Any personal
wellness tooling must be opt-in, private to the founder, and advisory only.

### 2. Scale

Scale automation uses live evidence to prioritize work:

- monitor funnel, reliability, cost, and product-usage telemetry;
- recommend experiments or resource changes with their evidence and rollback;
- provision only pre-approved infrastructure through versioned configuration;
- ship tested, reversible changes through the existing delivery lanes.

Agents may not independently alter prices, spend limits, billing accounts,
secrets, DNS, production database schema, or cloud-account access. These
actions always require the approval path defined in the operating charter.

### 3. Business interactions

Specialized agents can prepare work across business functions, but execution
stays bounded by risk:

| Function                 | Permitted automation                                        | Owner-gated boundary                                       |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Legal and compliance     | Research, issue spotting, and draft preparation             | Filing, legal conclusions, contract execution              |
| Customer experience      | Routine information, triage, and exception detection        | Refunds, commitments, sensitive-data decisions             |
| Vendors and supply chain | Forecasting, status monitoring, and draft requests          | Purchases, pricing agreements, binding negotiations        |
| Marketing and B2B        | Research, segmentation, drafts, and charter-compliant sends | Claims, unapproved audiences, spend, and policy exceptions |
| Product and engineering  | Diagnostics, tests, draft fixes, and approved deployments   | Security, revenue, schema, and charter changes             |

Outbound interaction must use verified contact data, truthful claims, explicit
opt-out handling, and the existing send controls. A prepared action is not
authorization to send, charge, sign, file, or publish.

## Operating progression

Adopt automation in stages:

1. **Observe** — collect evidence and surface exceptions.
2. **Recommend** — propose a bounded action with expected outcome and rollback.
3. **Assist** — prepare drafts, tests, and approval-ready changes.
4. **Execute** — automate only the narrow, reversible action explicitly
   authorized by policy.
5. **Audit** — record outcome, cost, errors, and policy compliance; tighten or
   retire automation that does not produce evidence-backed value.

The first production priority remains the end-to-end DPP revenue loop described
in [Autonomous DPP Revenue Loop](./AUTONOMOUS_REVENUE_LOOP.md). New automation
must not outrun that verified foundation.
