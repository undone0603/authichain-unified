# x402 discovery for authorized buyers (no automatic payments)

This is a **read-only, consent-first integration example** for the AgentZ ranked-tape offer. It is documentation, not a live registry listing, buyer endorsement, payment receipt, or production release. See [adoption tracking #2485](https://github.com/undone0603/authichain-unified/issues/2485).

## Human or agent workflow

1. **Discover without credentials:** visit [the public offer](https://signal.authichain.com/offer) and inspect the linked discovery resource `https://signal.authichain.com/api/x402/discovery` using an ordinary GET without a wallet, payment signature, or private keys. HTTP 402 is an expected payment-required challenge; HTTP 200 on the offer page is not evidence of a purchase. Do not assume that historical quoted pricing, network, asset, recipient, or settlement method remains current.
2. **Review the live challenge:** inspect the actual response's network, token contract, base-unit amount, resource URL, supported x402 version, expiry, and payment facilitator. Treat missing, ambiguous, inconsistent, or changed fields as a stop condition. Do not derive wallet-transfer instructions from this guide.
3. **Request explicit authorization:** show the payer the exact live price and currency, resource being purchased, recipient/facilitator details, network fees if any, refund limitations, and the possibility of irreversible blockchain settlement. Obtain affirmative authorization for this **specific** transaction before invoking any signer or wallet. No background purchases, autonomous retry spending, or inferred consent from visiting a URL.
4. **After an authorized transaction:** retain a redacted receipt with transaction hash, chain/network, token and amount, payer classification (external versus house/test), timestamp, resource request identifier, facilitator result, HTTP resource-delivery result, and any refund/dispute. Do not expose wallet secrets, personal data, private API output, or customer identities publicly.
5. **Count success only after reconciliation:** independently verify on-chain settlement and correlate it with the **same** resource request and successful fulfillment. A transfer alone, an HTTP 402, an offer-page counter, a registry listing, or a wallet address count is not fulfilled external revenue. Unknown or inaccessible evidence remains `unverified`.

## Read-only diagnostic example

```sh
curl -i --max-time 15 https://signal.authichain.com/offer
curl -i --max-time 15 https://signal.authichain.com/api/x402/discovery
```

These commands do not provide payment credentials or initiate a transfer. They may return errors or changed challenge metadata. Do not copy a live `PAYMENT-SIGNATURE`, authorization token, private key, or raw payer data into an issue or log.

## Marketplace and adoption evidence

Record any Bazaar/marketplace listing only with its exact registry URL, resource URL, observed timestamp, and source. Do not claim publication, ranking, certification, endorsement, or buyer interest from draft metadata. Keep `discovered`, `authorized`, `settled`, `fulfilled`, `refunded`, and `unverified` as distinct states. Exclude owner-funded, replay, bot, synthetic and test transactions from external-buyer counts; do not deduplicate unrelated purchasers solely by IP address. Obtain explicit opt-in before publishing a third party's integration story.

This guide deliberately contains **no wallet automation, payment signing code, live customer claims, or outbound outreach**. Updates require the normal protected PR process; no production configuration or spending is authorized.
