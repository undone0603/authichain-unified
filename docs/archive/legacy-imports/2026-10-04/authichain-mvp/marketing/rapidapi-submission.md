# RapidAPI Submission Checklist — AuthiChain Product Verification API

**Status:** DRAFTED, NOT SUBMITTED. The listing copy exists in
[`outputs/rapidapi-listing.json`](../outputs/rapidapi-listing.json) and
the OpenAPI spec exists at
[`outputs/authichain-openapi.json`](../outputs/authichain-openapi.json).
The underlying API is already live at `https://authichain.com/api/v1/*`
and proxies to the `authichain-api.undone-k.workers.dev` Cloudflare
worker. **Submitting the listing is 9 steps and ~2 hours of copy-paste.
This doc is the complete pre-filled submission.**

RapidAPI is a no-sales-calls distribution channel. Developers search the
marketplace, sign up for the free tier, upgrade when they hit limits.
Zero calls, zero demos, zero relationship-building. The highest-leverage
unlock you can ship this week.

## Step-by-step submission

### 1. Create a RapidAPI provider account

Go to https://rapidapi.com/provider and sign up as an API provider.
(You may already have a consumer account — the provider side is a
separate flow.)

### 2. Click "Add New API" → "Import OpenAPI Spec"

Upload [`outputs/authichain-openapi.json`](../outputs/authichain-openapi.json).
It's OpenAPI 3.0.3, validated, and will auto-populate all endpoints,
request/response schemas, examples, and error codes.

### 3. Set the base URL

```
https://authichain.com/api/v1
```

This is already in the OpenAPI `servers` block, so the import should
pre-fill it. Verify it's set.

### 4. Fill in the listing metadata (copy-paste ready)

**Name:**

```
AuthiChain Product Verification API
```

**Tagline:**

```
Blockchain-backed product authenticity verification in real-time
```

**Category:** `Commerce`

**Short description (pre-filled from OpenAPI `info.description`):**

```
Verify product authenticity in real-time using blockchain-backed digital
identities. AuthiChain protects brands and consumers from counterfeits by
registering products on-chain (Base L2 / Polygon) and providing instant
verification via NFC, QR, or product ID lookup.
```

**Long description (use this verbatim):**

```
AuthiChain is the trust layer for physical products. Counterfeits cost
brands $1.8T per year (OECD 2025) and fake pharmaceuticals alone kill over
1 million people annually. Existing anti-counterfeit solutions — holograms,
serial numbers, paper COAs — are easily forged and impossible to verify
at scale.

AuthiChain gives every product a unique on-chain identity (ERC-721 on
Polygon) that anyone can verify in under 200ms via QR scan, NFC tap, or
API call. The API is built for e-commerce platforms, marketplace
operators, supply chain systems, and brand protection teams who need
programmatic authenticity checks at scale.

WHAT YOU CAN DO WITH THIS API:
- Verify any registered product by serial, SKU, or NFC hash
- Batch-verify up to 50 products in a single call
- Query the full scan history for a product (time-series, geo-tagged)
- Register new products on-chain (brand-authenticated endpoint)
- List all products for a brand
- Check API health and rate-limit status

USE CASES:
- Luxury marketplaces: verify items before listing or at purchase
- Pharmaceutical distributors: DSCSA pedigree check at dispense
- Sneaker / streetwear resale: scan-to-verify before payment release
- Electronics OEMs: warranty + grey-market fraud detection
- Supply chain dashboards: custody + provenance reporting

POWERED BY:
- Polygon ERC-721 smart contract (0xc3143254997d48fdc9983d618fb2e10067673eb5)
- Cloudflare Workers for <200ms edge response times
- Optional Bitcoin Ordinal dual-chain proof for premium SKUs
```

**Tags:**

```
blockchain, verification, anti-counterfeit, NFC, product-authentication,
supply-chain, provenance, brand-protection, polygon, erc721
```

**Website:** `https://authichain.com`

**Terms of Service:** `https://authichain.com/terms` (if missing, create a
1-pager first — RapidAPI requires a TOS link)

**Support email:** `authichain@gmail.com`

**Logo:** Upload a 512×512 square PNG. Candidates already in the repo:

- [`public/og-image.png`](../public/og-image.png) (needs crop to square)
- [`public/images/hero-shield.png`](../public/images/hero-shield.png)
- [`public/favicon.png`](../public/favicon.png) (too small)

If none of these are square 512×512, create one before submission —
RapidAPI rejects non-square logos.

