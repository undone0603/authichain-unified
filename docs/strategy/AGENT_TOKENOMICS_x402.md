# AuthiChain agent-to-agent tokenomics (x402)

**Date:** 2026-09-20 · **Status:** live rail, documented · **Brand:** AuthiChain · **SAM legal entity:** ZACHARY KIETZMAN (sole proprietor; AuthiChain is a brand, not a corporation).

This is the canonical economics document for the **already live** x402 micropayment rail. It does not invent a token, a second `payTo`, or a new facilitator. Implementation lives in `src/lib/x402.ts` (shared helpers), `workers/authichain-com/src/x402-routes.ts` (apex intercept), `worker-app/x402-routes.ts` (edge-router mount), and the Next.js mirrors under `src/app/api/x402/`.

**Do not change** `X402_PAY_TO`, `X402_FACILITATOR_URL`, or `X402_USDC_ASSET`. Bind workflow: `.github/workflows/bind-x402-secrets.yml`. Public HTML: `https://authichain.com/x402`. Machine catalog: `https://authichain.com/api/x402/catalog` and `https://authichain.com/.well-known/x402.json`.

Verified live on 2026-09-20: `GET https://authichain.com/api/x402/health` → `ready` / `trustless`; unpaid `POST /api/x402` → HTTP 402.

---

## 1. What is live vs what is speculative

| Surface                  | State                            | Unit                    | Notes                                                                                                                                                                                         |
| ------------------------ | -------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x402 agent verification  | **LIVE**                         | Base USDC, $0.05 / call | Trustless via PayAI facilitator. This document's subject.                                                                                                                                     |
| StrainChain Passport     | **LIVE** (Stripe)                | $49 USD one-time        | Human checkout. `src/lib/plans.ts` `strainchain_passport`.                                                                                                                                    |
| EU DPP Readiness         | **LIVE** (Stripe)                | $299 USD one-time       | Human checkout. `src/lib/plans.ts` `dpp_readiness`.                                                                                                                                           |
| QRON Living QR packs     | **LIVE** (Stripe)                | $29 / $99 packs         | `qron.space` product brand. Not a token payment.                                                                                                                                              |
| `$QRON` ERC-20 (Polygon) | **Deployed, not a payment rail** | n/a                     | Contract exists; zero meaningful trading/holder activity. Operator decision 2026-08-07: **USDC only on the paid path**. Treat as speculative utility / staking narrative, not live A2A money. |
| Governance / DAO token   | **Not live**                     | n/a                     | Docs and checklists mention staking or voting. No token is the unit of account for agent calls. Do not mint one.                                                                              |

There is **no new token launch** in this work and none is required for agent-to-agent settlement. The unit of account is Circle USDC on Base.

---

## 2. Unit of account and meter

- **Unit of account:** USD-denominated Circle USDC on **Base** (CAIP-2 / chain id `8453`).
- **Asset (do not rebind):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- **Meter:** one priced **verification (or seal) call**. Default **$0.05** = **50000** atomic units (USDC 6 decimals). Override only via `X402_PRICE_USD` in the same config `x402HealthReport` / `x402Catalog` already read. Never display a second hardcoded schedule.
- **Recipient / treasury (do not rebind):** ops/tokenomics EOA `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2` (`X402_PAY_TO`).
- **Cap:** `dailyCapUsd` default **10** (`X402_DAILY_CAP_USD`). 200 calls/day at $0.05. Next.js `POST /api/v1/agent-verify` also rate-limits 120/window and writes `automation_logs` (`workflow_name = x402_spend`).
- **Facilitator:** PayAI, reachable. URL is an operational secret/binding — **not republished** on `/x402` or in this file. The edge calls `/settle`; agents use any compatible x402 client.

`$QRON` stays **off** this rail (decision recorded in `docs/superpowers/plans/2026-08-07-x402-agent-verification.md`). Putting a speculative token in `accepts[]` would add treasury and KYC surface with no customer.

---

## 3. Two money rails (do not mix)

