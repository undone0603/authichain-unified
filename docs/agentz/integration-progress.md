# AgentZ integration progress

Factual checkpoint so the next session can resume without rediscovery. No
secrets or sensitive outputs belong here.

## Baseline (2026-11-22)

| Item | Value |
| --- | --- |
| Source revision | `b4afbb3fc7a44dee4f7b2b2b1b8f58a9e4dcc883` (origin/main) |
| Work branch | `feat/agentz-capability-registry` |
| Port 8000 runtime (unchanged; owner pause in force) | uvicorn `agentz.api.main:app`, cwd `~/worktrees/agentz-pinned-5ab5e2c93`, worktree HEAD `5ab5e2c9`, clean. Process identified only. It has **not** been reconciled with a protected build artifact, so the owner pause on host-executable verifier and signer features still applies. |

## Capability registry

`agentz/capabilities/registry.yaml` lists 20 capabilities. List them with
`python -m agentz.cli capabilities list`.

| Status | Count | Notes |
| --- | --- | --- |
| AVAILABLE | 10 | 7 free hosted MCP tools, the A2A agent card, the on-chain x402 revenue counter, and the verify_request workflow |
| INTEGRATION_READY | 2 | Control plane, taskmarket pick |
| BLOCKED | 5 | Paid x402 verify, paid A2A evidence skill, local /scan verifier (owner pause), x402 settlement, Stripe billing |
| PROPOSED | 3 | StrainChain, GovChain, GS1 resolver. Not yet inspected deeply. |

## Completed slices

### 1. Hosted MCP discovery and free verification

- **Implemented.** `agentz/integrations/authichain_mcp.py` and the
  `capabilities list|discover|call` CLI subcommand.
- **Gates.** A call needs an AVAILABLE, executable, read-only registry entry; an
  autonomous policy capability; live annotations `readOnlyHint=true` and
  `destructiveHint=false`; and arguments that validate against the live input
  schema. 15 s timeout, 3 attempts on network errors, 5xx and 429 only.
- **Tested.** `agentz/tests/test_capability_registry.py`, 18 tests, no network.
  Full `agentz/tests`: 404 passed, 1 skipped.
- **Production evidence (read-only, $0).** `capabilities discover` showed 8 live
  tools and zero drift. `call authichain.mcp.dpp_readiness_check` returned a
  scored result. `call authichain.mcp.verify` was refused before any network
  call.
- **Not yet merged or deployed.**

### 2. A2A agent card discovery

- **Implemented.** `capabilities agent-card` fetches the public card, checks its
  basic fields, and confirms it advertises the registry's MCP endpoint.
- **Tested.** 2 more tests, 20 in the file.
- **Production evidence.** Live card is valid at version 1.3.2. Its only skill is
  `paid-evidence-check`, recorded as BLOCKED.
- **Not yet merged or deployed.**

### 3. Agent-rail revenue counter and sales funnel audit

- **Implemented.** `capabilities revenue --days N` counts settled Base USDC
  transfers into the x402 payTo wallet over a public RPC. Read-only, no keys.
