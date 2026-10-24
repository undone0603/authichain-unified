# Company substrate

The knowledge graph, agent control plane, and revenue flywheel are one projection. They are not a second control plane.

Authoritative files stay:

| Question | File |
| --- | --- |
| What runs | `docs/OPERATING_CHARTER.md` and `.github/autonomy.json` |
| What the business loops are | `.github/founder-business.json` |
| What a human can buy | `src/lib/plans.ts` |
| What counts as revenue | `classifyRevenue` in `scripts/revenue-operator.ts` |
| Which DPP stage happened | `DPP_LOOP_ORDER` in `src/lib/dpp-loop.ts` |

`node scripts/autonomy/substrate.mjs` prints the projection. `founder-business-pulse` fails if the projection disagrees with those files. Qualifying revenue is always `UNKNOWN` in the printout. A live total comes from `classifyRevenue`, not from this graph.

## How a surface coordinates

AuthiChain, QRON, StrainChain, GovChain, and AgentZ use ledger `authichain-core`. A future surface is allowed only when `authorize` accepts `add_surface` with that ledger, an existing catalogue id, and an existing workflow. A new price, a new workflow file, or a second ledger is refused.

`coordinate(substrate, surfaceId)` returns the offers that surface may sell, with prices copied from `plans.ts` at call time. QRON cannot select `dpp_readiness`. StrainChain Farm is a rail, not a public offer. GovChain has no public offer. `gov-mint` and AgentZ `--mode auto` stay frozen. Live send stays approval-gated.

Checkout slugs that are not catalogue ids live in `PLAN_ALIASES`. `musa_claim_file` charges `made_in_usa_claim_file`. `musa_audit_bundle` charges `made_in_usa_audit_bundle`.

## Flywheel

Company stages are the founder-business loops: acquire, convert, fulfill, retain, operate, improve. Each stage cites workflows already listed in `autonomy.json`.

The only measured revenue proof is the DPP event order: attributed visit through retained. A stage counts from an observable event. After `retained`, the next read is `classifyRevenue`. Spending that result is founder-only. If it is not qualifying, the operator action is `wait_buyer`.

## One orchestrator

`scripts/autonomy/orchestrate.mjs` is the economic layer. Capabilities in that file are replaceable functions. They are not a tree of agents. New commercial work has to pass `why` (revenue, cost, customer value, defensibility, network, automation, risk, or infrastructure) and, in boring mode, has to sell a public plan on `authichain-core`.

`docs/operations/best-case-goal.json` is the saved best case. It uses the top of the published conversion ranges at each loop's kill volume. The cash figure is a simulation. `node scripts/autonomy/orchestrate.mjs --save` writes `best-case-status.json`. Outbound `sell_existing_dpp` stays blocked without a named verified inbox. The ranked action while assumptions are fresh is an inbound OpenClaw reply with the public DPP confirm page. That reply does not send mail.

`docs/operations/founder-freedom-ledger.json` records automations that are already in force. Minutes stay null until someone times them. The calculator turns a measured 45 minutes before and 3 minutes after into 42 minutes a week and 36.4 hours a year. That pair is not a row in the ledger.

## AgentZ

Mission comparison lives in `docs/operations/agentz-mission-replay.md`. That audit is empty until each mission has an evidence chain. It does not promote AgentZ or book revenue.

The desktop codex is one capability, `agentz`, on this brain. Its physics, browser, autonomy, and identity layers stay inside that capability. A task needs a user trigger and stays visible. Credential reads, minting, `$QRON` rewards, auto mode, and a second process are refused. Send, purchase, delete, and deploy stay founder-gated. The codex build table says the desktop entity is not started. Repo handlers that import `browser_use` are not that desktop product.
