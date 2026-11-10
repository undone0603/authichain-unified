# Glama connector: publisher, free test profile, and attributable buyer evidence

**Status:** draft operational runbook; not a claim that Glama's authenticated editor was saved, that tests passed, or that a production release happened.
**Evidence checked:** 2026-11-10 UTC. Public endpoint: https://authichain.com/mcp. Documentation: https://authichain.com/docs.

## Authenticated Glama publisher form

Open https://glama.ai/mcp/connectors/com.authichain/authichain/admin/publisher with the verified owner account.

| Field | Value | Verification |
| --- | --- | --- |
| Operator | Zachary Kietzman, sole proprietor operating the AuthiChain brand | https://authichain.com/contact |
| Operator website | https://authichain.com | Public homepage |
| Vendor relationship | First-party | Operator owns the upstream endpoint |
| Documentation | https://authichain.com/docs | Public documentation |
| Trust center | Leave unset | No dedicated, verified security/compliance portal established |
| Support contact | https://authichain.com/contact | Shows technical support address |
| Restrictions | See exact text below | Distinguishes read-only calls from independently authorized payment |

Suggested Restrictions text:

> Public MCP discovery, price quotes, registry lookup, published attestation and reference-record verification, DPP readiness checks, Living QR scans, and non-binding negotiation are free. The `verify` seal-registry tool uses a separately authorized x402 USDC-on-Base payment rail; check `get_pricing` immediately beforehand. Stripe human checkouts are a separate rail. A valid cryptographic signature does not prove physical product authenticity; DPP readiness is informational and not legal advice. Do not disclose real customer records in test calls.

On **Listing**, decide whether Glama or the MCP Registry is the source of truth before editing the description: Glama says registry updates can overwrite its name, description, and URL unless "Use Glama listing details as the source of truth" is enabled. Do not toggle that setting without a comparison. Reopen the publisher form after saving, verify the stored values, and capture UTC evidence. No paid Boost, premium badge, promotion, DNS, secret, or deployment changes.

## Test profile: no paid calls

Glama's [connector guidance](https://glama.ai/mcp/faq) says its health checks **initialize and list metadata**, not invoke a tool. Set the **No Auth** test profile only if live anonymous `tools/call` for the advertised free tools is confirmed. Do not supply an API key that can authorize x402 settlement, production credentials, wallet keys, customer data, or Stripe secrets. Reconfirm the resulting auth badge and health state.

A reproducible *proposed* test matrix, to be executed in an isolated environment:

1. **Discovery:** GET `https://authichain.com/mcp` shows `serverInfo.version`, `tools`, and pricing. Confirm eight named tools and disjoint free vs paid descriptions. GET alone is *not* proof of JSON-RPC POST interoperability.
2. **Handshake:** POST JSON-RPC `initialize` for both supported modern and legacy MCP protocol versions; capture actual headers, response versions, UTC timestamp and operator.
3. **Tool catalogue:** POST JSON-RPC `tools/list`; inspect annotations, parameter descriptions, pricing boundary, and no undocumented write/issuance ability.
4. **Non-binding quote:** `tools/call` of `negotiate` with `{"service":"verify_record","mode":"quote_only"}`. Expected fields include `binding=false`, `accepted=false`, `payment_authorized=false`, `settled=false`, `side_effects=false`.
5. **Free reference demo:** `tools/call` of `verify_record` with `{"id":"polygon-anchor-1"}`. Capture actual verdict. This is a **demo**, not a real customer product or physical inspection.
6. **Informational category check:** `tools/call` of `dpp_readiness_check` with `{"category":"textiles","sells_in_eu":true}`. Record actual 0–100 score without making a certification claim.
7. **Fail-closed negatives:** invalid args, unknown registry object, missing Living QR, unavailable upstream. Do not convert missing evidence into "counterfeit" or "authentic" verdicts.

