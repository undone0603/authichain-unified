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
GET  /.well-known/gs1resolver
GET  /cert/AC-DEMO-001            Accept: application/json   # scans
GET  /01/00012345678905/21/AC-DEMO-001                       # scans
GET  /v1/passport/AC-DEMO-001                                # read-only
POST /issue { "gtin":"9506000134352", "serial":"UNIT-9", "brand":"Acme" }
```

Corrected 2026-09-11. This list previously advertised `/v1/scan`, `/v1/issue`
and `/v1/revoke`, none of which the worker implements, and `/v1/passport/{id}`,
which it did not implement either -- so `src/lib/passport.ts`, which called it,
404'd on every request. The endpoint now exists and the list matches the code.

**The two kinds of GET are not interchangeable.** A Digital Link path (`/01/...`)
or `/cert/{id}` is a _scan_: it records a scan row and can advance the seal's
status, including into `clone_suspected`. `/v1/passport/{id}` is a _read_: it
returns the same payload, writes nothing, and never changes status. Any surface
that renders a passport without a person having scanned something -- a web page,
a dashboard, a preview -- must use the read endpoint, or its own renders will be
counted as scans from whatever regions it renders in.

Print a QR that encodes:

`https://id.authichain.com/01/00012345678905/21/AC-DEMO-001`

Scan 1 (Michigan) → Authentic. Replay from DE/JP/BR inside 6 hours → Clone suspected / Cloned.

## Honest limits

- Geo is country + optional CF colo, not GPS.
- A cloned QR is detected by scan graph, not by chemistry of the ink.
- No tx hash on the demo seal until you mint.
