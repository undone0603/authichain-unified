# AgentZ integration progress

Factual checkpoint so the next session can resume without rediscovery. No
secrets or sensitive outputs belong here.

## Baseline (2026-11-22)

| Item | Value |
| --- | --- |
| Source revision | `b4afbb3fc7a44dee4f7b2b2b1b8f58a9e4dcc883` (origin/main) |
| Work branch | `feat/agentz-capability-registry` |
| Port 8000 runtime | uvicorn `agentz.api.main:app`, cwd `~/worktrees/agentz-pinned-5ab5e2c93`, worktree HEAD `5ab5e2c9`, clean. Process identified only. It has **not** been reconciled with a protected build artifact, so the owner pause on host-executable verifier and signer features still applies. |

## Capability registry

`agentz/capabilities/registry.yaml` lists 17 capabilities. List them with
`python -m agentz.cli capabilities list`.

| Status | Count | Notes |
| --- | --- | --- |
| AVAILABLE | 7 | Free hosted MCP tools, verified live in production by tools/list and tools/call |
| INTEGRATION_READY | 3 | Control plane, taskmarket pick, A2A agent card |
| BLOCKED | 4 | Paid x402 verify, local /scan verifier (owner pause), x402 settlement, Stripe billing |
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

## Active blockers

- Owner pause: port 8000 runtime not reconciled with its protected artifact.
- Financial rails (x402, Stripe) need scoped authorization and signing authority.

## Next safe actions

1. Read and validate the A2A agent card from AgentZ, then mark it AVAILABLE.
2. Wire `/control-plane/state` as a read-only registry capability.
3. Inspect StrainChain, GovChain and GS1 code and classify them with evidence.
4. Read-only customer entitlement visibility, without charging.
