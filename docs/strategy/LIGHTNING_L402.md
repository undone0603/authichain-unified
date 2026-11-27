# Lightning (L402) beside x402

**Status: built, off.** No Lightning backend is live, so nothing takes money.

**Owner decision (2026-11-26):**
- Add Lightning beside x402.
- Keep the USD prices and convert them to sats at the live rate.
- Sweep revenue to Cash App.
- Choose the backend later.

## How a paid call works

1. **Unpaid POST.** The response is the same `402` x402 quote as before, plus
   `WWW-Authenticate: L402 macaroon="…", invoice="…"`. GET and HEAD never create invoices.
2. **Pay.** The client pays the invoice, and the payment reveals a preimage.
3. **Retry.** The client sends `Authorization: L402 <macaroon>:<preimage>`. The server checks
   `sha256(preimage) == payment_hash` itself; no backend call is needed.

**Token.** The macaroon is the standard V2 format, so tools that read L402 tokens can parse it. It
binds the payment hash, the service, the tier, the exact path + query, the price, and a 10-minute
expiry (1 hour at most). Any token it doesn't recognize is refused.

**One payment, one call.** Each payment hash is claimed in the `L402Claims` Durable Object before
the server answers:
- A token used a second time gets `409`.
- If the request fails after the claim, the claim is released, so the payer can retry with the
  same token.

**Price.** `sats = max(1, ceil(usd × 10⁸ / btc_usd))`, using Coinbase spot cached for 60 s. A BTC
quote outside $1k–$10M is refused.

## Where it runs

Everything is in the edge worker (`worker-app`). It serves `app.authichain.com` and
`authichain.govchain.us`.

| Service | Endpoint | Price |
| --- | --- | --- |
| Signals | `/api/x402?tier=ping\|verify\|evidence` | $0.01 / $0.05 / $0.10 |

`authichain.com/api/x402` is served by the `authichain-com` worker and stays x402-only.

## When it turns on

It stays off until all four are present:
- `L402_ROOT_KEY`
- the `L402_CLAIMS` binding
- a live backend
- a BTC price

The only backend today is a test backend whose invoices can't be paid. It loads only when
`NODE_ENV=test`.

Code: `src/lib/l402.ts` (token and pricing), `src/lib/l402-signals.ts` (config and paid path),
`worker-app/l402-claims.ts` (claims).

## Owner gates

1. **Merge.** The payment path and `WEB3_IDENTITY.md` are in this change, so merge it by hand.
2. **Backend.** Choose one: a hosted API (for example Strike or OpenNode) or self-hosted. Enter its
   key through the secure credential form.
3. **Root key.** Set the `L402_ROOT_KEY` Worker secret (random, 32+ bytes).
4. **Sweep.** Sweep the balance to Cash App. A Cash App invoice can be paid once, so each sweep
   needs a fresh one.
