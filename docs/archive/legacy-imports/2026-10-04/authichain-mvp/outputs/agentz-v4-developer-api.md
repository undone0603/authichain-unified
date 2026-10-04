# Agentz v4 — Developer API Guide

## Overview

The AuthiChain API provides programmatic access to blockchain-backed product verification. Built for developers integrating authenticity checks into e-commerce platforms, mobile apps, supply chain systems, and marketplaces.

## Base URL

```
https://authichain.com/api/v1
```

## Authentication

All requests require an API key via the `X-RapidAPI-Key` header (RapidAPI) or `Authorization: Bearer <key>` (direct).

```bash
curl -H "X-RapidAPI-Key: YOUR_KEY" \
  "https://authichain.com/api/v1/verify?id=AC-LVMH-2024-001"
```

## Endpoints (7)

### 1. GET /verify — Quick verification

```bash
GET /verify?id=AC-LVMH-2024-001
```

Returns: `verified`, `confidence`, `product` metadata, `blockchain` proof.

### 2. POST /verify — Enhanced verification (with NFC)

```json
POST /verify
{ "productId": "AC-LVMH-2024-001", "nfcHash": "sha256:a1b2c3..." }
```

NFC hash bumps confidence from 0.95 to 0.99.

### 3. POST /verify/batch — Batch verification

```json
POST /verify/batch
{ "productIds": ["AC-LVMH-2024-001", "AC-NIKE-2024-042"] }
```

Up to 50 products per request. Returns `results[]`, `total`, `verified`, `failed`.

### 4. GET /products/{productId} — Product details

Full product metadata, registration history, and blockchain proof.

### 5. GET /products/{productId}/history — Scan history

```json
{
  "productId": "AC-LVMH-2024-001",
  "scans": [
    {
      "timestamp": "2026-03-15T10:00:00Z",
      "method": "nfc",
      "verified": true,
      "confidence": 0.99
    }
  ],
  "totalScans": 42
}
```

### 6. GET /brands/{brandId}/products — List brand products

Paginated list of all registered products for a brand. Supports `page` and `limit` params.

### 7. POST /register — Register a product

```json
POST /register
{
  "name": "Product Name",
  "brand": "Brand Name",
  "category": "luxury-handbags",
  "serialNumber": "SN-12345",
  "nfcHash": "sha256:...",
  "metadata": {}
}
```

Returns: `productId`, `txHash`, `tokenId`, `registeredAt`.

## Response Codes

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | Success                         |
| 201  | Product registered              |
| 400  | Bad request (missing params)    |
| 401  | Unauthorized (invalid API key)  |
| 404  | Product not found               |
| 429  | Rate limit exceeded             |
| 503  | Service temporarily unavailable |

## Rate Limits

| Tier  | Requests/Month | Price   |
| ----- | -------------- | ------- |
| Basic | 100            | Free    |
| Pro   | 1,000          | $49/mo  |
| Ultra | 10,000         | $199/mo |
| Mega  | 100,000        | $499/mo |

Overage: Pro $0.05/call, Ultra $0.03/call, Mega $0.01/call.

## SDKs & Integration

### JavaScript/Node.js

```javascript
const response = await fetch(
  "https://authichain.com/api/v1/verify?id=AC-LVMH-2024-001",
  {
    headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY },
  }
);
const { verified, confidence, blockchain } = await response.json();
```

### Python

```python
import requests

resp = requests.get(
    'https://authichain.com/api/v1/verify',
    params={'id': 'AC-LVMH-2024-001'},
    headers={'X-RapidAPI-Key': RAPIDAPI_KEY}
)
data = resp.json()
print(f"Verified: {data['verified']}, Confidence: {data['confidence']}")
```

### Webhook (coming soon)

Subscribe to verification events for real-time alerts on suspicious scan patterns.

## Blockchain Details

- **Chain:** Base (Ethereum L2)
- **Contract:** ERC-721 (each product = unique NFT)
- **Explorer:** Transactions verifiable on BaseScan
- **Finality:** ~2 seconds on Base L2

## Support

- Email: authichain@gmail.com
- Docs: https://authichain.com/docs
- Status: https://authichain.com/api/v1/health
