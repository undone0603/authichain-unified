# Zero-new-spend x402 inbound USDC evidence — Nov 3, 2026

**Status: public chain transfers independently observed; customer identity and paid delivery NOT PROVEN.** This audit records economic evidence without a new checkout, ledger, deployment, vendor bill, founder self-purchase, external communication or token transfer.

## Direct publicly observable facts

AuthiChain's published Base USDC receiving address is `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2`; standard Circle USDC token is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, with six decimals. The existing live `GET https://authichain.com/api/x402/health` reports `ready:true`, `paidVerify.bound:true`, price `50000` atomic USDC ($0.05), Base `eip155:8453`, and reachable facilitator. These are **seller-side self-claims** corroborated by directory protocol probes, not proof every paid request delivered.

On Nov 3, 2026, a third-party read of the [Blockscout token-transfer endpoint](https://base.blockscout.com/address/0x5db511706FB6317cd23A7655F67450c5AC6e6AA2?tab=token_transfers) yielded **14 USDC transfer events**. Of these, **seven** were exactly `50000` atomic USDC arriving from **four different addresses other than the receiving wallet** (Oct 17, Oct 23, Oct 28, Oct 29, Oct 30, Oct 31, Nov 1): **0.35 USDC** observed. Two other observed USDC outgoing transfers from the receiving wallet went to different addresses, not to those four sources. A historical transaction log **cannot rule out indirect/related-party wallet funding**.

Examples with actual chain receipts (public):
- [Oct 17, 0.05 USDC](https://base.blockscout.com/tx/0x98a6aecedb8a5ea5d27dc67a1492c73f5720b61ebcb01b6b28d8738fccf01c30)
- [Oct 23, 0.05 USDC](https://base.blockscout.com/tx/0x95e7522c69fa750c5734009ef6f554934a8cc6fea54783f7a871a88b88b492c0)
- [Oct 28, 0.05 USDC](https://base.blockscout.com/tx/0x9662dfff39f266416a3b629fc4299202269e384a977a657a370461d56f0f3121)
- [Nov 1, 0.05 USDC](https://base.blockscout.com/tx/0xe3b3141f25bdd469812767f7791035cc76aeaccea5972461d12e29411a160759)

The [x402 List AuthiChain independent listing](https://www.x402-list.com/services/authichain) has 14/14 x402 checks and records facilitator settlements. Its assessment snapshot and its daily volume series have different refresh times; **do not sum stale and current figures or assume the x402 Listing uniquely identifies a person**. A daily snapshot includes a Nov 2 transfer not in the fetched Blockscout transfer page; we did not count it without primary-chain corroboration.

The external [Agent402 seller-verdict API](https://agent402.tools/api/index?seller=authichain.com) reports AuthiChain is already listed, six discovered routes, the 402 paywall healthy, `routable:true` as a crawl status but **`routerDispatchEligible:false`** with reason `settlement_required`. The router counts independently funded buyers, not circular transfers. Do not pay yourself to manipulate the ranking. [402 Index](https://402index.io/api-docs) already lists `AuthiChain Agent Verify`, source self-registered, as healthy, payment-valid and $0.05. No duplicate registrations or paid placement required.

**Stripe is a different rail:** on Nov 3, the existing connected live Stripe account still had five charges, only one successful $10 founder smoke payment. It does not identify these Base USDC transfers.

## Classification

```json
{
  "status": "ONCHAIN_RECEIPTS_OBSERVED_PAYER_NOT_ATTRIBUTED",
  "direct_token_events": 7,
  "direct_usdc_total": "0.35",
  "distinct_source_addresses": 4,
  "independent_customer_verified": false,
  "paid_service_delivery_verified": false,
  "qualifying_customer_revenue": false,
  "new_business_cost": "$0"
}
```

Do not call this a first independent sale, MRR, a signed settlement receipt, a proven first completed agent payment or independent fulfillment. An ERC-20 transfer event alone lacks endpoint-response proof and economic independence. Public sources can also be stale or incomplete.

## Exact no-spend reproduction

```sh
node --test scripts/x402-inbound-receipts.test.mjs
node scripts/x402-inbound-audit.mjs
```

These commands use built-in Node only. The CLI makes **GET** requests only to a pinned Blockscout public endpoint; no credentials, wallets, POST, transfers, payments, database writes or customer messages. On HTTP 403/429, missing JSON, unsupported pagination or an incomplete page cap, the script exits nonzero/fails closed. A green local test is not an independently authenticated buyer.

## Next positive evidence

1. On each normal **Advance AuthiChain revenue** automation run, read-only compare publicly observed new 0.05 USDC receipt tx hashes; do not requalify the same tx or notify on duplicates.
2. Privately reconcile payer ownership against the user-controlled wallets, unrelated wallet funding and facilitator settlement receipts. Never publish a private wallet ownership map.
3. Request a genuine independent buyer to run one ordinary x402 call and provide a **redacted** usable response/settlement receipt; verify the Base transaction and service signature. Do not spend or pay on behalf of the buyer.
4. Once verified, write an internal durable settlement-to-delivery record (receipt hash + trusted verification), not a speculative CRM sale. Notify only when positively independently qualifying.
5. Prioritize low-cost inbound discoverability and useful signed-evidence documentation; the API is already listed in at least three free directories. Avoid platform upgrades, redundant storefronts and paid-directory fees.