|                 | Human checkout                       | Agent rail                                 |
| --------------- | ------------------------------------ | ------------------------------------------ |
| Buyer           | Person with a card                   | Funded agent wallet (KYC'd owner off-loop) |
| Protocol        | Stripe Payment Link / Checkout       | HTTP 402 + x402 `exact`                    |
| SKUs            | Passport $49 · DPP $299 · QRON packs | $0.05 / verify call                        |
| Receipt         | Stripe charge                        | On-chain USDC to `payTo`                   |
| Source of truth | `src/lib/plans.ts`                   | `src/lib/x402.ts` + live health JSON       |
| Wallet          | Stripe acct `acct_1SXIyEGqTruSqV8T`  | Base EOA above                             |

A passport or DPP purchase does **not** credit x402 calls. An x402 payment does **not** publish a genetics passport. Genetics public verify (`GET /api/genetics/verify`) remains **free** and is not a second paid skill.

---

## 4. Audit: exact paid vs unpaid flows

Production apex is `authichain-com`. `tryHandleX402` runs **before** `APP_PREFIXES` proxy `/api` to `authichain-edge-router`. The edge-router mounts the same helpers (`registerX402Routes`). Next.js routes are mirrors for local/dev; they are not the live apex.

### 4.1 Free (no payment header)

| Method | Path                     | Result                                                  |
| ------ | ------------------------ | ------------------------------------------------------- |
| GET    | `/api/x402`              | 200 health JSON (`x402HealthReport`)                    |
| GET    | `/api/x402/health`       | 200 health JSON                                         |
| GET    | `/api/v1/agent-verify`   | 200 health JSON (alias; GET is not a verify)            |
| GET    | `/api/x402/catalog`      | 200 catalog (`x402Catalog` — prices copied from health) |
| GET    | `/.well-known/x402.json` | 200 catalog                                             |
| GET    | `/x402`, `/docs/x402`    | 200 HTML docs                                           |
| HEAD   | any x402 API path        | 204                                                     |

Health is safe to scrape: `payTo`, `asset`, `network`, `chainId`, `pricePerCall`, `dailyCapUsd`, `status`, `mode`, facilitator **reachability** (not the URL).

### 4.2 Paid skill

| Method | Path                   | Unpaid                                                     | Invalid / unsettled proof | Paid + trustless settle |
| ------ | ---------------------- | ---------------------------------------------------------- | ------------------------- | ----------------------- |
| POST   | `/api/x402`            | **402** v1 JSON `accepts[]` + v2 `PAYMENT-REQUIRED` header | 402                       | 200 JSON                |
| POST   | `/api/v1/agent-verify` | **402** (same body shape)                                  | 402                       | 200 JSON                |

If `X402_PAY_TO` is missing: POST returns **503** `payments_not_configured` (the $0 / unbound path). Live production has `payTo` set — unpaid callers get 402, not 503.

**402 body (shape):**

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "50000",
      "resource": "https://authichain.com/api/x402",
      "description": "AuthiChain agent verification",
      "payTo": "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USD Coin", "version": "2" }
    }
  ]
}
```

`extra` is the Circle USDC EIP-712 name/version PayAI needs on Base. `resource` is the request URL the agent actually posted.

**Request body (optional JSON):** `sealId` / `seal_id` / `productId` / `serial`. Empty body is accepted.

**200 after settle (edge / landing path):**

```json
{
  "verified": false,
  "authenticityScore": 0,
  "subject": "demo",
  "details": {
    "note": "Paid settlement accepted; registry lookup is not bound on this edge path."
  },
  "settlement": {
    "payer": "0x…",
    "amountAtomic": "50000",
    "txHash": "0x…",
    "trustless": true
  },
  "timestamp": "2026-09-20T00:00:00.000Z"
}
```

Honest limitation: the **live apex intercept** confirms payment and returns the subject; it does **not** query `auth_seals`. The Next.js `src/app/api/v1/agent-verify/route.ts` handler _does_ look up `auth_seals` and can return `verified: true` — that path is not what `authichain.com` answers today. Do not advertise a dashboard-grade registry result from the edge 200.

Dev mode (no facilitator): `settlePayment` returns `settled: true, trustless: false`. Landing and edge-router **refuse** that as unpaid (`402` + `status: "not_configured"`). Production is trustless.

### 4.3 What is not a paid skill (on purpose)

- `GET /api/genetics/verify` — free public fingerprint check. Charging for it would meter data that is already public.
- `GET /api/verify` and consumer scan pages — human / browser path; spend caps exist (`verification-caps.ts`) but this is not the x402 `accepts[]` skill.
- No second paid genetics endpoint is mounted. A thin wrapper would either invent a lookup the edge cannot perform or bill a free URL. Documented here so nobody “establishes” it by accident.

---

## 5. Agent-to-agent: Agent A pays AuthiChain (Agent B)

AuthiChain is Agent B: it publishes `payTo`, price, and asset. Agent A is any funded x402 client (another AuthiChain worker, Claude/Cursor MCP, or an external agent).

```
Agent A                         AuthiChain edge                    Facilitator (PayAI)
   |                                    |                                  |
   |  POST /api/x402  (no X-PAYMENT)    |                                  |
   | ---------------------------------> |                                  |
   |  402 + accepts[]                   |                                  |
   | <--------------------------------- |                                  |
   |  sign EIP-3009 / x402 payload      |                                  |
   |  (wallet pays payTo, not AuthiChain keys)                             |
   |  POST /api/x402 + X-PAYMENT        |                                  |
   | ---------------------------------> |  POST /settle                    |
   |                                    | -------------------------------> |
   |                                    |  success + txHash                |
   |                                    | <------------------------------- |
   |  200 verification JSON             |                                  |
   | <--------------------------------- |                                  |
