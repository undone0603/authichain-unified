# Economic Constitution + Agent OS

Status: **DESIGN LAW**, bound to implemented controls.  
Date: 2026-10-06.  
Repo: `undone0603/authichain-unified`.  
Company: AuthiChain, Inc. Founder-only. One owner.

This file is the economic constitution and the agent operating system. It is not a business plan. It does not assert revenue, autonomy, or a live customer. Each rule below is marked:

| Mark | Meaning |
| --- | --- |
| IMPLEMENTED | Code, workflow, or charter gate exists and is the current rule |
| PARTIAL | A piece runs; the full loop does not |
| DESIGN | Specified here; not enforced by code yet |
| FROZEN | Explicitly refused by `scripts/revenue-operator.ts` |
| UNKNOWN | No live measurement in this document |
| CONTRADICTION | Two sources disagree; a canonical line is chosen below |

## 0. Precedence

When sources disagree, use this order:

1. A founder decision recorded in `docs/OPERATING_CHARTER.md` and switched in `.github/autonomy.json`.
2. Money classification in `classifyRevenue` (`scripts/revenue-operator.ts`).
3. The public catalogue in `src/lib/plans.ts` (`PUBLIC_PLAN_IDS` and `PLANS`).
4. This constitution.
5. `.github/founder-business.json` for loops and metrics, except where it is older than (1).
6. `docs/launch-governor.md`, `docs/AUTHENTIC_AGENTIC_ECONOMY.md`, and `docs/UNIFIED_ARCHITECT_AGENT.md` as design or partial systems.
7. Pitch decks, grant drafts, and agent prompts. They are not capabilities.

This file does not override (1)–(3). A change to prices, autonomy lanes, or the money classifier is a founder-gated edit of those files, then a pull request.

The company substrate (`docs/operations/SUBSTRATE.md`, `scripts/autonomy/substrate.mjs`) is a projection of (1)–(3). It is not a sixth source of truth. Surfaces coordinate by calling that projection. They do not keep a private ledger, price, or agent mode.

---

# A. Economic Constitution

## Article 1 — Ownership and authority

Ownership, legal accountability, and emergency override stay with the founder.

Four words are different jobs:

| Word | Holder now | What it means |
| --- | --- | --- |
| Ownership | Founder | Equity, accounts, IP, bank, Stripe account owner |
| Authority | Founder, delegated only by written gates | Who may change law, prices, secrets, DNS, schema |
| Execution | Workflows and agents inside those gates | Who may run a listed action |
| Governance | This file + charter + `autonomy.json` | How a rule changes |

Consensus, reputation, token votes, and protocol governance are **DESIGN**. They do not move ownership.

No agent, model, GitHub Action, Cloudflare Worker, or AgentZ process owns the company, holds a signing key for the founder, or may distribute founder cash.

## Article 2 — Mission

AuthiChain is a verification layer for claims about physical goods and documents.

The economic unit is one **signed seal** plus a public verification receipt, a payment entitlement, and an evidence record. Brands are surfaces on that unit:

| Surface | Job | Status |
| --- | --- | --- |
| AuthiChain | Seal, verify, checkout, DPP and Made-in-USA offers | IMPLEMENTED catalogue and checkout paths |
| QRON | AI QR generation packs and the $19/mo launch plan | IMPLEMENTED as plans in `plans.ts` |
| StrainChain | Cultivar passport from the customer's own certificates | IMPLEMENTED as `strainchain_passport` |
| GovChain | Same seal, government-buyer copy | DESIGN / copy. Not FedRAMP. Not a SAM registration |
| Nightstamp | Scan gate workflow (`nightstamp-scan-gate.yml`) | PARTIAL. A workflow exists. A product economy is not proven |
| EU DPP | `dpp_readiness` $299 readiness audit | IMPLEMENTED as a one-time SKU. Not a law firm |
| Made in USA | Claim file $299/SKU and audit bundle $2,500 | IMPLEMENTED SKUs. Substantiation support, not legal advice |
| TrueMark / TruMark | Name present in the wider corpus | UNKNOWN as a shipping SKU. Not in `PUBLIC_PLAN_IDS` |
| x402 agent verify | Described as `POST /api/x402` | PARTIAL design. `$QRON` in `accepts[]` and live buyback are FROZEN |

Separate brands do not get a second trust stack, a second customer database, or a second ledger.

## Article 3 — What a seal is allowed to say

IMPLEMENTED claim boundary, from `docs/AUTHENTIC_AGENTIC_ECONOMY.md` and the plan feature lines:

A seal proves that the record the issuer signed has not changed since the signature. It does not prove a laboratory result, a government approval, that the physical item was never swapped, or that a legal standard is met.

Forbidden commercial sentences, until a cited artifact makes them true:

- A named customer, partner, certification, or result that is not verifiable (charter).
- "METRC replacement" for StrainChain.
- "FedRAMP" or "we are SAM.gov" for GovChain. The SAM record named in `docs/project/SAM_PREP.md` is a company registration fact, not a product certification.
- Legal advice on DPP or Made in USA.
- "Signed verification is live" on QRON Starter, Launch, or Creator. Those feature lines say the signed path is **in development**.
- On-chain issuance as a current Theater feature. The plan text says issuance is in development. The Polygon contract address in that feature line is a pointer, not proof of issuance volume.
- Revenue, MRR, or a subscriber, unless `classifyRevenue` returns `qualifying: true` on a live snapshot whose email is not a founder address.

