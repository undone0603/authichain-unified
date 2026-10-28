# Agent truth baseline

The existing x402 seal lookup returns a reproducible signature-and-validity
check alongside registry metadata and the existing settlement receipt. This
change adds no price, billing system, database table, or migration.

POST a `sealId` UUID to `/api/v1/agent-verify` or `/api/x402`, using the existing
x402 payment challenge. Eligible free calls return the same evidence format.
The advertised bazaar example UUID is not eligible: unpaid POST of that id
returns 402 so discovery crawlers do not classify the route as free. The
stale PayAI listing sample `sealId: "demo"` on `/api/v1/agent-verify` is
treated the same way. A GET that already carries a payment proof settles
like POST; unpaid GET stays 402 so GET-first crawlers still see a paywall.
HTTP crawlers read the v2 402 JSON: `accepts[0].outputSchema.input` stays the
POST skill catalog, and `accepts[0].outputSchema.output` is the unwrapped paid
HTTP body sample (registered/status/checks/details/baseline/verified/subject/
settlement/timestamp). Bazaar `extensions.bazaar.info.output` stays
`{type: "json", example: <that sample>}`. The sample has no `authenticityScore`.
The seal's existing `qr_payload` must contain a protocol record (direct JSON or
`{"record": ...}`). URL-only payloads remain explicitly unsigned. A missing
seal produces a not-registered, unsigned result; payment buys the check, not a
guaranteed positive answer.

The response adds `baseline`:

- `version: "1"`, `scope: "signature-and-validity"`, and `checkedAt`.
- `verdict`: `valid-unanchored`, `invalid`, or `unsigned`.
- `checks.signature`: the cryptographic verification result, when available.
- `reasons`: verifier failure reasons or missing-evidence reasons.
- `evidence.record`: the original signed record, or null when unavailable.
- `evidence.anchor: null`: this path does not query a chain anchor.
- `unknowns`: issuer identity, registry-to-subject binding, revocation, chain
  anchoring, and physical authenticity are not established by this check.

Top-level `verified` stays false because this bounded check is not full
authenticity verification. Top-level `checks.signature: "checked"` means a
check was attempted; read `baseline.checks.signature` and `baseline.verdict`
for its outcome. Registry membership is a server assertion, not independently
signed evidence. The embedded record authenticates only its signed contents
against its embedded verification key, not the business identity of that key.

## Easy buyer walk (demonstration)

These unpaid probes are labeled demonstration. They are not customer revenue.

```sh
node scripts/x402-buyer-example.mjs
node scripts/x402-buyer-example.mjs --live
```

1. Discover: `POST https://authichain.com/api/x402` with `{}` returns HTTP 402.
   `accepts[0].amount` is `50000` atomic Base USDC ($0.05). `payTo` is in the
   body. `GET /api/x402/health` confirms the same price and network.
2. Submit payment: retry the same empty POST with an `X-PAYMENT` header from
   **your** Base USDC wallet to receive missing-seal evidence plus a settlement
   receipt, or POST `{"sealId":"<uuid>"}` with payment. A named non-UUID body is
   HTTP 400 before payment. Save the JSON body as `response.json`.
3. Independent verifier (separate process, no registry or facilitator):

```sh
node scripts/verify-paid-baseline.mjs response.json <expected-seal-uuid>
```

The command checks the expected response subject, reruns `protocol/verifier.mjs`
on the original evidence, compares the reported result, and evaluates validity
again at the buyer's current time. Exit 0 requires a valid signature and validity
window; tampered, unsigned, missing, expired, and mismatched evidence exit 1.
It does not authenticate registry membership, issuer identity, or settlement.
The buyer must separately verify the receipt's transaction on Base and apply its
own issuer trust and subject-binding policy before relying on a business claim.

Tests use published conformance fixtures and mocked settlement. They do not
demonstrate a live paid customer transaction or regulatory certification.
