# ReqBin-REST MCP Plugin (`agentz-reqbin-rest-mcp`)

Zero-dependency REST/HTTP and MCP JSON-RPC 2.0 probe plugin for `undone0603/authichain-unified`, runnable both as a **Cloudflare Worker** and a **local Node.js MCP server** (`stdio` or HTTP).

## Tools
- **`http_request`** — Execute `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, or `OPTIONS` requests with custom headers, query params, JSON/raw body, and timeout/size caps.
- **`mcp_probe`** — Run `GET` discovery, `initialize`, `tools/list`, and `tools/call` against any MCP Streamable-HTTP endpoint (e.g., `https://signal.authichain.com/mcp`).
- **`batch_health_check`** — Probe up to 10 URLs in parallel and return HTTP status codes and latencies.

## Security Defaults
- `https:` only (`ALLOW_INSECURE_HTTP=true` to allow `http:` locally).
- Private/loopback/metadata IPs (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `localhost`, etc.) are blocked unless explicitly listed in `REQBIN_ALLOWLIST`.
- Sensitive headers (`Authorization`, `X-API-Key`, `X-Internal-Secret`, `Cookie`, `Set-Cookie`) are redacted in tool responses.
- Optional bearer auth via `REQBIN_BEARER_TOKEN`.

## Install & Test in `authichain-unified`

```bash
cd /mnt/c/Users/rac/authichain-unified
mkdir -p agentz/reqbin-rest-mcp
# Extract reqbin-rest-mcp.zip into agentz/reqbin-rest-mcp/
node --test agentz/reqbin-rest-mcp/test/reqbin-rest.test.mjs
```

## Deploy as Cloudflare Worker

```bash
cd /mnt/c/Users/rac/authichain-unified
npx wrangler secret put REQBIN_BEARER_TOKEN -c agentz/reqbin-rest-mcp/wrangler.toml
npx wrangler deploy -c agentz/reqbin-rest-mcp/wrangler.toml
```

## Run Locally (`stdio` or HTTP)

```bash
cd /mnt/c/Users/rac/authichain-unified
node agentz/reqbin-rest-mcp/local-server.mjs --stdio
# Or HTTP on http://127.0.0.1:8788/mcp:
node agentz/reqbin-rest-mcp/local-server.mjs
```
