# AgentZ supplier contracts: conditional acceptance, inbound funds only

**Status (2026-11-03): REVIEW-ONLY implementation. NO signing, no external acceptance, no payment or deployment.**

## Operator authority

The business owner authorizes AgentZ to **consider** accepting a contract in which AuthiChain is the service provider/supplier when it can fully perform the contract from its authorized deployed resources, with no outbound spending. This is **not** permission to buy repair parts, pay vendors, issue refunds automatically, submit a supplier purchase order, assume an open-ended SLA, or accept unsigned/unknown buyer promises as binding.

Because an automated electronic-agent agreement can have binding legal effect in Michigan under [MCL 450.844](https://legislature.mi.gov/Laws/MCL?objectName=MCL-450-844), and E-SIGN [15 U.S.C. ` 7001(h)](https://uscode.house.gov/uscode/119-124/title15/s7001/) preserves legally attributable electronic-agent formation, the signing adapter **cannot be enabled** merely by this broad instruction. Legal counsel should approve the contract family and signer mandate; exact terms, recipient, and retention must be established. **Human-readable, retainable terms and a durable signed transaction record are mandatory release gates.**

## Contract qualification

The first possible families are the existing paid Stripe product lines:
- `mcp_a2a_build` — $1,500 one-time Agent Build. Current live Payment Link exists; it does **not** establish fulfillment capability. Must prove complete hands-off build, test, delivery and acceptance.
- `agent_rail_hosting` — $150 Agent Rail Hosting & Monitoring. Current live Payment Link exists; a recurring service must be separately evaluated for indefinite duties and support SLA. This gate rejects auto-renewing or open-ended work.
- `read_only_verification` — first-party verification report only, with no promise of physical authenticity.

No StrainChain or other regulated/issuer-dependent passport may qualify until the separate required issuer authorization and processor rules are proven. A customer must be independently verified and the service must be eligible for the existing payment processor. No made-up funds, charges, signed identities, certifications, or buyer access.

## Preconditions before a binding adapter can exist

1. Verify supplier identity, authority and permitted product family against durable signed issuer records; validate independent counterparty and its authorized signatory.
2. Hash and review the exact legal contract version. Establish explicit consideration, deliverables, acceptance criteria, time limit, liability cap, termination rights, IP/privacy protections, governing law, required disclosures, refund and incident handling. Do not rely on self-asserted metadata.
3. Prove AgentZ can perform **every step** on an authorized revision, independent exact-head CI and external reviewer, realistic simulated positive/negative order, persistence, rate limit, customer access, revocation, error recovery and durable delivery proof. Any third-party purchase or manual issuer dependency fails.
4. Confirm that no contract obligates AuthiChain to pay an outside party, procure or ship goods, make a vendor deposit or incur unbounded liabilities. Required refunds and legally mandatory duties need an approved human process even though automated disbursement authority remains disabled.
5. Require a separately cryptographically scoped **time-limited signer mandate** bound to a contract family, maximum price/liability, legal entity, exact version hash, recipient allowlist and expiry; do not let a public request or model output grant signature authority.
6. A later legally reviewed execution adapter must idempotently store the signed acceptance and notify the counterparty with retention access, before a sale may be counted. No signature can occur from `/negotiate` or AgentZ's current audit workflow.
7. Verify the existing live Stripe payment source and webhook signature; reconcile positive-amount independent customer payment. A Payment Link and self-pay founder test alone do not prove a customer sale.
8. Monitor fulfillment and escalate exceptions. A non-delivered contract is a liability, not revenue completion.

## Implemented now

`assessInboundSupplierContract` in `workers/authichain-com/src/inbound-contract-gate.mjs` returns a fail-closed checklist. A passing **caller-reported** checklist is labelled `PRELIMINARY_REVIEW_ONLY`; not independent proof. Output ALWAYS includes `accepted:false`, `automaticAcceptanceAuthorized:false`, `automaticSpendAuthorized:false` and `legallyBindingAcceptanceSent:false`. The optional `inboundContract` argument on `negotiate` returns this checklist alongside non-binding counteroffers. The AgentZ `inbound_contract_readiness` workflow invokes a local offline tool; it never signs or posts to a supplier.

### Release/rollback gates

This work is a stacked PR on #2318. Do not deploy before #2318 and this branch pass exact-head Node, TS, Vitest, AgentZ Python suites, independent security/legal review and normal protected Cloudflare production release. The new policy is OFFLINE and non-authorizing. No hidden flag or production credential is added. Reject any request that asks to bypass hold or spend. Before enabling a future execution adapter, verify immutable audit, replay handling, owner-approved monetary/liability limits and a tested revocation switch.

## Definition of done

A real **eligible inbound buyer** presents a contract with complete source authority and delivery scope; independent reviews demonstrate software-only fulfillment; payment processor and legal eligibility are confirmed; a narrowly delegated mandate exists; a separate reviewed signer performs exactly one idempotent acceptance; actual customer funds arrive and the verified delivery is accessible. Until then: `HOLD`.