## Article 4 — Money truth

IMPLEMENTED. `classifyRevenue` is the only function that may call a Stripe object "revenue" for operator decisions.

A record qualifies only when all of these hold:

- Livemode data is in the snapshot the function received.
- The email is not an exact address in `DEFAULT_FOUNDER_EMAILS`.
- Either a subscription is `active`, `trialing`, or `past_due` and has that email, or a charge is `paid` with `amount > 0` and that email.
- A payout counts only together with a non-founder paid charge. A payout alone does not qualify.
- A subscription with no email does not qualify.

Founder charges, founder subscriptions, empty lists, HubSpot deals, Airtable rows, Apollo rows, proposals, and "pipeline" are not revenue.

As of this document, qualifying revenue is **UNKNOWN**. This file does not invent a charge. The operator action when rails are healthy and revenue is not qualifying is `wait_buyer`, which is a gate, not a finished state. The next commercial action is `send_one` only when `classifySend` allows a named, verified inbox.

`decideOperatorAction` returns exactly one of: `fix_rails`, `qualifying`, `send_one`, `refuse_send`, `wait_buyer`.

## Article 5 — Product truth

IMPLEMENTED catalogue. `PUBLIC_PLAN_IDS` is the public list. Prices below are the `PLANS` prices read on 2026-10-06. Stripe price IDs live in `plans.ts` and are not repeated here.

| Plan id | Price | Cadence | Buyer receives | Public |
| --- | --- | --- | --- | --- |
| `free` | $0 | — | 5 signed generations, lookup verify only | Yes |
| `qron_launch` | $19 | monthly | 100 generations / month | Yes |
| `starter` | $29 | one time | 100 generations | Yes |
| `creator` | $99 | one time | 500 generations | Yes |
| `dpp_readiness` | $299 | one time | Written EU DPP readiness assessment, self-serve activation, 50 generations | Yes |
| `strainchain_passport` | $49 | one time | One cultivar passport from the customer's certificates | Yes |
| `made_in_usa_claim_file` | $299 | one time, quantity to 25 | Substantiation file for one SKU | Yes |
| `made_in_usa_audit_bundle` | $2,500 | one time | Supply-chain review engagement, up to 10 SKUs | Yes |

Present in `PLANS` and **not** public:

| Plan id | Price | Why it is not a public offer |
| --- | --- | --- |
| `strainchain_farm` | $149/mo | Stripe price and payment link exist. Absent from `PUBLIC_PLAN_IDS`. Farm checkout HEAD is a rail probe, not a catalogue promotion |
| `theater_1` | $499/mo | `listed: false` |
| `theater_3` | $1,499/mo | `listed: false` |

`studio` and `business` exist on the `PlanId` type and are not rows in `PLANS`. They are not offers.

Agents may create a checkout session for a public plan. Agents may not create a price, change a price, add a SKU, issue a refund, or comp an invoice. The charter's narrow exception is the webhook event list in `autonomy.json` `stripe_webhooks`, reconciled by `stripe-webhook-reconcile`.

The DPP feature line that credits $299 toward "AuthiChain Basic" names a plan that is not in `PUBLIC_PLAN_IDS`. Treat that sentence as **UNVERIFIED** until code applies the credit. Do not add AuthiChain Basic to the catalogue to make the sentence true.

## Article 6 — One core, many surfaces

DESIGN target, already the direction of the shipping checkout:

```
issuer record
  → Ed25519 seal (+ optional chain anchor)
  → QR or URL
  → /verify or agent verify
  → Stripe entitlement or one-time provision
  → evidence packet
  → usage event
```

Reusable core: verification, attestation, passport document, checkout, webhook fulfillment, outreach guard, ops pulse.

Not reusable as separate companies: QRON, StrainChain, GovChain, DPP, Made in USA, Nightstamp. New vertical work maps fields onto the seal. It does not fork the ledger.

## Article 7 — Commercial loop

Each step has an owner. "Owner" means the system that is allowed to act, not a human hire.

| Step | Owner | Trigger | Input | Output | Store | Class |
| --- | --- | --- | --- | --- | --- | --- |
| Discover | `b2b-outreach`, `gov-ingest`, SEO workflows, GrowthScout | Schedule | Public pages, inbound, SAM-style notices | Prospect row with source | CRM via `scripts/revenue-crm.ts` | PARTIAL |
| Qualify | Launch Governor score or warm-lead path | New row | Prospect + offer fit | Score. Below 60 does not enter AgentZ outreach (governor design) | AgentZ logs | PARTIAL |
| Package | Existing plan only | Qualified pain matches a `PUBLIC_PLAN_IDS` row | Plan id | Checkout URL from `gatedCheckoutUrl` | `plans.ts` | IMPLEMENTED |
| Market | `gen-seo-pages`, `content-publish`, `marketing-autonomous` | Schedule | Owned pages | Published page on an owned channel | Repo + site | PARTIAL |
| Sell | `revenue-cycle`, `send_one`, manual playbook | `decideOperatorAction` | Verified inbox or warm lead | One compliant email or a checkout link | Resend events, send-guard | PARTIAL |
| Collect | Stripe Checkout | Buyer pays | Public price | `checkout.session.completed` | Stripe | IMPLEMENTED path. Volume UNKNOWN |
| Provision | Webhook fulfillment | Paid session | Session metadata | Entitlement, DPP packet, or passport job | Supabase `subscriptions` via REST; DPP fulfillment without DB | PARTIAL |
| Activate | Product surface for that SKU | Provision ok | Entitlement | First generation, passport, or audit packet | Product DB | PARTIAL |
| Measure | `ops-pulse`, founder-business metrics | Hourly / weekly | Live sources | Digest or one `ops-alert` issue | GitHub issues | PARTIAL. Several metrics UNKNOWN |
| Retain | `invoice.payment_failed`, `revenue-cycle` dunning, `winback` | Failed invoice | Stripe customer | Dunning mail. Win-back discount only if `WINBACK_PROMO_CODE` exists | Stripe + mail | PARTIAL |
| Expand | DESIGN | Usage or second SKU fit | Customer record | Offer of a higher public plan | — | DESIGN |
| Learn | `gemma-loops`, `ci-repair-loop` | Schedule or red CI | Templates, failed checks | Suggestions or a draft PR | GitHub | PARTIAL. Gemma writes suggestions only |

