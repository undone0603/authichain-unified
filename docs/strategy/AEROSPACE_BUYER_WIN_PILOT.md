# Aerospace component provenance — buyer discovery and proof-of-value pilot

**Status:** candidate, unshipped. This is a commercial discovery proposition, NOT aerospace certification or a flight-release system. P0 remains the independently paid $299 DPP Readiness sale. Do not attach a mandatory aerospace gate to that checkout.

## Problem to validate
Aerospace supplier-quality teams need to reconcile genuine manufacturer source, authorized distributor, part identity, custody events, test and inspection reports, discrepancies, and controlled hardware release. A signed CoC, scanned QR or ledger entry alone is insufficient. An independent supplier/quality buyer must confirm this is a purchasing priority and budget exists.

## Proposed deliverable
- A **synthetic, no-customer-data prototype** `scripts/ci/aerospace-acceptance.mjs` with 27 adversarial Node tests.
- A bounded AgentZ opt-in workflow `aerospace_preacceptance_pilot` executing **only** these local tests. It never opens a browser or sends outreach and cannot approve parts for flight.
- A candidate paid scope, to negotiate only after discovery: buyer-provided anonymized sample of **one** component/lot, evidence-mapping and discrepancy report, acceptance findings and a validation matrix. No government data, export-controlled drawings, secrets, regulated test records or actual component certification requested. No custom build or flight integration promised.
- A buyer-specific statement of work must define price, timeline, rights, exclusions, acceptance criteria and payment terms **before** a checkout or invoice is issued; the existing $299 DPP readiness product is not repackaged as a certified aerospace inspection.

## Initial buyer discovery based on public evidence
- **Firefly Aerospace** — NASA's Small Business Subcontracting profile explicitly lists a counterfeit parts prevention program as a desired supplier qualification; its public supplier portal has a supplier interest form. This establishes **topic relevance, not buyer interest or a sale**. Source: https://www.nasa.gov/osbp/prime-contractor-firefly/ and https://fireflyspace.com/suppliers/.
- **SpaceX** — a saved Apollo account exists; this does **not** indicate an interested or qualified contact. Do not create an opportunity or count it as pipeline without a verified introduction or explicit reply.
- **Existing AuthiChain product buyers and pilots** — prioritize already engaged, independently interested contacts over unsolicited aerospace claims; this keeps the legitimate $299 path faster.

## Buyer qualification and negotiation
1. Use official supplier/vendor channels first; establish whether a small software evidence-mapping pilot is in scope, whether the buyer requires AS9100/ISO, ITAR, CMMC, insured testing or procurement onboarding, and who controls budget.
2. Request an **anonymized, non-sensitive** evidence example only after approval. Never ask for restricted spacecraft designs or controlled component details.
3. Present a *nonbinding* pilot scope and demo with explicit limits: AuthiChain verifies digital evidence and evaluates anomalies; it does **not** certify hardware or replace the buyer's inspection and release authority.
4. Qualify business authority, exact use case, budget and willingness to pay. Negotiate documented fixed scope and terms, and send a quote only on a valid buyer request.
5. Use an independently authorized paid payment rail. Confirm cleared funds, durable entitlement/delivered report, acceptance evidence and non-founder attribution before recognizing a WIN.
6. Respect `production_send=false`, `humanHold`, $0 discretionary spend and all protected release requirements. No autonomous cold send on a held sender. No CRM 'closed won' until authoritative payment settles.

## Pilot acceptance metrics
- 100% of specified negative fixtures cause `HOLD` with `flightReleaseAuthorized=false`.
- Complete synthetic evidence results only in `ELIGIBLE_FOR_HUMAN_REVIEW` — never flight approval.
- No invented counterfeit verdict from incomplete evidence.
- Runtime source SHA, native CI logs, trusted upstream-source checks, named buyer acceptance, signed scope, payment intent/settlement and actual delivered output are separate records.
- Any missing evidence remains UNKNOWN/PENDING, not success.

