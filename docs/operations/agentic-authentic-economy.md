# A grounded reading of the fully autonomous AuthiChain agentic economy essay

Reading date: 2026-10-07. This file is an analysis. It does not change authority, prices, or revenue classification. It does not authorize spend, send, deploy, AgentZ `--mode auto`, a new token, a DAO, or a revenue-ledger write.

Every material claim below about the running AuthiChain or AgentZ system carries exactly one label:

- **demonstrated** — the cited file shows it.
- **supported** — a record states it, and this reading did not re-measure it.
- **estimated** — a numeric forecast. This reading makes none.
- **aspirational** — envisioned, not a present fact.

The fully autonomous economy, agent legal personhood, and agents as economic peers are **aspirational**.

## What is running

**demonstrated.** Uncommitted `src/lib/economic-authority.ts` on this branch defines `agentzExecutionPolicy`. For mode `auto` it returns `allowed: false`, reason `AgentZ --mode auto is frozen`, class `FROZEN`. Modes `confirm` and `dry-run` return `allowed: true`. The file header says the module does not charge, send mail, or invent a Stripe result. That file is not in HEAD and not on `origin/main`. Uncommitted `agentz/core/auto_policy.py` runs uncommitted `scripts/autonomy/agentz-auto-gate.mjs`. If node raises `OSError` or `TimeoutExpired`, or the exit code is not 0 or 3, or stdout is not JSON, the function returns `allowed: false` and class `FROZEN`. A parsed decision whose `allowed` value is not `True` is forced to `allowed: false` and otherwise returned as printed. This analysis does not change that function. AgentZ `--mode auto` stays frozen in this uncommitted resolver.

**demonstrated.** `origin/main` `agentz/cli.py` defaults `run` to `--mode confirm` and refuses `run --all --mode auto`. The same file still lists `auto` among `--mode` choices for a single workflow id. That committed refusal is narrower than the uncommitted resolver above. This analysis does not unfreeze either file and does not edit `agentz/cli.py`.

**demonstrated.** On `origin/main`, `src/lib/generation-seal.ts` issues a generation record whose only claim is `artwork_only`. The statement in that file is: "This record signs that an image was generated. It is not an authenticity verdict for a physical product." `checkGenerationSeal` refuses any other claim (`product_claim_refused`) and refuses a `ProvenanceRecord` type. A signature that checks is `valid-unanchored`, with reasons `signature_valid`, `no_anchor`, and `not_a_product_attestation`. The seal is not an anchor and not a product attestation. The dirty checkout `feat/revenue-operator-skill` does not currently contain that path. This reading cites the copy on `origin/main`.

**demonstrated.** `origin/main` contains `supabase/migrations/20261001191414_agent_action_receipts_v1.sql` in commit `46e7fcdb` (2026-10-03). The migration creates `public.agent_action_receipts`, seals each insert with SHA-256 over the previous row, and raises on update or delete (`agent_action_receipts is append-only`). The table comment calls the rows receipts for side-effecting bot actions. The verdict check allows `approved`, `abstained`, `executed`, `failed`, and `ungated`. A search of `*.ts`, `*.mjs`, and `*.py` in this tree found no caller. The migration is a schema a database can store. It is not a demonstration that every autonomous agent action is gated before it runs.

**demonstrated.** Google Drive document `AE-Patent-Counsel-Brief-v2-2026-10-02` (file id `18iTsdpAb4GZt6WeuRCGL3k7lhxunzN3Kp65zYqQzOd0`, modified 2026-10-05) was opened on this reading. It labels itself confidential and not legal advice. Item 9 names an "agent action receipt chain", places it at "private database only", says "No public disclosure found", and notes a build date of 1 Oct 2026. The brief is dated 2 October 2026. It organizes facts for patent counsel. It does not show a running public gate.

**aspirational.** The essay's sentence that AuthiChain gates every autonomous agent action with an append-only hash-chained receipt is not established by the generation seal, the receipt migration, or that brief.

**supported.** Uncommitted `docs/operations/agentz-mission-replay.md` records no Value Receipt and leaves `$499.95` unbooked. It states that AgentZ `--mode auto` stays frozen. That audit is the working-tree record of the figure, and each mention there refuses to book it. This file repeats that refusal and does not create a receipt. The same audit records HubSpot deal `318384843494` as amount 499, stage `appointmentscheduled`, `hs_is_closed_won` false, last modified 2026-09-20: pipeline state, not cash. It records two sealed livemode Stripe reads on 2026-10-06, both `NO_QUALIFYING_REVENUE`. This analysis does not take a newer snapshot and does not reclassify revenue. Counted verified missions in that audit are 0.

**demonstrated.** `scripts/autonomy/orchestrate.mjs` sets `not_revenue: true` on its simulation. `scripts/autonomy/orchestrate.test.mjs` asserts that flag. This reading does not treat the simulation as cash and does not quote its cash figures as a forecast.

