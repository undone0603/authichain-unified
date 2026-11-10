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
