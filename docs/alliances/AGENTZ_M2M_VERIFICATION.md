# AuthiChain ⇄ AgentZ: free M2M verification client

**Status:** independently observed one real, free MCP `tools/call verify_record` invocation through MCP Playground via TinyFish on November 2, 2026. The included Node.js M2M client has 17/17 local mock-transport tests; **its live network run has not been executed from this sandbox**, because local outbound DNS/network are unavailable. A production AgentZ daemon integration, full MCP certification and independently paid revenue are not established.

## Evidence

- Live third-party MCP client run: https://agent.tinyfish.ai/runs/b5105f66-f6c6-48f3-b386-710c676b32aa
- Endpoint: https://authichain.com/mcp
- Tool: `verify_record` (free); args `{"id":"polygon-anchor-1"}`.
- Server advertised `authichain` version `1.4.0` with seven tools. The free tool returned `verdict=verified`, `checks.signature=true`, `checks.anchorHash=true`, `anchorOnChain=true`, `anchorChainStatus=tx_contains_record_hash`, `source=published_example`, `demonstration=true`, and signer role `demonstration` / `productionIssuer=false`. The response does **not** prove physical product authenticity or a real buyer.
- No x402 payment, paid tool invocation, secrets, wallet, or GitHub posting occurred in this M2M check.

## Run the included machine-to-machine client

Requires Node.js 20+. No packages to install.

```sh
node --test m2m-verify.test.mjs
node m2m-verify.mjs             # offline dry-run (no HTTP)
node m2m-verify.mjs --live      # four bounded HTTPS POSTs to fixed public MCP URL
```

The live workflow performs `initialize` (`2025-06-18`), `notifications/initialized`, `tools/list`, and exactly one `tools/call` for free `verify_record` with the *fixed demonstration ID*. It rejects redirects, credentials, missing free-tool descriptions, failed protocol negotiation, non-200 success status, paywalls (402), and invalid tool results. It never sends a wallet payment header. Exit code `2` means inconclusive (not verified). Data returned by the server is **server-reported evidence, not independent cryptographic verification** by this client.

## Deployment boundary

This is a **reproducible client artifact and a verified example M2M exchange**, not an AgentZ production deployment. Do not silently install it on a production daemon or merge it around a blocked independent CI gate. To make it a production AgentZ capability, merge a reviewed PR after independent CI on the exact head, install it on the approved AgentZ host, and feed its machine-readable output into the existing evidence audit with explicit authority separation. Cedr's remote Guard verifies tool-surface drift only; Cedr does not implement this paid/free verification exchange.

## Sources

- AuthiChain public MCP: https://authichain.com/mcp
- Live demo HTTP result for comparison: https://authichain.com/api/verify?id=polygon-anchor-1
- Cedr issue: https://github.com/Sheernox/cedr/issues/7
- Public peer challenge: https://github.com/undone0603/authichain-unified/pull/2285