Human steps that remain, and why:

| Step | Why a human remains | Removal condition |
| --- | --- | --- |
| Price and SKU edits | Charter forbids autonomous Stripe catalogue writes | Founder edits `plans.ts` and Stripe, then merges |
| Refunds | Cash leaving the account | Founder action in Stripe. No agent tool |
| Production migrations | Schema is irreversible enough to gate | Founder merges the migration. See Cloudflare-first baseline |
| DNS, Access, secrets, Vercel | Credential and edge control | Founder |
| Government bid signature | Legal commitment | Founder signs. `gov-engine` may digest |
| Cold-mail resume after the breaker | Reputation latch | Founder adds the `approved` label |
| Made-in-USA legal review inside the $2,500 bundle | Licensed-professional work | A licensed human. The Legal agent may only flag |
| First non-founder revenue judgment | Must be `classifyRevenue`, not a narrative | Run the classifier on a live snapshot |

## Article 8 — Outreach law

IMPLEMENTED stack. All of these apply at once. None cancels the others.

1. Scheduled cold email needs `cold_outreach.enabled: true` and repo variable `OWNER_LIVE_SEND=true`.
2. Cap: `max_new_prospects_per_day` is 10, except during launch mode, where `cold_outreach_cap` is 25. Launch mode is `enabled: true` and `expires: 2026-10-31`. After that date the cap falls back. CI rejects a window longer than 90 days.
3. Segments rotate through `qron`, `strainchain`, `govchain`. Never `all`, `partners`, or `high_leverage`.
4. At most one follow-up per prospect.
5. Deliverability breaker: trailing 7 days, bounce rate above 3% after at least 10 sends, or one spam complaint, forces a dry run. If Resend cannot be read, nothing sends.
6. `server/outreach/send-guard.ts`: verified or opt-in address only, no guessed address, no role inbox, MX check, CAN-SPAM footer and physical address, recordable opt-out, send-history dedupe.
7. `mayDisableOutreachApproval(false)` is refused. `REQUIRE_OUTREACH_APPROVAL` stays on.
8. `classifySend` refuses a missing inbox, a founder inbox, and any address `assessRecipient` rejects.
9. CRM rows pass through `scripts/revenue-crm.ts` before anyone treats them as people. A company name is not an inbox.
10. AgentZ `--mode auto` is FROZEN (`mayRunAgentzAuto`). `gov-mint` is FROZEN.
11. Copy may not invent customers, certifications, results, or urgency. Templates live in `scripts/lib/b2b-templates.ts`.

Known history, kept on purpose: an earlier automated campaign had zero replies and a 16% bounce rate because addresses were guessed. The provenance gate exists so that path stays closed.

## Article 9 — Ship and repair law

IMPLEMENTED.

- Deploy of code that passed required checks may proceed through the existing Cloudflare workflows.
- Merge autopilot is on. Trusted authors are `undone0603` and `dependabot[bot]`. A green, clean, non-draft, non-fork pull request merges, including changes to security, revenue, schema, and this charter family. The owner decision date is 2026-10-02. Stop one PR with the `hold` or `do-not-merge` label. Stop the lane by setting `merge_autopilot.enabled` to false.
- `ci-repair-loop` may open draft fix PRs. It does not merge them by itself. The autopilot merges once they are ready and green.
- Gemma may comment. Gemma may not merge, send, charge, or edit code.
- Silence is the healthy signal. Failure opens one GitHub issue labelled `ops-alert`. Recovery closes it. Approval waits open one `approval-needed` issue. Only an owner-applied `approved` or `denied` label counts.

## Article 10 — Capital law

DESIGN, except the prohibitions, which are IMPLEMENTED.

Every dollar that `classifyRevenue` has not qualified is not allocatable revenue. Founder payments are not allocatable revenue.

When a non-founder dollar is qualified, classify it in this order. Percentages are the rule once measurement exists. The inputs are UNKNOWN until the founder-business metrics are read from live sources:

| Bucket | Rule | Status |
| --- | --- | --- |
| Tax and reserves | Set aside before any other split. Rate UNKNOWN until a prepared return or accountant figure exists | DESIGN |
| Operating costs that keep checkout, mail, and verify up | Pay first | DESIGN |
| Infrastructure and AI compute | Cap at a share of collected revenue. Share UNKNOWN | DESIGN |
| Security | Non-zero floor once revenue exists. Floor UNKNOWN | DESIGN |
| Customer acquisition | May rise only under the predicate below | DESIGN |
| Product work on the existing core | Preferred over a new brand | DESIGN |
| Experimental capital | May be zero | DESIGN |
| Founder distribution | Founder-only. No agent initiates a payout, transfer, or buyback | IMPLEMENTED prohibition (`$QRON` buyback frozen; no payout tool in the operator) |