### 5. Configure pricing tiers

Copy-paste from [`outputs/rapidapi-listing.json`](../outputs/rapidapi-listing.json):

| Tier      | Monthly price | Requests   | Overage    | Target user                       |
| --------- | ------------- | ---------- | ---------- | --------------------------------- |
| **Basic** | Free          | 100/mo     | —          | Developers, testing, hobbyists    |
| **Pro**   | $49/mo        | 1,000/mo   | $0.05/call | Small brands, resellers           |
| **Ultra** | $199/mo       | 10,000/mo  | $0.03/call | Mid-market brands, marketplaces   |
| **Mega**  | $499/mo       | 100,000/mo | $0.01/call | Enterprise, high-volume platforms |

Set each tier in the RapidAPI provider dashboard under "Plans."

### 6. Enable authentication

- Header: `X-RapidAPI-Key`
- The existing `/api/v1/verify` route already reads `X-RapidAPI-Key` (see
  [`app/api/v1/verify/route.ts`](../app/api/v1/verify/route.ts:10)) and
  forwards it to the `authichain-api.undone-k.workers.dev` worker.
- No code changes needed on your side.

### 7. Test each endpoint from the RapidAPI playground

RapidAPI generates an in-browser test UI from the OpenAPI spec. Click
through each of the 14 operations and confirm they return 200s against a
known-good product ID. Use this as a working test serial:

```
AC-LVMH-2024-001
```

(Or register a real test product first via `POST /api/v1/register`.)

### 8. Add a sample code snippet for the readme

RapidAPI lets you paste a "quickstart" code block that appears on the
listing page. Use this:

````markdown
### Quick start (Node.js)

```js
import fetch from "node-fetch";

const res = await fetch(
  "https://authichain.com/api/v1/verify?id=AC-LVMH-2024-001",
  {
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": "authichain-product-verification.p.rapidapi.com",
    },
  }
);

const data = await res.json();
console.log(data.verified); // true
console.log(data.confidence); // 0.95
console.log(data.blockchainProof); // 0x...
```

### Quick start (curl)

```bash
curl -X GET \
  'https://authichain.com/api/v1/verify?id=AC-LVMH-2024-001' \
  -H 'X-RapidAPI-Key: YOUR_KEY' \
  -H 'X-RapidAPI-Host: authichain-product-verification.p.rapidapi.com'
```
````

### 9. Submit for review

Hit the "Submit for Review" button. RapidAPI typically approves within
24–48 hours. You'll get an email when the listing goes live at:

```
https://rapidapi.com/authichain/api/authichain-product-verification
```

(Exact URL depends on the slug RapidAPI assigns.)

## Post-submission follow-ups

Once the listing is live:

1. **Update the false claim in `outputs/agentz-v5-investor.md`**
   - Currently line 54 says: _"Live API with 7 endpoints on RapidAPI marketplace"_
   - Before approval this is aspirational. After approval it's true.
2. **Add the RapidAPI badge + link to the AuthiChain homepage** (replace
   the existing "Book a demo" CTA for the developer audience)
3. **Post about it on Show HN** — see [`launch-kit.md`](./launch-kit.md)
4. **Add the listing URL to `outputs/rapidapi-listing.json`** under a new
   `live_url` field so the repo has ground truth
5. **Check weekly** — first week after launch, check subscriber count
   daily; after that, weekly

## Why this is the highest-leverage no-calls unlock

- **Zero incremental work** once submitted: RapidAPI drives its own
  marketplace traffic
- **Pre-existing search intent**: devs search for "product verification
  API" and currently find competitors
- **Self-serve conversion funnel**: free tier → usage → paid tier, no
  human in the loop
- **Compounding distribution**: the listing doesn't decay like a launch
  post; it keeps earning impressions forever
- **Directly monetizes what's already deployed** — the Cloudflare worker
  is live, the Next.js API routes are live, the smart contract is live

## Related files

- OpenAPI spec: [`outputs/authichain-openapi.json`](../outputs/authichain-openapi.json)
- RapidAPI listing config (source of truth): [`outputs/rapidapi-listing.json`](../outputs/rapidapi-listing.json)
- Verify route (proxy → CF worker): [`app/api/v1/verify/route.ts`](../app/api/v1/verify/route.ts)
- Full v1 API tree: `app/api/v1/` (14+ operations)
- Smart contract: [`contracts/AuthiChainNFT.sol`](../contracts/AuthiChainNFT.sol)