```

1. **Discover** (no funds): `GET /api/x402/health` or `GET /api/x402/catalog`. Read `payTo`, `asset`, `pricePerCall`, `ready`.
2. **Challenge:** unpaid POST (below). Persist `accepts[0]`.
3. **Settle in Agent A's wallet** with an x402-compatible client. Transfer `maxAmountRequired` of `asset` to `payTo` on `network`. AuthiChain never receives a private key.
4. **Retry** the same POST with `X-PAYMENT: <base64 JSON proof>`. Proof must include `scheme`, `network`, `payer`, `amount` (or official x402 `payload.authorization`). When a facilitator is configured, a `signature` or `txHash` is required.
5. **Caps:** if the payer is over `dailyCapUsd`, expect 402 `daily_spend_cap_exceeded` on the Next.js handler. Edge path currently settles without the SQL cap (cap is advertised; Next.js enforces it).

### 5.1 Curls (safe — no keys, no facilitator URL)

Health:

```bash
curl -sS https://authichain.com/api/x402/health
```

Catalog:

```bash
curl -sS https://authichain.com/api/x402/catalog
curl -sS https://authichain.com/.well-known/x402.json
```

Unpaid 402 challenge:

```bash
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -d '{"sealId":"demo"}'
```

Settle retry after the agent wallet paid the challenge (placeholder header only):

```bash
curl -sS -i -X POST https://authichain.com/api/x402 \
  -H 'content-type: application/json' \
  -H 'X-PAYMENT: <base64-x402-payload>' \
  -d '{"sealId":"demo"}'
```

A valid payload is base64 of JSON, either flat `{ "scheme":"exact", "network":"base", "payer":"0x…", "amount":"50000", "signature":"0x…" }` or the official x402 envelope with `payload.authorization.{from,to,value}` and `payload.signature`. `to` must be the published `payTo`.

Owner-only live settle smoke: `scripts/x402-smoke.ts`. Do not dispatch another live self-pay unless verifying a deploy regression.

---

## 6. Discovery surfaces

| URL                                                          | Audience                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://authichain.com/x402`                                | Humans + crawlers. JSON-LD Service/Offer. Already in `sitemap.xml` and IndexNow (`marketing-autonomous.yml`).                                                                                                                 |
| `GET /api/x402/health`                                       | Agents. Live bindings.                                                                                                                                                                                                        |
| `GET /api/x402/catalog`                                      | Agents / MCP / OpenAPI-style clients. Paid endpoints + price + payTo.                                                                                                                                                         |
| `GET /.well-known/x402.json`                                 | Same catalog, well-known path.                                                                                                                                                                                                |
| Unpaid `POST /api/x402` 402 body + `PAYMENT-REQUIRED` header | `extensions.bazaar` (info + schema). v1 JSON body keeps `x402Version: 1`; the header is the v2 envelope (`resource` + `accepts[].amount` + CAIP-2 `eip155:8453`) so PayAI/v2 clients can index the skill. No facilitator URL. |
| `server/mcp` `get_pricing` / `verify_paid`                   | MCP tools. Must point at **Base**, not Polygon.                                                                                                                                                                               |

Catalog **must** call `x402HealthReport` (or the same env readers). A hardcoded $0.05 that disagrees with `X402_PRICE_USD` is a bug.

Sitemap already includes `/x402`. JSON endpoints are not sitemap URLs.

---

## 7. Forbidden changes

- Do **not** invent or rotate `X402_PAY_TO`. Live treasury: `0x5db511706FB6317cd23A7655F67450c5AC6e6AA2`.
- Do **not** rebind `X402_FACILITATOR_URL` or publish it on HTML/docs.
- Do **not** replace Circle USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` with a ticker-only asset or another chain.
- Do **not** add `$QRON`, a governance token, or a mint to `accepts[]`.
- Do **not** treat Workers Paid as available. $0 Workers path only.
- Do **not** claim the edge 200 is a full registry verify.

---

## 8. Related documents (some are stale)

| Doc                                                            | Role                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| This file                                                      | **Canonical** A2A economics + live audit.                                                               |
| `docs/marketing/agentic-economy-strategy.md`                   | Thesis. Stale on Polygon / `$QRON` settlement and $0.03–$0.49 tiers.                                    |
| `docs/superpowers/plans/2026-08-07-x402-agent-verification.md` | Original plan. Price $0.05 and “USDC only” still hold; “paywall unbuilt” and Polygon rail are outdated. |
| `docs/strategy/INDUSTRY_LEADERSHIP_STRATEGY.md` §8.1 move 2    | Still says steps 2–5 remain. The paywall is live.                                                       |
| `src/lib/plans.ts`                                             | Human Stripe source of truth.                                                                           |

Supersedes conflicting price/network claims for the **agent** rail only. Human SKUs stay in `plans.ts`.