Acquisition-budget predicate (DESIGN):

```
IF qualifying_customers >= 1
AND gross_margin is measured and > 0
AND logo_churn is measured and below the threshold set in the experiment registry
AND ops-alert for checkout and verify is closed
AND cold-outreach breaker is clear
THEN acquisition cap may increase by one step (the launch-mode step is the only step that exists today: 10 → 25/day)
ELSE experimental spend and cold-email cap stay at the pre-launch default
```

Runway predicate (DESIGN):

```
IF cash runway is unmeasured
OR runway < 90 days
OR breaker tripped
OR a refund or dispute opens
THEN set experimental capital to 0 and cold cap to the non-launch default
```

No autonomous treasury moves money. Classification is a report. Movement is founder-only.

## Article 11 — Identity of the company in one sentence

AuthiChain sells a small set of public, priced checkout offers that provision a signed record and a verification path, and it may tell qualified strangers about those offers only inside the outreach law.

Anything that does not fit that sentence is a proposal.

## Article 12 — Objective lock

DESIGN intent, PARTIAL enforcement.

Agents may not silently change: mission, founder identity, `DEFAULT_FOUNDER_EMAILS`, `PUBLIC_PLAN_IDS`, prices, `FROZEN_DISPATCH`, the outreach prohibitions, or Articles 1–4.

Enforcement today is review plus CI, not a technical lock. Merge autopilot will merge a green PR from a trusted author that edits those files. That gap is the founder decision at the end of this document.

## Article 13 — Self-improvement bound

The loop is: observe → measure → diagnose → hypothesize → experiment → validate → implement → monitor → roll back.

IMPLEMENTED pieces: ops-pulse, CI, draft repair PRs, Gemma suggestions, autonomy reconcile.

An experiment may not weaken Article 3, 4, or 8 to get a faster measurement. Kill a commercial experiment when its own kill line hits. The battery and generate loops in `docs/AUTHENTIC_AGENTIC_ECONOMY.md` already state kill lines (500 sessions / 30 days / 0 paid, and 200 generate submits / 30 days / 0 paid). Those lines are DESIGN until a job reads the events and stops the spend.

---

# B. Contradiction ledger

| ID | Claim A | Claim B | Newer / more authoritative | Canonical position |
| --- | --- | --- | --- | --- |
| C1 | The gate name `merge_security_revenue_schema_or_charter_changes` used to sit in `founder_only_gates` | Charter, 2026-10-02, and `merge_autopilot.enabled: true`: a trusted green PR merges those paths. The name is removed from active decision logic. Pulse fails if it is put back | Charter + `autonomy.json` remain the switch. Merge autopilot is unchanged: trusted green PRs still merge | Do not tell an agent that the old gate name blocks a merge |
| C2 | Charter allows agents to post to channels the company owns | `founder-business.json` lists `live_social_posts` as founder-only. The X posting skill says this chat drafts only | Charter is newer than a blanket freeze. The X skill is the channel rule for X | Owned-site SEO and content workflows may publish. Live X posts are approval-gated and are not sent from this operator |
| C3 | `autonomy.json` `founder_emails` includes the token `@authichain.com` | `isFounderEmail` compares the full string. `DEFAULT_FOUNDER_EMAILS` is two exact mailboxes | The classifier is the money function | Only the exact addresses in `DEFAULT_FOUNDER_EMAILS` are founder emails for revenue. The `@authichain.com` token does not exclude a domain |
| C4 | `founder-business.json` offer ids `musa_claim_file` and `musa_audit_bundle` | `plans.ts` ids `made_in_usa_claim_file` and `made_in_usa_audit_bundle` | `plans.ts` is product truth | Use the `made_in_usa_*` ids. The `musa_*` ids are stale labels |
| C5 | Founder-business offer list omits `creator` and `free` | `PUBLIC_PLAN_IDS` includes both | `plans.ts` | Both are public. Creator is $99 one time. Free is 5 generations |
| C6 | `AUTHENTIC_AGENTIC_ECONOMY.md` public money table omits QRON Launch, Made in USA, and lists Farm as a footnote after the first paid seal | `plans.ts` lists Launch and Made in USA as public, and Farm as non-public | `plans.ts` is later and is the catalogue (Made in USA added 2026-09-29; Launch is in `PUBLIC_PLAN_IDS`) | Sell the eight public ids. Do not promote Farm or Theater |
| C7 | Launch Governor: outbound is approval-gated until deliverability is proven | Charter: autonomous first-touch is allowed inside the cap and breaker (owner decision 2026-09-23) | Charter is the operating rule for scheduled mail. Governor is the AgentZ design | Scheduled `b2b-outreach` may send inside Article 8. AgentZ auto mode stays frozen. PilotCloser does not get a bypass |
| C8 | DPP feature copy credits the fee toward "AuthiChain Basic" | No public plan with that id | Catalogue wins | Do not bill or promise a Basic plan. Credit application is UNVERIFIED |
| C9 | Unified Architect Agent (`server/agents`) describes an orchestrator of four agents | AgentZ specialists and GitHub lanes are the systems with runners | Lanes are deployed. AgentZ specialists exist as Python classes. The Unified Architect doc is a framework description | Do not route production work through the Unified Architect doc. Route through charter lanes and AgentZ dry-run or confirm |
| C10 | User corpus names SI, SIphER, copSI, Guardian, Archivist, Sentinel, Arbiter as executives | Code has ProtocolGuardian, LaunchBuilder, GrowthScout, PilotCloser, RevenueOperator, TrustHealer, ConversionOptimizer | Code | Map names in the Agent OS table. SI-family systems are EXPERIMENTAL and have no permissions |

