# AgentZ integration progress

Factual checkpoint so the next session can resume without rediscovery. No
secrets or sensitive outputs belong here.

## Baseline (2026-11-22)

| Item | Value |
| --- | --- |
| Source revision | `b4afbb3fc7a44dee4f7b2b2b1b8f58a9e4dcc883` (origin/main) |
| Work branch | `feat/agentz-capability-registry` |
| Port 8000 runtime (reconciled at source and dependency level 2026-11-22; see runtime-reconciliation-2026-11-22.md) | uvicorn `agentz.api.main:app`, cwd `~/worktrees/agentz-pinned-5ab5e2c93`, worktree HEAD `5ab5e2c9`, clean. Process identified only. It has **not** been reconciled with a protected build artifact, so the owner pause on host-executable verifier and signer features still applies. |

## Capability registry

`agentz/capabilities/registry.yaml` lists 21 capabilities. List them with
`python -m agentz.cli capabilities list`.

| Status | Count | Notes |
| --- | --- | --- |
| AVAILABLE | 11 | 7 free hosted MCP tools, the A2A agent card, the on-chain x402 revenue counter, the verify_request workflow, and the settlement proof |
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
  Root cause found: the worker compares non-uuid ids against uuid columns
  (`auth_seals.id`, `authichain_attestation_records.seal_id`), so PostgREST
  rejects the whole filter. A random uuid returns `not_found`, while
  `polygon-anchor-1` and a GTIN-style id return `registry_unavailable`. Fixed in
  PR #2704 (`fix/registry-uuid-filters`), not yet merged or deployed.

### 7. First real x402 purchase attempt (2026-11-22)

- Buyer wallet `0xC9514F6A3fe5394C9f3ce3D0AfeA532DCa712f65`, created for this
  test, key held outside the repo. The owner funded it with 0.10 USDC on Base.
- The owner-supplied one-shot client validated the live quote and made one paid
  `POST /api/x402`. Result: HTTP 402 `facilitator_http_403`. No funds moved;
  the buyer still holds 0.10 USDC.
- A freshly signed authorization from the same wallet returns
  `isValid: true` at PayAI `/verify` in both v2 and v1-flattened form, so the
  buyer side works and the refusal is at `/settle`.
- PayAI documents `/settle` 403 for exhausted merchant credits. Its credits
  endpoint reports this payTo as `low`, not exhausted, so an edge block is
  also possible. PR #2705 keeps the facilitator's refusal reason so the next
  attempt names it.
- **Cause confirmed.** A $0.01 payment through a local Express merchant using
  `@payai/facilitator` on Base mainnet returned PayAI `errorReason:
  free_tier_exhausted` for the payTo: its 1,000 free credits are used up. No
  funds moved.
- **Owner action required:** top up PayAI credits for the payTo at
  merchant.payai.network, then set `PAYAI_API_KEY_ID` and `PAYAI_API_KEY_SECRET`
  on the settling server. A Base settlement costs about $0.0015 in credits.

### 8. First settled x402 payment (2026-11-22)

- On the owner's instruction, the buyer wallet bought a PayAI API key and 1,000
  credits for $1.00 USDC on Base (tx
  `0x26ca6b8135847970f2cc16db0bef77213a970277bb4588b90ef2f984440327b3`). The
  key is stored outside the repo in the local merchant's owner-only `.env`.
- The local Express merchant (`@x402/express` + `@payai/facilitator`, Base
  mainnet, payTo = AuthiChain) restarted with the key and settled a $0.01
  payment: HTTP 200 with the paid body, PayAI `success: true`, tx
  `0x0282230d0980dd13e68e6ad38fe7900b0dfa83e7ead7cea461cc62be00c902fe`.
- `capabilities revenue --days 0.1` confirms on-chain: 1 x402 settlement,
  0.01 USDC. This is a self-test (the owner funded the buyer), not customer
  revenue, but it proves the full x402 path settles once PayAI credits exist.
