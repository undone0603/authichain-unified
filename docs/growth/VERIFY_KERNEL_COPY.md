# Public /verify copy — Trust Kernel wrap

Ship on `https://authichain.com/verify` (apex). `/desk/verify` stays a sample desk.
Never a `*.vercel.app` URL. Never a fifth brand page named Trust Kernel or Lab.

## Meta

- Title: Verify a seal | AuthiChain
- Description: Check a signed AuthiChain record by seal ID, GTIN + serial, or QR. A valid signature proves who published the record. It does not prove the physical item was never swapped.

## Page

Eyebrow: Open Verification Protocol v0.1

H1: Check the record. Not the marketing.

Subhead: Paste a seal ID, GTIN + serial, or scan the mark. You get signed evidence and a verdict — not a 92/100 score.

Proof (live only):
- Ed25519 JWKS at https://authichain.com/.well-known/jwks.json
- Open Verification Protocol v0.1 draft — /protocol
- Certificate contract 0x4da4D2675e52374639C9c954f4f653887A9972BE on Polygon

Primary CTA: Verify
Miss CTA: No seal on file. Seal this product — no call. → /onboard
Paid CTA (one per surface): EU DPP Readiness $299 → /battery-passport
Dev CTA: Run the verifier on your machine → /protocol
Agent CTA: Pay $0.05 USDC per call → /x402

## Result module

Never print `trust_score`, `authenticityScore`, `authentic`, or `agentNotes`.

```
Identity:          verified | failed | not_supplied | partial
Issuer:            verified | failed | unknown
Signature:         verified | failed | unknown
Status:            active | revoked | expired
Decision:          verified | anomaly | blocked | expired | invalid | not_found
Physical binding:  unknown
Unknowns:          listed in plain language
```

Physical binding stays `unknown` until an inspection evidence row has a real `sha256:<64hex>` digest. A copied QR can still decide `verified` at lookup depth.

## Miss module (verbatim from PRICING_FREEZE_COPY.md)

H2: No seal on file
Body: Publish one. 5 free generations, then $29. No call.
CTA: /onboard
Secondary: /verify

## Desk sample AC-DPP-BATT-8841X

Do not say counterfeit, rejected, or "the mark does not hold."

Label: anomaly
Finding: Signature may still verify. Scan pattern and clone presentation require investigation. Software cannot determine physical counterfeit status.
Disclaimer: Desk sample. query_provenance never attests an unknown ID.

Keep working: AC-7C2A91E4, AC-DPP-BATT-8841, SC-FARM-LT63-0912, GC-MIA-DLA-0005.

## FAQ

Q: Does verified mean the product is genuine?
A: It means the signature is valid, the issuer key is the one we publish, and the attestation is active. A copied QR can still verify. Anomaly and blocked exist for that reason.

Q: Why is there no authenticity score?
A: A score hides missing evidence. The protocol layer returns a verdict.

Q: Can I verify without trusting AuthiChain servers?
A: Yes. Download the reference verifier on /protocol. No account, no API key.

Q: What if this is my product and there is no seal?
A: /onboard. Or pay $29 / $49 / $299 on the published catalogue. No call.

Q: Is this a lab certificate or a government credential?
A: No. A seal proves the record the issuer published has not been altered since it was signed.

## JSON-LD

WebApplication on https://authichain.com/verify.
No AggregateRating. No reviewCount. No invented offers beyond the live catalogue if money is mentioned.

## Forbidden strings on this page

- authenticity score / trust_score / 92/100
- Authentic Product Verified
- Counterfeit Alert
- FedRAMP / METRC replacement / notified-body certification
- customer logos, case studies, scan-to-earn, $QRON rewards
