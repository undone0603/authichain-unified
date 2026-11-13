# AuthiChain Bitcoin Agent Economy

## Objective

Use a small BTC treasury as controlled working capital for the AuthiChain agent economy—not as unrestricted speculative trading capital.

AuthiChain already exposes an HTTP 402/x402 agent-payment pattern for verification. This slice adds the Bitcoin/Lightning policy boundary so a future BTC provider can be connected without giving an LLM direct custody of private keys.

## $300 dogfood allocation

- $75 — AgentZ operating allowance
- $75 — Bitcoin/Lightning integration and testing
- $50 — early-customer/referral incentives
- $50 — agent-to-agent service purchases
- $50 — treasury reserve

These are planning buckets, not instructions to move funds automatically. No private key, seed phrase, exchange credential, or payment-provider secret belongs in the repository.

## Initial AgentZ policy

The first live policy should be deliberately tiny:

- per transaction: <= 25,000 sats
- human approval: required above 10,000 sats
- daily budget: <= 100,000 sats
- permitted purposes begin with `verification:` and `infrastructure:`
- destination allowlists are required before production spending
- an emergency kill switch must disable the rail immediately

The repository module `src/lib/bitcoin-agent-economy.ts` enforces the local policy boundary and uses bigint for satoshi arithmetic.

## Economic loop

```text
Agent identity
  -> authorization
  -> HTTP 402 payment challenge
  -> BTC/Lightning settlement
  -> settlement evidence
  -> AuthiChain attestation
  -> reputation / accounting
  -> revenue
```

The next implementation should connect a provider adapter that can:

1. create a Lightning invoice;
2. expose the payment requirement to an agent;
3. verify settlement server-side;
4. write a payment evidence record;
5. issue or attach an AuthiChain attestation;
6. reconcile the transaction against the agent budget.

## Safety boundary

Do **not** add automatic withdrawals, leverage, trading, seed-phrase storage, or unrestricted wallet control. The first production milestone is a paid verification transaction with a hard spending cap and auditable settlement evidence.
