# AuthiChain GS1 resolver + passport + clone state machine

Drop-in slice for `undone0603/authichain-unified`.

```
workers/gs1-resolver/     Cloudflare Worker (resolver + state machine)
src/app/passport/[id]/    Consumer passport page
src/app/01/[...gs1]/      Same-origin GS1 path → resolver
src/lib/passport.ts       Fetch helper
```

## What it does

1. Resolves GS1 Digital Link URLs (`/01/{gtin}/21/{serial}`) and AuthiChain certs (`/cert/{id}`).
2. Returns JSON for machines (`Accept: application/json` or `/v1/passport/{id}`).
3. 302s browsers to `/passport/{certId}`.
4. First scan moves `issued → active`. Multi-region bursts move `active → clone_suspected → cloned`.
5. Ships a demo seal `AC-DEMO-001` so the loop works before D1 is applied.

## Deploy (Cloudflare, $0)

```bash
cd workers/gs1-resolver
npx wrangler d1 execute authichain-provenance --file=src/schema.sql
npx wrangler deploy
npx wrangler secret put ISSUE_SECRET
```

Point `id.authichain.com` at this worker. Set:

```
NEXT_PUBLIC_RESOLVER_ORIGIN=https://id.authichain.com
```

## Demo without D1

`wrangler dev` uses the in-memory seed.

```
GET  /health
GET  /cert/AC-DEMO-001          Accept: application/json
GET  /01/00012345678905/21/AC-DEMO-001
POST /v1/scan  { "cert_id": "AC-DEMO-001", "country": "US" }
POST /v1/issue { "gtin":"9506000134352", "serial":"UNIT-9", "brand":"Acme" }
POST /v1/revoke { "cert_id":"AC-DEMO-001" }
```

Print a QR that encodes:

`https://id.authichain.com/01/00012345678905/21/AC-DEMO-001`

Scan 1 (Michigan) → Authentic. Replay from DE/JP/BR inside 6 hours → Clone suspected / Cloned.

## Honest limits

- Geo is country + optional CF colo, not GPS.
- A cloned QR is detected by scan graph, not by chemistry of the ink.
- No tx hash on the demo seal until you mint.
