# AuthiChain EU DPP Readiness — Integration Packet
One page. No call. Stripe checkout only.

**Price:** $299 one-time  
**Pay:** https://authichain.com/checkout/dpp_readiness  
**Credit:** $299 applied toward AuthiChain Basic if you convert later  
**Term:** packet delivered within 30 days of payment to the work email used at checkout

Supersedes `docs/drive-import/legal/AUTHICHAIN_SERVICE_AGREEMENT.md` ($2,500 setup + $499/mo). Do not send that file.

## What you get
- Written EU DPP readiness assessment for one SKU or one battery family (what you already have, what is missing, who in the chain holds it)
- Self-serve merchant activation
- 50 workspace generations to publish the first passport record
- One Ed25519-signed attestation and JWKS pointer (`https://authichain.com/.well-known/jwks.json`)
- One public verify path: hosted lookup at `/verify` (contract lookup in development) and local run at `/protocol`
- Evidence pack: subject id, JWS, JWKS, evidence digest, scan timestamp, decision, one negative-case result, deploy version

## What you do not get
- A legal opinion that the product is EU-compliant
- METRC, DSCSA, FDA, or notified-body filing
- Unlimited registrations, white-label, SLA phone support, or a scheduled call
- SOC 2, FedRAMP, or DHS SVIP claims
- A microscopic / uncloneable physical mark

## What you provide
Product identifiers, origin and materials fields you already hold, and a work email.

## Acceptance
Packet emailed to that work email. Record checkable with the open verifier:

```
node verifier.mjs record.json anchor.json
```

Three verdicts only: verified / valid-unanchored / invalid.

## Other self-serve SKUs (not this packet)
- QRON Starter — $29 one-time / 100 generations — `/checkout/starter`
- QRON Creator — $99 one-time / 500 generations — `/checkout/creator`
- QRON Launch — $19/mo / 100 generations — `/checkout/qron_launch`
- StrainChain Passport — $49 one-time / one cultivar — `/checkout/strainchain_passport`
- Agent verify — $0.05 USDC per call on Base — `/x402`

Larger tag programs: hello@authichain.com, written packet, async only.

This is not legal advice. Confirm final obligations against the Regulation and your counsel.