---

# C. Company graph

```
Founder
  owns → AuthiChain, Inc.
  writes → autonomy.json, plans.ts, secrets, DNS
  reads → owner digest, ops-alert, approval-needed

AuthiChain core
  exposes → /verify, /checkout/:plan, Stripe webhook, evidence packet
  bills through → PUBLIC_PLAN_IDS
  classifies cash with → classifyRevenue

Surfaces (no separate ledger)
  QRON → free, qron_launch, starter, creator
  StrainChain → strainchain_passport (farm rail exists, not public)
  DPP → dpp_readiness
  Made in USA → claim file, audit bundle
  GovChain → copy + gov-engine digest (signature stays founder)
  Agent verify / x402 → described, buyback frozen

Control plane
  charter + autonomy.json lanes: ship, health, revenue, growth, repair, manual, retired
  launch_mode until 2026-10-31
  merge_autopilot
  AgentZ governor (partial, auto frozen)

Customers (classes, not a claim that any class has paid)
  self-serve generator (QRON)
  cultivar / CoA holder (StrainChain)
  EU DPP readiness buyer
  Made in USA claimant
  government opportunity (digest only)
  future agent caller (x402)

Explicit non-edges
  CRM count ──x──→ revenue
  founder charge ──x──→ revenue
  pitch-deck SKU ──x──→ PUBLIC_PLAN_IDS
  AgentZ auto ──x──→ production side effects
  gov-mint ──x──→ dispatch
```

---

# D. Agent OS

## D1. Classes of action

| Class | Rule |
| --- | --- |
| AUTOMATIC | Listed in an `autonomy.json` lane as `on`, and not in Article 8's extra guards, and not FROZEN |
| APPROVAL REQUIRED | `approval-needed` label, `confirm` mode, or a breaker latch |
| FOUNDER ONLY | Article 1 gates: prices, SKUs, refunds, migrations, DNS, Access, secrets, Vercel, unverifiable claims, founder payout, legal signature, emergency stop |
| FROZEN | `gov-mint`, AgentZ `--mode auto`, `$QRON` buyback, `$QRON` added to x402 `accepts[]`, `REQUIRE_OUTREACH_APPROVAL=false` |

## D2. Hierarchy

The operating shape is one founder, one control plane, and replaceable capabilities. The tree names those capabilities. It does not grant a permission that D1 or `agentzExecutionPolicy` refuses. SI stays experimental, with an empty permission list.

```
Founder
  └─ Control plane (charter, autonomy.json, classifyRevenue)     IMPLEMENTED
       └─ Lane runners (GitHub Actions)                          IMPLEMENTED
            └─ Launch Governor                                   PARTIAL
                 ├─ ProtocolGuardian
                 ├─ LaunchBuilder
                 ├─ GrowthScout
                 ├─ PilotCloser
                 ├─ RevenueOperator (AgentZ specialist)
                 ├─ TrustHealer
                 └─ ConversionOptimizerSpecialist
       └─ Revenue operator CLI (decide / send_one)               IMPLEMENTED as a classifier
       └─ Gemma                                                  IMPLEMENTED as suggestions, workflow default off until the runner is on
```

There is no deployed CEO agent. The orchestrator is the control plane plus the Launch Governor when someone runs it. Calling a model "CEO" does not grant it these permissions.

## D3. Roster

Permissions are the maximum. A FROZEN mode stays frozen even if a row looks broader.

### Orchestrator

| Field | Value |
| --- | --- |
| Objective | Choose the next legal action that moves a public offer toward a non-founder payment without breaking Articles 3–8 |
| Status | PARTIAL. The function that exists is `decideOperatorAction`, not a general CEO |
| Tools | `scripts/revenue-operator.ts`, autonomy lanes, GitHub issues |
| Permissions | AUTOMATIC for `fix_rails` diagnosis and dry runs. APPROVAL REQUIRED to send. FOUNDER ONLY for law changes |
| Inputs | Rails report, Stripe snapshot, optional named inbox |
| Outputs | One of the five operator actions |
| Memory | Repo files and the snapshot. No hidden objective store |
| Trigger | A revenue-cycle run or an operator invocation |
| Constraints | Never invent a charge. Never treat `wait_buyer` as done |
| Metric | `qualifying` true/false from the classifier. UNKNOWN until a live run |
| Escalation | Rails red → `ops-alert`. Law change → founder |
| Recovery | Re-read rails. Do not retry a refused send with a guessed address |

### ProtocolGuardian