Never call the **paid** `verify` tool with a valid payment token, `X-Payment-Tx`, or wallet. Avoid making live human Checkout sessions as a test. Record any unexpected behavior as a failing/pending test, not success. See the existing independent interoperability challenge [PR #2416](https://github.com/undone0603/authichain-unified/pull/2416) for broader MCP transport and adversarial scenarios.

## Glama Inspector and mcp-proxy: distinguish real HTTP and local stdio

**The production MCP server is already remote HTTP:** connect https://authichain.com/mcp directly in https://glama.ai/mcp/inspector . It is **not** a local stdio process and does not require `mcp-proxy`. Inspect the eight real published tool definitions; run only `initialize`, `tools/list`, and the free non-binding `negotiate` tool until authenticated provenance and pricing boundaries are verified. Do not invoke paid `verify`, provide settlement proofs, or create a Stripe checkout. Source revisions and actual live versions may differ.

**Local stdio is a separate implementation:** `mcp/src/index.ts` starts an SDK stdio server with QRON database lookup tools and imports `DATABASE_URL`; `server/mcp/api.ts` imports optional `AUTHICHAIN_API_KEY` and exposes `verify_paid`. Neither should be exposed over an open public tunnel backed by live DB/production credentials. `server/mcp/index.ts` also exposes stubs, not production verification, and writes a startup message on stdout; avoid treating it as a validated public server.

### Safe zero-payment tunnel rehearsal

From a clean, local checkout at this PR's exact source revision, with Node and repository dependencies installed (no production database, payment tokens or credentials in the shell), run:

```sh
node --test scripts/ci/glama-inspector-fixture.test.mjs
npx mcp-proxy --port 8080 --server stream --tunnel -- node scripts/ci/glama-inspector-fixture.mjs
```

This uses the fixture-only `StdioServerTransport`, not the real production services. `mcp-proxy` starts the subprocess and exposes streamable HTTP at `/mcp`. **Read the actual** `tunnel established at https://...tunnel.gla.ma` line; never make up or assume a subdomain. With the tunnel process still running, open https://glama.ai/mcp/inspector and connect to `https://<actual-assigned-host>.tunnel.gla.ma/mcp`. The fixture advertises only two synthetic tools: `get_pricing` and `negotiate`. Test both and assert all results are marked `fixture=true`, `production=false`, `payment_authorized=false`, `settled=false`, `side_effects=false`. An unknown or paid tool should fail safely. This tests the **transport/Inspector** only, not AuthiChain's full eight-tool implementation or live paid fulfillment.

The optional `--tunnelSubdomain` requests a preferred name but cannot guarantee it. A stable subdomain is not a security control. A tunnel is **public by default**; never expose a DB-backed MCP server, wallet, customer secrets, destructive tools or real paid tools through it. `mcp-proxy` supports `--apiKey` / `MCP_PROXY_API_KEY` and the `X-API-Key` transport header when authentication is needed, but Glama Inspector encodes configuration and can include headers/tool arguments in shareable bookmark URLs; never share those URLs with credentials. For this static fixture, use no secrets at all. End the tunnel using Ctrl-C immediately after validation; record its actual URL and start/stop UTC time in the private evidence ledger.

If package download or network/DNS is blocked, record **tunnel not established / test not run**. Do not claim Inspector success based on the source code or a local mock alone. Keep Glama's production connector pointed at `https://authichain.com/mcp`; never replace the real listing with the test tunnel.

Reference: https://github.com/punkpeye/mcp-proxy · https://glama.ai/mcp/inspector


## $0 browser automation choice: AgentZ + local Playwright

Do not pay to replenish TinyFish or substitute a meter-billed browser for this public protocol audit. **AgentZ already has local browser infrastructure** and Python Playwright is already included in \`requirements-agentz.txt\`. The draft introduces \`agentz/workflows/handlers/glama_browser_audit.py\` and one opt-in \`glama_browser_audit\` registry entry with a one-run-per-day limit. The workflow is not automatically scheduled.

From a network-connected, credential-isolated local/WSL clone **at this PR's exact head**, with Playwright and Chromium present:

\`\`\`bash
python -m pip install -r requirements-agentz.txt
python -m playwright install chromium
python -m pytest -q tests/test_agentz_glama_browser_audit.py
node --test scripts/ci/glama-mcp-free-smoke.test.mjs
python -m agentz.cli run glama_browser_audit --mode dry-run
python -m agentz.cli run glama_browser_audit --mode confirm
\`\`\`

The confirm mode asks before opening the browser. It uses a **fresh, unauthenticated Chromium context**, permitting only GET/HEAD/OPTIONS to \`glama.ai\` and its first-party subdomains, blocking off-domain navigation, POST forms, downloads, and service workers. It captures the publicly visible Inspector and an optional screenshot. Its separate Node subprocess has no inherited credentials and calls **only** the static free no-payment smoke: GET MCP discovery, POST initialize, POST tools/list and POST nonbinding negotiate for the free reference verifier. It checks for eight published tools, zero paid calls, and zero settlement attempts.

Redacted UTC JSON evidence and the public-page screenshot are stored locally under \`agentz/logs/glama-browser/\` (do not commit those files). Failed browser, HTTP, DNS, or MCP responses remain **failed/unresolved**, never counted as verified. No logged-in Glama profile, no publisher-profile edits, no paid verify, and no actual production payment/fulfillment are exercised. The workflow's $0 cost comes from its **explicitly nonpaid operations**, not its registry field: \`financial_limit_usd: 0\` means **unlimited** in the generic AgentZ runner, so this must stay a narrowly allowlisted handler.

This is an **AgentZ integration draft**, not evidence that the real AgentZ host, self-hosted runner, or currently connected browser has executed it. Capture exact tested SHA, local host identity, native test logs, UTC timestamps and real HTTP traces before accepting it. If the public UI changes, the workflow fails rather than trying arbitrary selectors or bypassing authentication.

### Alternatives if no local browser host is available

- **Cloudflare Browser Run, Workers Free:** 10 browser minutes/day, three concurrent browser sessions, published hard cap. Verify your *actual account plan and remaining allowance* before use; do not spend overages (https://developers.cloudflare.com/browser-run/pricing/).
- **Browserbase Free:** vendor advertises 1 browser hour and three included agent runs; temporary, not suited to recurring automation (https://www.browserbase.com/pricing).
- **Browserless Free:** vendor advertises 1,000 units/month and two-minute sessions, useful for smoke probes (https://www.browserless.io/pricing).

All three hosted options have distinct account-sign-in and usage limits. None grants access to your authenticated Glama session automatically. Prefer the already-owned AgentZ / Playwright executor rather than setting up another paid connector.


## Reusable payment-free live smoke

The draft includes `scripts/ci/glama-mcp-free-smoke.mjs`. It is pinned to `https://authichain.com/mcp` and invokes only GET discovery, JSON-RPC `initialize`, `tools/list`, and the free `negotiate` tool with `{"service":"verify_record","mode":"quote_only"}`. It has **no code path** to call the paid `verify` tool or supply a payment header. Run it from a credential-isolated executor after release approval:

```sh
node scripts/ci/glama-mcp-free-smoke.mjs
REQUIRE_MCP_HINTS=1 node scripts/ci/glama-mcp-free-smoke.mjs
node --test scripts/ci/glama-mcp-free-smoke.test.mjs
```

The strict-hints version is designed to **fail against the old production tool catalogue** until the reviewed changes are actually deployed. It verifies all seven free names are advertised and paid `verify` carries financial-consequence hints. Do not misinterpret a baseline failure as a production outage. Record actual commands, UTC, SHA, response codes, and logs. The JavaScript mock suite does not establish live compatibility, and neither smoke mode proves paid fulfillment.

Note: Glama states that its Gateway logs full JSON-RPC inputs and outputs for proxied calls. Only send public demo identifiers and synthetic, nonsensitive information through connector tests. See https://glama.ai/mcp/faq.

## Tool-selection contract

| User/agent intent | Tool | Free vs paid and limitation |
| --- | --- | --- |
| Find listed prices | `get_pricing` | Free; quote only, not authorization |
| Find registration/published evidence by assetId | `query_provenance` | Free; registration does not prove authenticity |
| Verify a published v0.1 JWS against issuer/status | `verify_attestation` | Free; cryptographic check, not physical inspection |
| Check supplied signed JSON/anchor or fixed demo | `verify_record` | Free; different from published JWS verifier |
| Score an EU DPP gap questionnaire | `dpp_readiness_check` | Free; readiness is not compliance certification |
| Read a stored Living QR presentation | `scan_living_qr` | Free; does not issue a QR or make payments |
| Ask nonbinding capability/price-class question | `negotiate` | Free; cannot accept terms or settle |
| Pay for a specific seal UUID verification | `verify` | x402; requires separate buyer authorization, may settle funds |

## Glama-to-fulfillment conversion measurement

Keep a private **evidence ledger**, not promotional claims. Minimum fields:

- `observed_at_utc`, `evidence_url`, `tested_sha`, `data_freshness`
- `referral_source` and `attribution_basis` ("Glama" only when demonstrable from a tagged inbound flow, customer confirmation, or similarly reliable evidence; otherwise "unknown")
- `external_nonfounder_buyer_evidence` (separate from free demos and house traffic)
- `free_tool_invoked`, `free_call_succeeded` (aggregate; no customer secrets)
- `nonbinding_quote_seen`, `separate_paid_authorization`
- `settlement_id`, `settled_amount`, `refund_or_reversal`
- `entitlement_or_paid_response_reference`, `fulfilled`
- `repeat_settlement_reference` and `renewal_delivered`

The funnel is **Glama discovery → free tool → nonbinding quote → independently authorized payment → actually settled transaction → verified fulfillment → repeat revenue**. Any missing link must be labeled unknown. Page views, returned HTTP 402 quotes, simulated/test payments, founder/house payments and unfulfilled Stripe charges are **not** successful independent buyer conversions. Keep public analytics aggregated, privacy-respecting, and separate from private receipts. Do not attribute unrelated product demand to Glama.

## Acceptance and release hold

This draft changes only tool descriptions, MCP tool safety hints, a registry-manifest description, a regression test and documentation. It does **not** operate Glama's authenticated editor, test a payment, merge, deploy or start outreach.

Before release, run native `pnpm exec vitest run workers/authichain-com/src/mcp-routes.test.ts workers/authichain-com/src/mcp-negotiate.test.ts` plus the repository's actual required checks on an eligible, credential-isolated executor. Preserve the **exact candidate SHA**, job logs, independent review, and approved protected deployment process. Do not relax `humanHold`, `production_send=false`, secrets, financial restrictions, or production review controls. No paid Glama promotion or testing spend. After an approved release and reindex, record the *actual* Glama tool-definition quality score, auth badge, health status and per-tool findings, without inventing improvements.

References: [Glama FAQ](https://glama.ai/mcp/faq) · [TDQS rubric](https://github.com/glama-ai/tool-definition-quality-score) · [AuthiChain docs](https://authichain.com/docs).