**estimated.** This reading adds no numeric forecast of revenue, customers, or conversion.

**demonstrated.** Uncommitted `scripts/autonomy/orchestrate.mjs`, when assumptions are fresh, ranks `offer_dpp_openclaw` with `executable: true`, `sends_mail: false`, `opens_checkout_session: false`, and checkout URL `https://authichain.com/checkout/dpp_readiness`. `price_usd` comes from `planUsd("dpp_readiness")`. The same function sets `sell_existing_dpp` to `executable: false`. With no named inbox the status is `BLOCKED` on `verified_inbox`. With a named inbox the status is `CANDIDATE` and the block is `explicit send approval; no mail sent`. `scripts/autonomy/orchestrate.test.mjs` asserts those outcomes, including price 299. `sell_existing_dpp` stays non-executable.

**demonstrated.** Uncommitted `workers/authichain-openclaw/src/dpp-offer.ts` trims, lowercases, and removes `?!.,`, then accepts only `dpp`, `buy dpp`, `dpp readiness`, `eu dpp`, and `checkout dpp`. The uncommitted test accepts `EU DPP?` and rejects `run dpp`. The webhook and `/command` paths in `workers/authichain-openclaw/src/index.ts` return that reply. Those call sites are uncommitted edits on this branch. The reply uses `planById("dpp_readiness")` and `gatedCheckoutUrl`. `sends_mail` and `opens_checkout_session` are the constant `false`. The reply does not send mail and does not open a Checkout Session. On `origin/main`, `src/lib/plans.ts` names that plan `EU DPP Workspace` and its description says it is not an audit. The dirty working copy of `plans.ts` names it `EU DPP Readiness Audit`. Uncommitted `workers/authichain-openclaw/src/dpp-offer.test.ts` matches the reply text against that dirty name. That expectation is not the public name, and this analysis does not ship the rename. `dpp-offer.ts` does not hardcode the audit title.

**demonstrated.** On unmerged branch `feat/agentz-right-brain`, `agentz/core/right_brain.py` `propose` always returns `authority_denials` of `denied` for spend, send, deploy, and `AgentZ --mode auto`, and `stops_before_execution: true`. The module text says it does not spend, send, deploy, or change mode. That file is not on `origin/main`.

**supported.** no Value Receipt.

**supported.** $499.95 unbooked.

**demonstrated.** sell_existing_dpp non-executable.

**demonstrated.** The inbound DPP reply sends no mail and opens no Checkout Session.

## What the essay asks for, and what the repo does not ship

The essay's remaining topics are requirements or possibilities. Those topics stay **aspirational**. The README sentence below is **demonstrated** on its own and is not machine-to-machine settlement.

**aspirational.** Human versus machine economic actors, as a purpose-built economy, are not established by the files this reading cites. The essay's table describes agents as lacking legal personhood. No file cited here grants an agent legal personhood.

**aspirational.** Permissionless identity and trustless settlement as agent sovereignty are not in the repo. The generation seal labeled above is not that system.

**aspirational.** An LLM economy in which profile, memory, planning, and action make agents economic peers is not in the repo. The `propose` handoff labeled above stops before execution.

**aspirational.** Decentralized identity and reputation staking, including reputation as collateral, are not in the repo.

**aspirational.** Agentic free cash flow (A-FCF) and agentic value tokens (AVT). No accounting standard and no token of those names is defined here. This file does not create one.

**demonstrated.** `contracts/README.md` says owner address `0xc0d26735fd9e868eacc60400ef3171fa4161177f` is a Coinbase Smart Wallet (ERC-4337) and cannot sign with `ethers.Wallet`. This reading did not re-check that address on chain.

**aspirational.** Gasless agent procurement, batching policies, and machine-to-machine settlement are not that README note.

**aspirational.** Agentic DAOs, on-chain agent voting, and tokenomic proof-of-value. Not in the repo. This file does not found one.

**aspirational.** DePIN and decentralized autonomous machines that hold wallets and pay for their own upkeep. Not in the repo.

**aspirational.** Trusted execution environments, zero-knowledge proofs of agent cognition, and trustless oracles are not the generation seal and are not the receipt migration labeled above.

**aspirational.** Liability models that move from sponsor liability to insurance or self-stake are not implemented here.

**aspirational.** The essay's phased roadmap (DePIN, DID, AVT, A-FCF, agentic DAOs, Layer-2 agent settlement, continuous benchmarking) is not an implementation order.

## What this reading refuses

No customer sentiment is stated. No market size, conversion rate, or death-prevention figure is stated. Qualifying revenue is not updated past the sealed reads already written in `docs/operations/agentz-mission-replay.md`. `$499.95` is not cash and not verified attributed value. No mail is sent by this document.
