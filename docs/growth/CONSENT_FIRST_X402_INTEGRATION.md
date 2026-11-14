# Consent-first x402 integration: public discovery, no automatic purchase

This is a **read-only integration guide**, not a claim that AuthiChain has certified a buyer, an agent, or a payment. See [the public Signal offer](https://signal.authichain.com/offer) for the currently advertised resource, network, price, and terms. Treat those as live data that may change; do not hardcode the historical price or assume the endpoint is healthy from this document.

## Integrator sequence

1. Read the public offer with a plain HTTP GET. Do not include wallet keys, bearer tokens, private serials or personal data.
2. Inspect the advertised discovery endpoint with a **read-only GET**. An HTTP 402 challenge means payment is requested, **not** that any payment settled or a response was fulfilled.
3. Validate the actual 402 payment requirements (method, resource URL, network/chain ID, USDC contract, atomic amount, recipient, expiration and supported protocol version) against a separately trusted configuration. Reject mismatches and ambiguous or missing fields.
4. Present the exact resource, recipient, asset, chain, atomic amount and expected deliverable to the authorized purchaser. Require **explicit authorization** before any signing, wallet transaction, paid retry or automated agent spend.
5. After an authorized payment, verify the transaction with an independent Base receipt and sufficient confirmations; verify the server-delivery signature against a public key obtained from an independently trusted source (not from the submitted receipt), then correlate its signed request ID, transaction hash, resource, and fulfillment status. A signed receipt alone does not establish that the delivered resource was useful or that the payer is unaffiliated. Check refunds, disputes, duplicate payment IDs and duplicate fulfillment receipts before counting externally settled-and-fulfilled revenue.
6. If any evidence is missing or a provider is unavailable, label the outcome **unverified**. Do not infer fulfillment from a 200 landing page, 402 challenge, counter, Checkout Session, or owner test.

## Dated offer reconciliation boundaries

The read-only reconciler requires an HTTPS historical offer snapshot with a version, UTC observation time, and a half-open validity window: `validFrom <= occurredAt < validUntil`. Every request must explicitly bind its `offerVersion` to the snapshot and match the Base network, USDC token, recipient, atomic amount and resource. Invalid or missing offer evidence is rejected **before** any independent receipt RPC request. UTC timestamps must be real calendar dates; credential-bearing offer URLs are rejected.

These values are self-attested manifest assertions, not independently authenticated offer terms or on-chain timestamps. Even successful independent Base receipt and Ed25519 delivery checks are partial evidence only: `verifiedExternalFulfilled` and `verifiedAtomicUSDC` remain zero without independently proven external-payer identity, authorization, and refund/dispute finality. No live payments, wallet operations, or production writes are performed.

## Safe attribution and sharing

For owned documentation or an opt-in integration, a referral link may include a coarse source tag such as `?utm_source=owned_docs&utm_medium=integration_guide`. Do not attach personal identifiers, wallet addresses, private serials, or cross-site tracking identifiers. A referral click is **discovery**, not an external integration or a sale. Never publish a buyer name, transaction, screenshot, testimonial, badge or independently verifiable result without appropriate consent.

Evidence stages are distinct: public discovery → free read-only verification → opt-in integrator → genuine unaffiliated usage → purchaser-authorized settlement → independently confirmed delivery. Record dated sources for each transition and exclude house traffic, synthetic tests, duplicate receipts and reversed transactions. A verification result must retain its exact state (verified cryptographically, not found, revoked, unknown or unverified) and must not be advertised as a blanket authenticity certification.

## Operational boundaries

This guide makes **no network requests**, performs no signing or payments, and authorizes no outreach or production configuration change. Implementations must preserve credential isolation, humanHold and production_send controls until their protected release conditions are satisfied.

Related adoption work: [x402 distribution #2485](https://github.com/undone0603/authichain-unified/issues/2485), [consent-based evidence sharing #2487](https://github.com/undone0603/authichain-unified/issues/2487), and [coordination #2263](https://github.com/undone0603/authichain-unified/issues/2263).