| Field | Value |
| --- | --- |
| Objective | Keep seal semantics and verifier behavior inside Article 3 |
| Status | PARTIAL. Class `ProtocolGuardian` in `agentz/core/specialists.py`. Veto is specified in `docs/launch-governor.md` |
| Tools | Schema checks, conformance fixtures, JWKS and revocation checks |
| Permissions | AUTOMATIC for read and test. APPROVAL REQUIRED for any protocol-semantic write. Veto over protocol-touching workflows |
| Inputs | Fixtures, verifier output, docs drift |
| Outputs | Pass/fail and a block |
| Memory | `agentz/logs/launch_state.json` when the governor runs |
| Trigger | Governor cycle or a PR that touches protocol |
| Constraints | Never widen what a seal proves |
| Metric | Conformance fixtures green |
| Escalation | Semantic change → founder |
| Recovery | Block the workflow. Do not "fix" a failing negative test by deleting it |

### LaunchBuilder

| Field | Value |
| --- | --- |
| Objective | Repair implementation defects inside existing products |
| Status | PARTIAL. Class exists. CI repair drafts are the deployed cousin |
| Tools | Repo edit, draft PR, tests |
| Permissions | AUTOMATIC for lint, format, obvious test fixes, doc drift. FOUNDER ONLY for secrets, destructive DB, billing, security policy |
| Inputs | Red checks, governor tasks |
| Outputs | Draft PR |
| Memory | Git history |
| Trigger | Failed required check |
| Constraints | Do not add a SKU to make a sentence true |
| Metric | Required checks green |
| Escalation | Irreversible infra → founder |
| Recovery | Close the draft if the hypothesis was wrong |

### GrowthScout

| Field | Value |
| --- | --- |
| Objective | Find organizations with a counterfeit, passport, or claim-substantiation problem that matches a public plan |
| Status | PARTIAL. Class exists. Scheduled discovery is the growth lane |
| Tools | Public web, browser budget, CRM write through the named-human path |
| Permissions | AUTOMATIC for research. No send permission |
| Inputs | ICP for the eight public plans |
| Outputs | Prospect with source URL, pain, plan fit, score |
| Memory | CRM row plus source link |
| Trigger | Growth schedule or a founder-named segment |
| Constraints | Score under 60 does not enter outreach. No guessed emails. No role inboxes |
| Metric | Share of prospects that reach a verified inbox. UNKNOWN |
| Escalation | No fit → do not force a pitch |
| Recovery | Drop the row. Do not backfill an email pattern |

### PilotCloser (Sales)

| Field | Value |
| --- | --- |
| Objective | Move a qualified, verified contact to one public checkout |
| Status | PARTIAL. Send path is `classifySend` + charter caps, not an autonomous closer |
| Tools | Templates, Resend via the guard, checkout URL |
| Permissions | APPROVAL REQUIRED for a live send (`send_one` or scheduled outreach gates). No negotiation of price |
| Inputs | Verified inbox, plan id, source |
| Outputs | One email or a refusal reason |
| Memory | Send history, opt-out list |
| Trigger | `decideOperatorAction` == `send_one`, or `b2b-outreach` inside the cap |
| Constraints | Article 8. One offer per message. No fake urgency |
| Metric | Reply and paid checkout. Historical automated campaign: 0 replies, 16% bounce |
| Escalation | Contract, custom scope, or the $2,500 legal review → founder |
| Recovery | `refuse_send` is terminal for that address until a real verification source appears |

### RevenueOperator (Finance)

| Field | Value |
| --- | --- |
| Objective | Answer whether any non-founder livemode money exists, and which single action follows |
| Status | IMPLEMENTED as `classifyRevenue` / `decideOperatorAction`. The AgentZ class is a second, non-authoritative surface |
| Tools | Stripe read snapshot, rail probes, no Stripe writes |
| Permissions | AUTOMATIC to classify. No payout, refund, price, or transfer |
| Inputs | Subscriptions, payouts, charges |
| Outputs | `RevenueVerdict` and `OperatorDecision` |
| Memory | None beyond the snapshot and founder email list |
| Trigger | Revenue cycle, operator CLI |
| Constraints | Founder mail is not revenue. Anonymous subscription is not revenue |
| Metric | Verdict matches a hand audit of the same snapshot |
| Escalation | Qualifying true → founder digest, not a spend spree |
| Recovery | If rails fail, action is `fix_rails` only |

### TrustHealer (Sentinel + incident response)

| Field | Value |
| --- | --- |
| Objective | Detect failed verify, bad deploy, credential expiry, and abnormal scan patterns, then contain them |
| Status | PARTIAL. Class exists. Deployed detector is `ops-pulse` and health workflows |
| Tools | Health probes, rollback of a bad deploy only where the workflow already allows it, quarantine flags |
| Permissions | AUTOMATIC to alert, retry, and open an issue. APPROVAL REQUIRED to disable a customer-facing workflow. FOUNDER ONLY to rotate secrets |
| Inputs | Probe results, webhook failures, scan anomalies |
| Outputs | `ops-alert` or a contained retry |
| Memory | The single open alert issue |
| Trigger | Hourly health, fulfilment watchdog |
| Constraints | Do not page the founder when green |
| Metric | Time-to-close of `ops-alert`. Fulfilment watchdog: every paid checkout accounted for |
| Escalation | Data loss, key compromise, or ongoing cash leak → founder immediately |
| Recovery | Stripe retries failed state writes. Watchdog alerts if a paid checkout stays unhandled |

### Archivist

