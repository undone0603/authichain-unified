# Cedr v0.8.1 ↔ AuthiChain MCP Streamable HTTP handshake

Source release: https://github.com/Sheernox/cedr/releases/tag/v0.8.1
Protocol reviewed from `crates/cedr-core/src/remote.rs` at tag `v0.8.1`.
Scope: no-money, no-auth, no-wallet **read-only MCP handshake**, not third-party conformance.

## Run from AuthiChain checkout

```sh
node --test scripts/alliances/cedr-streamable-handshake.test.mjs
node scripts/alliances/cedr-streamable-handshake.mjs             # dry-run, no network
node scripts/alliances/cedr-streamable-handshake.mjs --live       # real HTTPS POST checks
```

The live command is **NOT verified here**: the test host had no external network DNS or Rust toolchain. A TinyFish Hoppscotch browser attempt stopped before pressing Send; therefore there was no HTTP response, and CORS remains hypothetical. The public `GET https://authichain.com/mcp` advertises a tool catalog but cannot prove Streamable HTTP conformance.

The live command sends an `initialize` JSON-RPC call with protocol `2025-06-18`, an optional `notifications/initialized`, and read-only `tools/list` with pagination. Credentials are omitted; redirects are disallowed; target is hard-coded to `https://authichain.com/mcp`. Responses are bounded, session ID is kept only in memory, failure and `402` do not trigger payment, and **no `tools/call` is performed**. Results are metadata only: a tool listing is not signed-record verification, issuer authorization, or product authenticity.

## Run actual Cedr binary in an isolated, authorized non-production host

Verify the upstream official GitHub release checksum/provenance and use a trusted clean checkout. Create `.mcp.json` containing only `{"mcpServers":{"authichain":{"type":"http","url":"https://authichain.com/mcp"}}}`; no tokens or env credentials. Run `cedr guard lock --remote` then `cedr guard remote --force --format json`. Cedr has stricter DNS/IP pinning, no redirects/proxies, request-size limits and full MCP handshake that the minimal Node probe does NOT implement. Capture command, version, time, exit code and sanitized JSON output. `failed`, `auth_required`, `unsupported` or `not_pinned` is NOT interoperability success.

Do **not** run untrusted PR code on the production publishing machine, bypass CI, merge economic changes, charge an x402 wallet, or claim a Cedr partnership because an MCP endpoint advertises tools.