## Commercial WIN definition
**Qualified non-founder buyer + signed agreement or checkout + actual settled payment + verifiably delivered and accepted paid output.** A lead, meeting, response, draft, free test, $0 session, pending charge or unfulfilled payment is **not** a WIN.

## MCP-first / A2A-first commercial workflow (operator instruction)

**Default:** When a prospective buyer or authorized representative supplies a usable Model Context Protocol (MCP) endpoint or Agent2Agent (A2A) agent card, prefer permissioned machine-to-machine discovery over speculative outreach. Never assume that a website or organization has either protocol.

1. **Discover:** inspect only public, explicitly published discovery resources or a buyer-provided endpoint. Confirm the official origin/domain and record the UTC observation. A2A agent cards are *untrusted* until host, service identity and card provenance are independently checked.
2. **Authenticate and constrain:** negotiate supported MCP transport/protocol or A2A skills and auth requirements. Do not send AuthiChain keys, buyer data or session secrets to unknown endpoints. Never invoke a write, purchase, quote acceptance, task mutation, booking or messaging skill without the explicit transactional authority required by the buyer and AuthiChain policies.
3. **Qualify:** use read-only `initialize`, `tools/list`, or A2A capability discovery where permitted. Ask only nonbinding questions about applicability, supplier qualification, supported evidence standards, procurement routing and decision-maker identity. Store raw result only in a private evidence ledger; buyer interest remains unverified until an attributable response.
4. **Offer setup if missing:** propose a separately scoped integration package (below) instead of claiming interoperability. No client credentials or production configuration is changed before approved scope, tests and authorization.
5. **Negotiate:** use nonbinding `negotiate` or A2A request/response only when its actual tool semantics guarantee no payment, legal acceptance, disclosure or other effects. A free quote is not an agreement.
6. **Close:** only a genuine buyer-authorized, independently verified settled payment *and* accepted fulfillment counts as WIN. A 402 quote, generated checkout, signed token or tool invocation does not.
7. **Fail closed:** missing endpoint, unsupported transport, insufficient auth, unsigned/unknown response, unavailable budget or unknown settlement = status `UNVERIFIED` and human-readable fallback, never assume success.

### Packaged setup offers — proposal only

| Offer | Scope / deliverable | Commercial boundary |
|---|---|---|
| **MCP Connect** | Discover buyer-supported MCP, prepare an isolated read-only AuthiChain client or server adapter; demonstrate `initialize`, `tools/list`, one free verification read, auth rejection and replay testing; evidence report | Fixed-price quote after compatibility assessment and written scope; no claimed live integration |
| **A2A Connect** | Validate an official Agent2Agent card and skill schema; implement a sandbox agent adapter for provenance and nonbinding negotiation; verify identity, scopes and fail-closed behavior | Fixed-price quote after proof of client ownership and auth; no autonomous purchases |
| **MCP + A2A Launch Kit** | Both adapters plus issuer/JWKS and revocation validation, redacted receipts, deployment runbook, version-pinned smoke suite and handover | Milestone-based quote; no live production rollout until independent test, legal/data review and protected release |
| **No-protocol Evidence Pack** | Share a static, privacy-safe report/JSON schema, fixture, and how-to-start guide so the buyer can evaluate before adopting MCP/A2A | Free public discovery where applicable; paid custom work requires accepted scope |

Each pack requires source ownership, permitted data, agreed acceptance matrix, timeline, support window, rollback, security responsibilities, explicit price and payment milestones before sale. These are service **proposals**, not existing published SKUs. Do not substitute the current **$299 DPP Readiness** product for aerospace certification or promise production deployment.

#### Prospect-safe phrasing

"Do you already operate an MCP endpoint or A2A agent for supplier-quality evaluations? If so, we can first verify read-only discovery and determine whether provenance checks fit your existing workflow. If not, AuthiChain can quote a bounded MCP or A2A setup package with a synthetic evidence test, documented authentication boundaries and a deployment acceptance plan. No flight certification or autonomous procurement is implied."