- authichain.com production still settles without PayAI credentials. It needs
  JWT auth headers in `settlePayment` and the key as a Worker secret, which is a
  code change plus an owner-approved deploy.

### 9. Cryptographic settlement proof and keccak tests (2026-11-22)

- **Implemented.** `agentz/integrations/settlement_proof.py` and
  `capabilities prove-settlement <tx>`. From the receipt and block it checks:
  success status, block hash match, exactly one USDC Transfer to payTo, an
  EIP-3009 `AuthorizationUsed` log by the same payer, and a facilitator-signer
  sender. Event topics are computed with keccak-256 at runtime.
- **Tested.** `agentz/tests/test_settlement_proof.py`, 21 tests: keccak-256
  empty-input vector, a check that it differs from NIST SHA3-256, ERC-20 and
  EIP-3009 selectors (`transfer`, `balanceOf`, `approve`,
  `transferWithAuthorization` = `0xe3ee160e`), both event topics, the
  counter's hard-coded constants, and every proof failure mode.
- **Live proofs** in `docs/agentz/evidence/settlement-proofs-2026-11-22.jsonl`:
  the $0.01 local-merchant settlement is proven (5/5 checks, authorization
  nonce `0xa40b654f…0cba7a`); the owner's $1.00 plain send is not proven
  (no AuthorizationUsed log, sender is not a facilitator signer).

### 10. Executor JSON decode on orjson, bottleneck re-measured (2026-11-23)

- **Implemented.** `agentz/core/async_executor.py` now decodes RPC bodies and
  tool text with `_loads`, which uses orjson and falls back to the stdlib. It is
  lossless: any input with a 19-digit run goes to `json.loads`, because orjson
  turns integers above 64 bits (atomic USDC or wei amounts) into floats without
  warning. The request encoder is unchanged: orjson would send NaN as `null`.
- **Tested.** `python -m pytest -q agentz/tests/test_async_executor.py`: 58
  passed. 42 of those are new: stdlib parity on edge cases, 500 random
  documents, the no-orjson fallback, the precision guard, a non-JSON body still
  retried as `transport_error: JSONDecodeError`, and NaN arguments still
  refused before sending. With the guard removed, 6 tests fail.
  `python -m pytest -q agentz/tests`: 516 passed, 1 skipped.
- **Measured.** Decoding is 1.8 to 2.8 times faster in isolation. End to end,
  the change is within noise and the 24,000/min ceiling did not move. A cProfile
  shows that httpcore's per-request pool scan and anyio overhead dominate. See
  `performance.md` (2026-11-23) and
  `docs/agentz/evidence/perf-orjson-decode-2026-11-23.json`.

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

- Port 8000 runtime: source trees and all 183 packages match the protected `75e2c5b5d` artifact; only Python differs (3.12.3 host vs 3.12.16 image). Lifting the pause is the owner's call.
- Financial rails (x402, Stripe) need scoped authorization and signing authority.

## Next safe actions

1. After PR #2704 merges and authichain-com redeploys, re-run `verify_request` with `polygon-anchor-1` and expect attestation `not_found` instead of `inconclusive`.
1. Make the approved $0.05 test purchase once a buyer wallet exists, then confirm it with `capabilities revenue --days 1`.
2. Wire `/control-plane/state` as a read-only registry capability.
3. Inspect StrainChain, GovChain and GS1 code and classify them with evidence.
4. Read-only customer entitlement visibility, without charging.
5. Executor throughput: shard the httpx pool or trial an aiohttp transport,
   then re-run `mcp_bench ramp --levels 12000,24000 --concurrency 128` before
   and after (`performance.md`, "Candidate fixes, re-ranked by the profile").
   JSON decode is done and ruled out.

Note (2026-11-23 routine): `api.taskmarket.dev` and `authichain.com` are not
reachable from the cloud routine sandbox (proxy 403). Live-endpoint items
(taskmarket pick, verify_request re-run) need the owner's host.
