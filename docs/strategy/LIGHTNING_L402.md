# Lightning (L402) beside x402

**Status: built, off.** No Lightning backend is live, so nothing takes real money.
Production behaviour is unchanged until the owner completes the gates at the end of this document.

**Owner decision (2026-11-26):**
- Add Lightning payments beside x402 on the notary, the signal tiers and Dex.
- Keep the USD prices and convert them to sats at the live rate.
- Revenue goes to the owner's Cash App.
- Choose the Lightning backend later.

## Why L402

The paid endpoints already answer with HTTP 402 and accept x402 (Base USDC). L402 is the Lightning
version of that same flow:

| Step | x402 | L402 |
| --- | --- | --- |
| Unpaid call | `402` + `PAYMENT-REQUIRED` | the same `402`, plus `WWW-Authenticate: L402 macaroon="…", invoice="…"` |
| Pay | sign a USDC authorization | pay the BOLT11 invoice, which reveals its preimage |
| Paid retry | `X-PAYMENT` / `PAYMENT-SIGNATURE` | `Authorization: L402 <macaroon>:<preimage>` |
| Proof | facilitator settles on Base | `sha256(preimage) == payment_hash`, checked locally |

The two rails are independent:
- A request uses one rail or the other.
- L402 works when x402 is unconfigured.
- A Lightning payment never credits an x402 call, and an x402 payment never redeems an L402 token.

A Cash App invoice can't be the receiving end, because the server needs a fresh invoice for each
sale and a way to issue them. A Lightning backend with an API issues the invoices, and the owner
sweeps its balance to Cash App.

## Wire format

- **Challenge:** `WWW-Authenticate: L402 macaroon="<base64>", invoice="<bolt11>"`
- **Paid retry:** `Authorization: L402 <base64 macaroon>:<64 hex preimage>`. The legacy `LSAT` scheme
  and base64url are accepted too.
- **When invoices are minted:** an unpaid **POST**, or a failed L402 retry. GET and HEAD quotes never
  mint one, so crawlers can't fill the backend with invoices.

## Macaroon

The token is a standard V2 binary macaroon, the format Lightning Labs' Aperture issues. It is
byte-identical to one minted by `pymacaroons` from the same inputs.

**Key derivation:**
- `key = HMAC-SHA256(key = "macaroons-key-generator", data = L402_ROOT_KEY)`
- `sig = HMAC(key, identifier)`, then for each caveat `sig = HMAC(sig, caveat)`

**Identifier:** `uint16 BE 0` ‖ `payment_hash[32]` ‖ `token_id[32]`, 66 bytes in all.

**Location:** `authichain.com`

**Caveats:** first-party only, exactly these five, in this order:

```
services=<service>:0                 signals | notary | dex
<service>_capabilities=<capability>  signals: ping | verify | evidence
<service>_resource=<sha256 hex of path+query>
<service>_valid_until=<unix seconds>
<service>_price_msat=<integer>
```

**Verification** checks these in order and returns the first failure as `reason`:

1. Scheme and shape (`l402_malformed`), preimage format (`l402_bad_preimage`), base64 and macaroon
   (`l402_bad_macaroon`).
2. The signature chain, compared in constant time (`l402_bad_signature`).
3. The identifier version and length (`l402_bad_identifier`).
4. `sha256(preimage)` against the payment hash (`l402_preimage_mismatch`).
5. The caveats, in token order:
   - a malformed caveat: `l402_bad_caveat`
   - a key seen twice: `l402_duplicate_caveat`
   - a wrong value: `l402_wrong_<key>`
   - any key not listed above: `l402_unknown_caveat`
   - a required key absent: `l402_missing_<key>` or `l402_missing_caveat`
6. Expiry: `now >= valid_until` returns `l402_expired`.

Unknown caveats are refused; the check fails closed.

**Conformance:** every implementation must reproduce `shared/l402-vectors.json`: prices, the minted
macaroon, and 15 verify cases with their exact reasons. Regenerate the vectors with:

```bash
pnpm exec tsx scripts/l402/generate-vectors.ts > shared/l402-vectors.json
```

## Prices

USD stays the source of truth (`src/lib/x402-tiers.ts`).

**Conversion,** using integers only:
`sats = max(1, ceil(priceAtomicUsd * 10_000 / btcUsdCents))`

**BTC price:** Coinbase public spot, cached for 60 s. A quote outside $1,000–$10,000,000 is refused,
and no challenge is issued from it.

**Token lifetime:** 10 minutes by default, capped at 1 hour.

| Tier | USD | sats at $90,000/BTC |
| --- | --- | --- |
| ping | $0.01 | 12 |
| verify | $0.05 | 56 |
| evidence | $0.10 | 112 |

## One token, one call

As with an x402 payment, a token buys one call:

1. The handler claims the payment hash before answering, in the `L402Claims` Durable Object
   (`worker-app/l402-claims.ts`, binding `L402_CLAIMS`, one instance per `l402:ph:<payment_hash>`).
   The check and the write run as one step (`blockConcurrencyWhile`), so ten simultaneous requests
   with the same token get exactly one answer. KV can't guarantee that: its read and write are
   separate, and unlike x402 there is no on-chain settlement afterwards to reject a duplicate.
   Without the binding, L402 stays off; if the object can't be reached, the answer is
   `503 l402_claims_unavailable` and nothing is served.
2. A reused token gets `409`.
3. If the registry read fails after the claim, the claim is released and the answer says
   `retry_with_same_token`, so a paid caller is never left with nothing.

There is no settlement step, and nothing is written to the x402 spend ledger. Lightning revenue is
read from the backend, live.

## Where it applies

| Service | Where | Status |
| --- | --- | --- |
| `signals` | `worker-app/x402-routes.ts` → `src/lib/l402-signals.ts` | built, off |
| `notary` | AgentZ: `POST /agentz/notary/paid` ($0.05, capability `stamp`) → `agentz/core/notary.py`; Python implementation `agentz/core/l402.py` passes the same vectors; one-time claims are files (`AGENTZ_L402_CLAIMS_DIR`) | built, off |
| `dex` | `undone0603/agentz-dex-terminal` (`signal.authichain.com`) | next PR |

**When L402 is on (signals).** It needs all four of:
- `L402_ROOT_KEY`
- the `L402_CLAIMS` Durable Object binding (declared in `worker-app/wrangler.toml`, inert until the rest is set)
- a live backend
- a BTC price

The only backend today is the in-memory test backend. It loads only with `L402_BACKEND=test` and
`NODE_ENV=test`, and its invoices can't be paid.

## Owner gates

These are not agent actions; each is done by the owner.

1. **Rail rule.** `WEB3_IDENTITY.md` now lists Lightning as built and off. Merging the PR that
   carries it is the approval.
2. **Backend.** Choose a Lightning backend.
   - Hosted payments API (for example Strike or OpenNode): nothing runs on the laptop; custodial,
     with ID checks.
   - Self-hosted (LNbits or BTCPay plus a node): payments fail whenever the laptop is offline.
3. **Credentials.** Enter the backend API key through the environment's secure credential form,
   never in chat or a file. Set `L402_ROOT_KEY` (random, 32+ bytes) as a Worker secret.
4. **Sweep.** Move the backend balance to Cash App. A Cash App invoice is single-use, so each sweep
   needs a fresh one, or a reusable Lightning address if the account has one.

Until gates 2–3 are done, `l402SignalsConfig()` returns null and every response is exactly what it
was before.
