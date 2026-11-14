# Consent-first x402 integration: public discovery, no automatic purchase

This is a **read-only integration guide**, not a claim that AuthiChain has certified a buyer, an agent, or a payment. See [the public Signal offer](https://signal.authichain.com/offer) for the currently advertised resource, network, price, and terms. Treat those as live data that may change; do not hardcode the historical price or assume the endpoint is healthy from this document.

## Integrator sequence

1. Read the public offer with a plain HTTP GET. Do not include wallet keys, bearer tokens, private serials or personal data.
2. Inspect the advertised discovery endpoint with a **read-only GET**. An HTTP 402 challenge means payment is requested, **not** that any payment settled or a response was fulfilled.
3. Validate the actual 402 payment requirements (method, resource URL, network/chain ID, USDC contract, atomic amount, recipient, expiration and supported protocol version) against a separately trusted configuration. Reject mismatches and ambiguous or missing fields.
4. Present the exact resource, recipient, asset, chain, atomic amount and expected deliverable to the authorized purchaser. Require **explicit authorization** before any signing, wallet transaction, paid retry or automated agent spend.
5. After an authorized payment, verify the transaction with an independent Base receipt and sufficient confirmations; verify the server-delivery signature against a public key obtained from an independently trusted source (not from the submitted receipt), then correlate its signed request ID, transaction hash, resource, and fulfillment status. A signed receipt alone does not establish that the delivered resource was useful or that the payer is unaffiliated. Check refunds, disputes, duplicate payment IDs and duplicate fulfillment receipts before counting externally settled-and-fulfilled revenue.
6. If any evidence is missing or a provider is unavailable, label the outcome **unverified**. Do not infer fulfillment from a 200 landing page, 402 challenge, counter, Checkout Session, or owner test.

## Historical offer snapshots for offline reconciliation

The read-only `scripts/growth/x402-reconcile.mjs` helper requires a dated `offerEvidence` snapshot with `version`, HTTPS `source`, UTC `observedAt`, `validFrom`, and exclusive `validUntil`, together with `network`, `token`, `payTo`, `amountAtomic`, and `resource`. Each request must bind its `offerVersion` to that snapshot and include `occurredAt` in its validity window; network, token, recipient, amount and resource must match. Missing, stale, malformed or mismatched terms fail closed. Historical snapshots are evaluated against their own dated validity window, not today's price.

**A snapshot supplied in a manifest is not independently authenticated**, and `occurredAt` is a claim, not an onchain block timestamp. The offline output remains a manifest-consistency classification with **zero** verified external revenue. The authenticated mode still verifies independent Base RPC receipts and Ed25519-signed delivery, but cannot certify payer identity, authorization, refunds, disputes, or offer timing from a self-attested timestamp; its qualified outside-revenue total remains zero. Before production revenue attribution, obtain independently authenticated, time-bound offer and transaction evidence without triggering a payment or altering production state.

## Safe attribution and sharing

For owned documentation or an opt-in integration, a referral link may include a coarse source tag such as `?utm_source=owned_docs&utm_medium=integration_guide`. Do not attach personal identifiers, wallet addresses, private serials, or cross-site tracking identifiers. A referral click is **discovery**, not an external integration or a sale. Never publish a buyer name, transaction, screenshot, testimonial, badge or independently verifiable result without appropriate consent.

Evidence stages are distinct: public discovery → free read-only verification → opt-in integrator → genuine unaffiliated usage → purchaser-authorized settlement → independently confirmed delivery. Record dated sources for each transition and exclude house traffic, synthetic tests, duplicate receipts and reversed transactions. A verification result must retain its exact state (verified cryptographically, not found, revoked, unknown or unverified) and must not be advertised as a blanket authenticity certification.

## Operational boundaries

This guide makes **no network requests**, performs no signing or payments, and authorizes no outreach or production configuration change. Implementations must preserve credential isolation, humanHold and production_send controls until their protected release conditions are satisfied.

Related adoption work: [x402 distribution #2485](https://github.com/undone0603/authichain-unified/issues/2485), [consent-based evidence sharing #2487](https://github.com/undone0603/authichain-unified/issues/2487), and [coordination #2263](https://github.com/undone0603/authichain-unified/issues/2263).
