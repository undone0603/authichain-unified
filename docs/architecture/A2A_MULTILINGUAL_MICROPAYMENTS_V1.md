# A2A multilingual and conversion microservices — proposed v1

**Status: draft only. No live charges, trades, deployment or registered public A2A skill.**
**Prepared:** 2026-11-05. **Goal:** maintain a $0 development path until verified external revenue.

## Three opt-in information services

1. **Translation.** Machine translation of explicitly consented text among BCP-47 locales. Never translate signed payloads, tool names, canonical JSON-RPC fields, transaction amounts or permission decisions. Source-language text remains authoritative; machine translation is marked non-authoritative.
2. **FX conversion quote.** Source-attributed indicative exchange-rate math for a specified currency and amount. No currency trading, FX execution, custody or transfer.
3. **Crypto conversion quote.** Source-attributed indicative rates for explicit crypto asset IDs and fiat currencies. No on-chain swap, wallet debit, exchange or guaranteed fill. Never assume a stablecoin equals USD 1:1.

A paid conversion quote purchases an **information result**, not the principal.
An ordinary agent message or language preference cannot imply consent to a paid action. A proposed A2A 1.0 extension will carry explicit, typed operations and spend caps when approved.

## Proposal-only fees — NOT yet live

| Operation | Proposed USDC fee | Base USDC atomic units |
| --- | ---: | ---: |
| Translate up to 1,000 Unicode codepoints | $0.01 | 10000 |
| Each additional 1,000 codepoints, 10,000 max | +$0.01 | +10000 |
| One source-attributed fiat conversion | $0.005 | 5000 |
| One source-attributed crypto-related conversion | $0.01 | 10000 |

Review gas/facilitator charges, agent willingness-to-pay, provider costs, margin and refund policy before pricing. The existing paid x402 verification product is unaffected. Free conversion arithmetic can remain free; charge only for demonstrated additional data quality, auditable evidence or batch processing.

## Oracle data and licensing

- **ECB:** Euro reference rates are informational, usually published at about 16:00 CET on working days; the ECB discourages their use for transaction execution. Source: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- **CoinGecko:** The free Demo/keyless API does not grant commercial rights, even with attribution. Do not attach this unlicensed source to a paid API. Source: https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses
- Rates must be sourced through a trusted, licensed oracle adapter. The current implementation accepts an **injected** oracle, with provider name, HTTPS source URL and observation time. Those format checks are **not source authentication or commercial-use authorization**.
- FX source age limit: 4 days for weekend/holiday reference gaps; crypto: 2 minutes; conversion quote: 60 seconds. These are conservative, documented display windows, not market execution guarantees.
- Decimal conversion uses exact bigint arithmetic and decimal strings; rounded outputs are for display, not trade execution.

## x402 and A2A integration boundary

Proposal: x402 v2 exact USDC fee on Base, CAIP-2 eip155:8453, asset
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
Payee remains the previously authorized treasury:
0x5db511706FB6317cd23A7655F67450c5AC6e6AA2.

The modules generate unsigned *payment requirement objects*, **not** blockchain transfers. A separate, reviewed adapter must implement PAYMENT-REQUIRED, PAYMENT-SIGNATURE and PAYMENT-RESPONSE; verify exact signed quote, payee, asset, chain, fee, nonce, payer budget, expirations and non-replay; then settle through a genuine authorized facilitator. No v1 fallback is permitted for new services.

Human approval, trusted translator or oracle, verified facilitator and durable store are all required. Their Boolean gates must be controlled by the operator, never request parameters. A durable atomic claim is required for each quote, preventing duplicate charges. If settlement fails or the receipt cannot be persisted, hold for reconciliation. **Payment can settle before response delivery; failed persistence could leave a payer charged without receipt. A tested refund/reconciliation procedure is mandatory before launch.**

Protocol references:
https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
https://a2a-protocol.org/latest/specification/

## Development implementation (not connected to production)

- agentz/swarm/a2a-translation-payments.mjs
- agentz/swarm/a2a-conversion-payments.mjs
- agentz/swarm/a2a-translation-payments.test.mjs
- agentz/swarm/a2a-conversion-payments.test.mjs

Request example — currency rate quotation:
{ "amount":"100.50", "fromAsset":"fiat:USD", "toAsset":"fiat:EUR", "consentToPaidQuote":true, "maxFeeAtomic":"5000", "idempotencyKey":"client-fx-2026-01" }

Request example — crypto to fiat informational quote:
{ "amount":"0.005", "fromAsset":"crypto:bitcoin", "toAsset":"fiat:EUR", "consentToPaidQuote":true, "maxFeeAtomic":"10000", "idempotencyKey":"client-crypto-2026-01" }

Request example — translation:
{ "text":"Bonjour", "sourceLanguage":"fr", "targetLanguage":"ja", "consentToMachineTranslation":true, "maxAmountAtomic":"20000", "idempotencyKey":"client-lang-2026-01" }

These functions are **offline service seams**. There is no new route on authichain.com, and the 8-tool MCP production contract has not been changed. A future reviewed release may add a separate A2A extension/skill for language negotiation and opt-in micropayments; no automatic paid text parsing.

## Test evidence and next gates

2026-11-05: 26 of 26 source-level behavioral test cases executed from the exact committed development branch using an isolated V8 harness with **deterministic mocked cryptography**. This does not prove native Node, network interoperability, payment verification or translation quality.

Native test command after eligible isolated CI is authorized:

    node --test agentz/swarm/a2a-translation-payments.test.mjs agentz/swarm/a2a-conversion-payments.test.mjs

Before release:
1. Find and legally clear a $0 commercial rate source, and a translator with acceptable quality, privacy, retention and execution costs.
2. Review trust boundaries, payout/refund policy, anti-replay, per-agent budget, quote/source integrity and customer consent.
3. Run native Node tests and full **exact-head** CircleCI; obtain independent security review.
4. Build a durable quote/replay store, approved provider and payment adapters, and a separately approved opt-in A2A 1.0 extension with declared skills.
5. Validate simulated staging receipts and failures; never test by spending funded live wallets.
6. Only after approval, publish prices, expose endpoints, deploy or permit autonomous payment collection. Preserve humanHold and production_send=false.
