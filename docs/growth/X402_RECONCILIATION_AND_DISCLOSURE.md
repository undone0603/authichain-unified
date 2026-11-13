# x402 read-only reconciliation and public disclosure review

Run offline against a **locally prepared, authorized evidence JSON file**:

```sh
node --test scripts/growth/x402-reconcile.test.mjs
node scripts/growth/x402-reconcile.mjs ./private-x402-evidence.json
```

Input: `{"settlements":[...],"deliveries":[...]}`. Each settlement must have `txHash`, `requestId`, `paymentId`, `chain`, `token`, `amountAtomic`, `to`, `from`, `confirmed`, `success`, `blockHash`, `confirmations`, `payerClass`, `houseOrTest`, `refunded`, `disputed`, and `chainEvidence:{source,observedAt,independentlyValidated}`. Each delivery must have matching `requestId`, `paymentId`, `txHash`, `resource`, `status:200`, `delivered:true`, `receiptId`, and `deliveryEvidence:{source,observedAt,independentlyValidated}`. These flags must be populated by **independent, trusted verification**: an input JSON file can lie. The script does not query an RPC, verify a signature, authenticate a provider log, prove finality, or validate a refund/dispute ledger. Its `verified_external_fulfilled` verdict is **conditional on the integrity of supplied evidence** and must not be represented as independent production verification. Unknown fields and absent receipts fail closed. Only one transfer and one delivery per request may count. Public output truncates transaction hashes; request IDs should be pseudonymous and non-sensitive.

To establish genuine external revenue, an authorized operator must first independently check Base chain transaction receipts and finalized USDC Transfer logs (chain 8453, correct token, recipient, amount, unique tx hash), then correlate with authenticated server-side payment request ID and successful resource response receipt, and reconcile payer ownership, refunds, disputes and replay. Retain raw evidence privately and source/time/SHA-bound redacted attestations for review. Never treat HTTP 402, marketing counters, registry metadata, or a transfer without fulfillment as revenue. No wallets, payments, production writes or network requests are performed by this script.

## Public discovery data minimization — 2026-11-13

The public 402 response was observed to contain `agentToolsVerify`, `portfolioId`, and `usdcAccountId`, alongside `till` and a `next` paid offer. **Review before wider indexing:** the first three look like internal verification/account identifiers; do not assume they are secrets, but remove them from unauthenticated discovery unless the owner proves a documented public consumer needs them. Review whether `till.lastPayer` or buyer-count data leaks pseudonymous customer information. A minimal 402 should contain only the resource, x402 version, supported payment methods, network, token, amount, public payee, Bazaar schema and safe output example. Do not publish private IDs, signed tokens, credentials, raw receipts or payer histories. Changes to the live endpoint require separate source tracing, exact-head tests and protected deployment.
