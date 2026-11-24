# Agent Execution Evidence Gap Assessment

A free technical review. A prospective buyer shows one redacted, historical
agent action. We report whether their present systems can establish four
things about it, and what would close each gap.

| Dimension | Question |
| --- | --- |
| Principal | Who did the agent act for? |
| Permission scope | Was the agent allowed to do this, at this amount, for this payee, at this time? |
| Execution outcome | What actually happened? |
| Settlement and beneficiary | Who paid whom, and how much? |

## What each dimension can come back as

- **verified**: checked independently, on Base mainnet or through AuthiChain's hosted `verify_record` with a production key.
- **asserted**: present, but only as a log, an unsigned declaration or a demonstration-key signature.
- **missing**: nothing supplied.
- **contradicted**: the evidence disagrees with the claim, for example an amount over the mandate limit.

The overall result is `establishable`, `partially_establishable`,
`not_establishable` or `contradicted`. The review never reports a trust score
or calls anything "authentic". A verified signature proves who signed, not that
the action was wise.

## What the buyer sends

One JSON file. Redact names and internal ids freely, but keep on-chain
addresses and transaction hashes, because those are what get checked.

```json
{
  "action_id": "any label",
  "claimed": {
    "principal": "0x… payer address, or a DID",
    "action": "purchase_signal",
    "beneficiary": "0x… payee address",
    "amount_usdc": 0.05,
    "occurred_at": "2026-11-22T15:50:30Z"
  },
  "evidence": {
    "settlement_tx": "0x… Base transaction hash",
    "mandate": {"type": "declared | authichain_signed_record", "id": "…", "record": {}, "scope": {
      "max_amount_usdc": 1.0, "payees": ["0x…"], "actions": ["purchase_signal"],
      "not_before": "…", "not_after": "…"}},
    "outcome": {"type": "http_response | application_log | signed_receipt", "status": 200, "tx": "0x…"},
    "signed_record": {"id": "…", "record": {}, "anchor": {}}
  }
}
```

Every field is optional. Leaving one out is itself a finding.

## Running it

```
python -m agentz.cli capabilities assess-action path/to/action.json
```

It is read-only. It reads Base through a public RPC and checks signed records
through the hosted `verify_record` tool. It signs nothing, pays nothing and
runs no verifier on the AgentZ host, so the owner pause on host-executable
verifiers is respected.

## Sample results, run live on 2026-11-22

The samples are in `agentz/fixtures/agent_evidence/`. Samples 1, 3 and 5 use a
real Signal purchase settled through the Coinbase facilitator. Sample 4 uses a
real plain wallet send.

| Sample | Overall | Principal | Scope | Outcome | Settlement |
| --- | --- | --- | --- | --- | --- |
| x402 purchase, declared mandate | partially_establishable | verified | asserted | verified | verified |
| Platform logs only | not_establishable | asserted | asserted | asserted | missing |
| Same purchase, tighter mandate | contradicted | verified | contradicted | verified | verified |
| Plain transfer claimed as agent purchase | not_establishable | asserted | missing | asserted | asserted |
| Signed mandate, demonstration key | partially_establishable | verified | asserted | verified | verified |

The common pattern is that an x402 settlement establishes the principal, the
outcome and the settlement on its own. Permission scope is the gap: a payer's
EIP-3009 signature proves consent to one transfer, not a standing mandate.
Closing that gap needs the principal to sign the mandate itself, which is the
natural paid follow-on.

## Limits

- Settlement is checked on Base mainnet USDC only. Other chains and rails come back as asserted, not rejected.
- Signed records are checked through AuthiChain's format. Other signature schemes come back as asserted.
- The review covers the evidence supplied for one action. It says nothing about the buyer's other actions or controls.
