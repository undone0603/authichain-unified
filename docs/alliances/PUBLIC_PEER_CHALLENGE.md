# AuthiChain public peer reproduction — no credentials, no payment

Status: **unendorsed technical invitation**. This is NOT an A2A TCK pass, MCP interoperability certification, x402 settlement proof, identity certification, an authenticated agent, an alliance agreement, or a counterfeit detector.

## Why public

AuthiChain's GitLab alliance draft MR !2030 belongs to a **private** project. External operators cannot be assumed to have access. These independently authored public, no-secret fixtures provide an accessible and reproducible way to inspect the public evidence boundaries without repository access grants. They are limited to read-only HTTP GETs. This is a separate public GitHub review surface, not a GitLab merge or production deployment.

## Run

From this PR's exact GitHub head (Node.js 22 or newer; no npm install, wallet, API token, or account):

```sh
node --test scripts/alliances/public-evidence-probe.test.mjs
node scripts/alliances/public-evidence-probe.mjs --live --ref="$(git rev-parse HEAD)" > public-peer-report.json
```

On Windows PowerShell, replace the second line with:

```powershell
$sha = git rev-parse HEAD
node scripts/alliances/public-evidence-probe.mjs --live "--ref=$sha" | Out-File -Encoding utf8 public-peer-report.json
```

The first command uses deterministic, mocked responses and makes **no** outbound requests. The second performs four fixed, read-only GET requests: a published demonstration verifier, an unknown identifier, the published A2A AgentCard, and the official MCP Registry metadata entry. A source outage, rate limit, invalid JSON, or unsupported response is `coverage_unknown`, never `no activity`. The script refuses live traffic unless explicitly given `--live`.

## Optional ARBITER A2A handoff challenge (local, no remote calls)

The [existing ARBITER upstream issue #2](https://github.com/ziolndr/arbiter-agent-routing/issues/2) requests a no-payment peer review. Earlier references to `examples/a2a_agent_card/demo.py` in that issue are **incorrect**. The verified upstream input sample is [`examples/a2a-handoff.json`](https://github.com/ziolndr/arbiter-agent-routing/blob/main/examples/a2a-handoff.json); its public input shape is `{ task, agents: [{name, description, skills}], top_k }`.

The original nine-case AuthiChain fixture lived in a **private GitLab** MR and was not independently accessible. An exact-content copy is now public in **this draft GitHub PR**:

- [Adapter](../../scripts/alliances/arbiter-peer-repro.mjs)
- [Nine-case test file](../../scripts/alliances/arbiter-peer-repro.test.mjs)

Run from this PR checkout, without packages, API keys, wallets, payments, or network:

```sh
node --test scripts/alliances/arbiter-peer-repro.test.mjs
```

The fixture uses a host-provided `trustedGate` callback, tests that only candidates with independently verified identity + host policy authorization + an explicitly observed signed-record transaction commitment enter the ranking field, removes unrelated agent-card/secret fields, rejects inserted/removed/duplicate returned candidates, and always keeps `authorizedHandoff=false`. A signature alone, metadata claim, or ARBITER's ranking is **not authorization**. `mode=local_mock_only` and `paidOrderingInvoked=false` deliberately prevent mistaking this mock for an actual ARBITER execution.

Please report the **exact GitHub commit**, Node version, the first failed assertion if any, and whether the external ARBITER maintainer agrees with this schema. Do **not** claim independent review, integration, upstream acceptance, signed AgentCard validity, A2A TCK, or x402 settlement until it actually occurs. Do not send a duplicate upstream issue or paid ranking call.

## Review the report

Include: exact 40-character git head, UTC execution time, Node version, command, sanitized JSON result, whether the test was independent of the AuthiChain founder, and any reproducible differences. Do not publish credentials, IP addresses, customer records, private task data, or wallet details.

Test report fields have narrow semantics:
- `decision=verified` on `polygon-anchor-1` is an AuthiChain-published **demonstration** result, not independent re-verification of signature, on-chain inclusion or a physical product.
- `decision=not_found` is absence of a record, **never** a counterfeit verdict.
- A discoverable AgentCard is not a signed, authenticated or authorized agent. The A2A TCK is not run here.
- MCP Registry entries are namespace and metadata observations, **not** `initialize`, `tools/list` or `tools/call` conformance results.
- x402 health or discovery is not a verified purchase, settlement or service delivery. This probe deliberately does **not** initiate payment.

Independent reviewers are invited to report **failures as well as passes** on this PR; a public comment is not automatically a partnership or certification. No unsolicited outreach is required.

## Release boundaries

This PR makes no production changes and needs not merge to be independently executed. It must not bypass protected branch rules, independent approvals, `humanHold=true`, `production_send=false`, checkout gates, or task ownership checks. Full end-to-end CI and independent security approval are separate release requirements. GitHub-hosted CI may be blocked by account eligibility even for a public repository; failed-to-start checks do not mean assertions failed.