| Field | Value |
| --- | --- |
| Objective | Keep the evidence, the decision, and the source attached to every claim |
| Status | DESIGN role. The files that perform it today are the charter, this ledger, `docs/INDEX.md`, and git history |
| Tools | Repo docs, issue comments, no production write |
| Permissions | AUTOMATIC to record a source. FOUNDER ONLY to delete history |
| Inputs | A claim |
| Outputs | Source, date, status, owner |
| Memory | Git |
| Trigger | Any new SKU sentence, metric, or customer claim |
| Constraints | An unsourced number is a defect |
| Metric | Every public metric traces to a live read |
| Escalation | Conflict between sources → contradiction ledger |
| Recovery | Prefer the precedence list. Do not average two prices |

### Arbiter

| Field | Value |
| --- | --- |
| Objective | Apply the precedence list when two agents disagree |
| Status | DESIGN. Today the precedence list is this document and the charter |
| Tools | None that mutate |
| Permissions | May block an action that violates a higher source. May not invent a third rule |
| Inputs | Two claims plus sources |
| Outputs | Canonical line and a ledger row |
| Memory | Section B |
| Trigger | Contradiction |
| Constraints | Newer pitch deck does not beat `plans.ts` |
| Metric | Ledger rows resolved or explicitly left open |
| Escalation | Ownership, law, or cash movement → founder |
| Recovery | Leave the higher source in force |

### Legal / Compliance

| Field | Value |
| --- | --- |
| Objective | Flag commitments that need a licensed human |
| Status | DESIGN agent. IMPLEMENTED limits are the "not legal advice" lines and the gov-bid signature gate |
| Tools | Read docs and offer copy |
| Permissions | AUTOMATIC to warn. FOUNDER ONLY to sign, attest to a regulator, or accept a contract |
| Inputs | Offer, customer ask, jurisdiction |
| Outputs | Risk note. No legal opinion |
| Memory | `docs/compliance/` |
| Trigger | Custom claim, government submission, cross-border data ask |
| Constraints | The $2,500 bundle includes a human legal review. The agent does not replace that reviewer |
| Metric | Zero agent-signed legal commitments |
| Escalation | Always, for signature |
| Recovery | Stop the send. Do not soften a disclaimer to raise conversion |

### Customer Success

| Field | Value |
| --- | --- |
| Objective | See a paid session become a first successful use, then a renewal or a second public SKU |
| Status | PARTIAL. Fulfilment watchdog and dunning exist. A success agent does not |
| Tools | Webhook state, entitlement, mail templates |
| Permissions | AUTOMATIC for provisioned follow-up to a paying customer. No cold contact |
| Inputs | Fulfilled session |
| Outputs | Activation event or an `ops-alert` if fulfilment failed |
| Memory | Subscription row and mail log |
| Trigger | `checkout.session.completed`, `invoice.payment_failed` |
| Constraints | Do not upsell Theater or Farm |
| Metric | Fulfilment success rate. UNKNOWN until the watchdog report is read |
| Escalation | Paid and unfulfilled → alert |
| Recovery | Stripe retry. Founder only if the watchdog stays red |

### Growth

| Field | Value |
| --- | --- |
| Objective | Put the eight public offers in front of buyers on owned channels and inside the cold-email cap |
| Status | PARTIAL. Growth lane workflows exist. Results UNKNOWN |
| Tools | SEO generator, content publish, reddit monitor, b2b-outreach |
| Permissions | AUTOMATIC inside lane switches and Article 8 |
| Inputs | Public plan copy |
| Outputs | Pages, posts on owned channels, capped emails |
| Memory | Resend events for the breaker |
| Trigger | Schedules in the growth lane |
| Constraints | Breaker fail-closed. No X Ads assumption. No purchased list |
| Metric | Bounce rate, complaint count, checkout starts. UNKNOWN here |
| Escalation | Breaker trip → latch, founder resumes |
| Recovery | Dry run until the latch is approved |

### Research

| Field | Value |
| --- | --- |
| Objective | Watch regulations, competitors, and verifier failures that change a public offer |
| Status | DESIGN. Grant drafts and competitor memos exist as documents, not as a loop |
| Tools | Public web, repo docs |
| Permissions | AUTOMATIC to write a sourced note. No product change |
| Inputs | EU DPP dates, FTC Made in USA rule, GS1, chain changes |
| Outputs | Note with source, date, and whether a public sentence must change |
| Memory | `docs/` |
| Trigger | Weekly, or a failed conformance pulse |
| Constraints | A regulation note is not legal advice |
| Metric | Notes that cite a primary source |
| Escalation | A required disclaimer change → founder via PR |
| Recovery | Delete unsourced claims |

### AgentZ

| Field | Value |
| --- | --- |
| Objective | Run registry workflows in `dry-run` or `confirm` |
| Status | PARTIAL. CLI defaults to confirm. `--mode auto` and `run --all --mode auto` are refused |
| Tools | `python -m agentz.workflows.runner`, specialist classes, risk firewall |
| Permissions | AUTOMATIC for dry-run. APPROVAL REQUIRED for confirm. FROZEN for auto |
| Inputs | Workflow id, risk class, financial limit |
| Outputs | Log, launch state, blocked action |
| Memory | `agentz/logs/` |
| Trigger | Explicit invocation. Architect cycle in CI is dry-run |
| Constraints | High and critical risk stay in confirm even if a caller asks for auto. Budget is `financial_limit_usd` per workflow per day in the governor design |
| Metric | Side effects in auto mode = 0 |
| Escalation | Protocol veto, budget exceed, missing credential |
| Recovery | Stop the workflow. Do not flip the mode |