- **Tested.** `agentz/tests/test_x402_revenue.py`, 6 tests, no network.
- **Production evidence (2026-11-22).**
  - 0 payments and 0 USDC received in the last 30 days.
  - The paid rail works: unpaid calls return a valid x402 v2 402 with Bazaar
    metadata, `/api/x402/health` reports bound and trustless, and the
    facilitator supports v2 exact on eip155:8453 plus the bazaar extension.
  - The $10 daily cap is per payer, not a global revenue cap.
  - AuthiChain is absent from the Coinbase x402 Bazaar (0 of 40,158 listings).
  - The live `negotiate` tool returns `price_usd: null` for the paid service.
    Main already returns the live $0.05 terms (PR #2652, merged 2026-11-20),
    but the last successful authichain-com deploy is 2026-11-19 at `6fdbfe5bc`.

### 4. Live A2A quote deployed (2026-11-22)

- Owner approved the redeploy. `deploy-authichain-com.yml` run 45016127980 on
  `b4afbb3f` passed the verify and publish jobs.
- Live `negotiate` for `verify` with a $1 budget now returns `price_usd: 0.05`,
  `within_budget: true` and the full x402 v2 terms. Registry drift is zero.
- The facilitator is `https://facilitator.payai.network`, not Coinbase CDP, so
  settled payments will not by themselves create a Coinbase Bazaar listing.

### 5. Owner test transfer and settlement classification (2026-11-22)

- The owner sent 1.00 USDC from a Coinbase wallet to authichain.base.eth (tx
  `0x70dbaf48dc1244389b1983d2d1e9fcd7f499892313dc68856c3f03f6ef3623b8`, block
  60781634). It proves the payTo wallet receives Base USDC.
- It is **not** an x402 sale and **not** customer revenue: it was a plain wallet
  send of $1.00, not the $0.05 x402 payment, and was not submitted by a PayAI
  facilitator signer.
- The revenue counter now reports `x402_settlements` separately, counting only
  transfers whose transaction sender is a facilitator signer published at
  `/api/x402/health`. Live result: 1 incoming transfer, 0 x402 settlements.

### 6. End-to-end verify_request workflow (2026-11-22)

- **Implemented.** `agentz/core/verification_workflow.py` and the
  `verify_request` handler, registered in `agentz/workflows/registry.yaml`.
  Flow: validate request, plan with approved tools only, call verify_record,
  query_provenance and verify_attestation through `HostedMCPClient.call`,
  combine verdicts (weakest link), write a receipt with execution id, request
  and result digests, and timings.
- **Verdict rules.** Demonstration records and non-production issuers give
  `verified_demonstration_only`, never `verified`. Tool errors and unavailable
  registries give `inconclusive`. Physical authenticity is always `not_inspected`.
- **Run it.**
  `python -m agentz.workflows.runner --handler verify_request --mode auto --params '{"record_id":"polygon-anchor-1","asset_id":"polygon-anchor-1"}'`
  Dry-run returns the plan with no network calls.
- **Tested.** `agentz/tests/test_verification_workflow.py`, 15 tests, no
  network: positive, invalid requests, timeouts, live annotation change, and
  handler dry-run and receipt writing. Full suite: 428 passed, 1 skipped.
- **Production evidence (read-only).** `docs/agentz/evidence/verify_request-2026-11-22.jsonl`:
  - Execution `740b2ec0-1b6a-4901-a3cb-31551724c779`: record verified as a
    demonstration only, provenance `lookup_degraded`, attestation registry
    unavailable, so the combined verdict is `inconclusive`.
  - Execution `3d155640-ae49-471e-b63e-87ede52ef3c4`: record only,
    `verified_demonstration_only`.
- **Production finding.** Live `verify_attestation` returns
  `registry_unavailable`, and `query_provenance` reports `lookup_degraded`.
  The signed-record and attestation registries behind the hosted tools are not
  answering. That needs investigation in the worker, not in AgentZ.

## Owner decisions that unblock agent sales

1. **Done:** authichain-com redeployed.
2. **x402 test purchase still not made.** A plain wallet send does not exercise
   x402. The purchase needs an x402 client that signs the payment authorization,
   for example the x402 fetch client with a buyer key. **Earlier note:** No buyer wallet is configured on
   this machine. AgentZ has no wallet credential, and the payTo and treasury
   wallets must not be used as buyers. A funded buyer wallet key, supplied
   through a protected environment variable, is needed.
3. **Seal supply.** A paid check needs a real seal UUID. Buyers only appear
   where sealed products exist, so issuing seals to real products drives demand.

## Active blockers

- Owner pause: port 8000 runtime not reconciled with its protected artifact.
- Financial rails (x402, Stripe) need scoped authorization and signing authority.

## Next safe actions

1. Make the approved $0.05 test purchase once a buyer wallet exists, then confirm it with `capabilities revenue --days 1`.
2. Wire `/control-plane/state` as a read-only registry capability.
3. Inspect StrainChain, GovChain and GS1 code and classify them with evidence.
4. Read-only customer entitlement visibility, without charging.
