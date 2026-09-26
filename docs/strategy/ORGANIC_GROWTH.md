# Organic growth (x402 rail)

One rail. Health is the source of truth. Everything else copies it.

## Loops

1. **Discovery** — `GET /api/x402/health` → catalog → `/api/x402/listing` → directories.
2. **Skills** — a paid route that already 402s gets a `GROWTH_SKILLS` row and an MCP tool. Do not advertise a skill that is not live.
3. **Sisters** — `qron.space`, `strainchain.io`, `govchain.us` alias the same `X402_PAY_TO`, asset, and price. They are origins, not second treasuries.
4. **Revenue** — a directory crawls the listing pack → an agent pays the 402 → USDC lands on the owner-authorized treasury.

## Rules

- Do not rebind `X402_PAY_TO` away from `0xaebf…e437`.
- Do not type `0x5db5…` into a directory form. That EOA still holds `$QRON`. It is not live settlement.
- Do not put `$QRON` in x402 `accepts[]`.
- Do not invent a facilitator. Stay on `https://facilitator.payai.network`.
- Price on a listing must match `health.pricePerCall.usd` (live `$0.05`).
- PayAPI probes the unpaid paid-route. Homepage URLs fail. Use `https://authichain.com/api/v1/agent-verify`.

## Live URLs

- Health: https://authichain.com/api/x402/health
- Catalog: https://authichain.com/api/x402/catalog
- Listing pack: https://authichain.com/api/x402/listing
- Growth registry: https://authichain.com/api/x402/growth
- MCP: https://authichain.com/mcp
- Docs: https://authichain.com/x402
- PayAPI list form: https://payapi.market/list
- PayAPI agent MCP: https://payapi.market/mcp

## Adding surface area

1. Ship the paid route on the worker.
2. Confirm unpaid POST returns HTTP 402 to live `payTo`.
3. Add one `GROWTH_SKILLS` row.
4. Redeploy. Listing pack and growth registry pick it up.
5. Submit or refresh directory rows from `/api/x402/listing`, not from memory.