The desktop codex is this same capability, status SPEC, not a second company. `scripts/autonomy/orchestrate.mjs` names it `agentz`. Physics, browser, autonomy, and identity stay inside that capability. A step runs only after a user trigger and stays visible. `placeAgentZ` refuses a new process, untriggered background work, credential reads, minting, `$QRON` rewards, and `--mode auto`. Send, purchase, delete, and deploy stay founder-gated. The codex build table marks the desktop entity not started. Repo handlers that import `browser_use` are not that desktop product.

### SI / SIphER / copSI

| Field | Value |
| --- | --- |
| Objective | Collapse two answers to the one resolver. Do not run the company |
| Status | IMPLEMENTED as `generateSplitBrain` in `src/lib/economic-authority.ts`. A disagreement is reported. The first brain wins. SI does not execute the loser |
| Permissions | None. No send, charge, deploy, or AgentZ auto |
| Constraints | Must not be described as running the company |
| Metric | Not applicable until a capability test exists |
| Escalation | Any request to give SI spending, send, or deploy rights → founder, default deny |

## D4. What each agent is denied

Every agent is denied: founder payout, refunds, price edits, secret reads beyond its own runtime binding, DNS edits, production migration apply, legal signature, customer impersonation, disabling the outreach guard, setting AgentZ to auto, minting on the gov-mint workflow, and editing Article 4's definition of revenue.

## D5. Kill switch

FOUNDER ONLY, and IMPLEMENTED as data rather than a single red button:

| Switch | Effect |
| --- | --- |
| `launch_mode.enabled: false` | Restore pre-launch caps and gates |
| `cold_outreach.enabled: false` or `OWNER_LIVE_SEND` unset | Stop scheduled cold email |
| `merge_autopilot.enabled: false` or label `hold` | Stop automatic merge |
| Lane value `"off"` in `autonomy.json` | Reconcile disables that workflow |
| `approval-needed` + `denied` | Keep the latch closed |
| Do not run AgentZ auto | Already frozen in code |

---

# E. Machine-readable spec

```yaml
document: economic_constitution_and_agent_os
version: 1
date: 2026-10-06
status: design_law
bindings:
  charter: docs/OPERATING_CHARTER.md
  autonomy: .github/autonomy.json
  founder_business: .github/founder-business.json
  catalogue: src/lib/plans.ts
  money: scripts/revenue-operator.ts#classifyRevenue
  send: server/outreach/send-guard.ts
public_plan_ids:
  - free
  - qron_launch
  - starter
  - creator
  - dpp_readiness
  - strainchain_passport
  - made_in_usa_claim_file
  - made_in_usa_audit_bundle
prices_usd:
  free: 0
  qron_launch: 19
  starter: 29
  creator: 99
  dpp_readiness: 299
  strainchain_passport: 49
  made_in_usa_claim_file: 299
  made_in_usa_audit_bundle: 2500
qualifying_revenue: UNKNOWN
launch_mode:
  enabled: true
  expires: 2026-10-31
  cold_cap_per_day: 25
  default_cold_cap_per_day: 10
frozen:
  - gov-mint
  - agentz_mode_auto
  - qron_buyback
  - qron_in_x402_accepts
  - require_outreach_approval_false
founder_only:
  - price_or_sku_change
  - refund
  - production_migration
  - dns_access_secrets_vercel
  - unverifiable_claim
  - legal_signature
  - founder_payout
  - emergency_stop
approval_required:
  - live_cold_email_resume_after_breaker
  - agentz_confirm_mode
  - live_x_post
  - custom_contract
automatic:
  - ship_lane_on_green_checks
  - health_probes
  - warm_lead_checkout_link
  - webhook_fulfillment
  - dunning
  - owned_site_content
  - draft_repair_pr
  - gemma_suggestions
  - merge_autopilot_for_trusted_green_prs
```

---

# F. Founder decision required

The constitution's objective lock is not enforced. Merge autopilot will merge a trusted, green pull request that changes prices, the charter, `autonomy.json`, or this file.

DECISION: Should merge autopilot skip control-plane paths?

OPTIONS:

1. Leave the 2026-10-02 rule. Trusted green PRs merge even when they edit the charter, autonomy manifest, prices, or money classifier.
2. Add path exclusions so autopilot skips `docs/OPERATING_CHARTER.md`, `docs/ECONOMIC_CONSTITUTION_AND_AGENT_OS.md`, `.github/autonomy.json`, `.github/founder-business.json`, `src/lib/plans.ts`, and `scripts/revenue-operator.ts`. Other green PRs still merge.

RECOMMENDATION: Option 2. Execution stays automatic. The law that defines money, catalogue, and permission stays founder-merged. Label `hold` remains the one-PR stop for everything else.

CONSEQUENCES: Option 2 delays control-plane fixes by one founder merge. It closes the path where an agent session authenticated as `undone0603` changes the definition of revenue or outreach and the autopilot lands it because CI is green. Option 1 keeps the owner's 2026-10-02 decision and leaves Article 12 as intent only.

REQUIRED AUTHORIZATION: Founder. This document does not change `scripts/autonomy/merge-autopilot.mjs`.

No other decision blocks the constitution. Qualifying revenue stays UNKNOWN until a live `classifyRevenue` snapshot is read. That read is an observation, not a request for a new policy.
