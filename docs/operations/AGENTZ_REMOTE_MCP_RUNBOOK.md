# AgentZ MCP executor — operational runbook

## Current status

`agentz/mcp_browser_server.py` is a **local stdio MCP server**, not a
remote URL. Do not claim ChatGPT connectivity until a compatible authenticated
remote gateway is deployed and a live tool invocation succeeds.

## Zero-subscription-cost local deployment

On the owner-controlled host, from the repository root:

```bash
python -m pip install -r requirements-agentz.txt
pnpm --dir apps/agent-browser install --frozen-lockfile
pnpm --dir apps/agent-browser build
mkdir -p "$HOME/.local/share/agentz/browser-evidence"
chmod 700 "$HOME/.local/share/agentz/browser-evidence"
```

Set `AGENTZ_BROWSER_BIN` to an actual executable entrypoint for the
built browser CLI; `AGENTZ_BROWSER_EVIDENCE_DIR` to the private directory;
and inject `AGENTZ_GITHUB_CODE_TOKEN` via the host secret manager with only
the repository contents permissions required for scoped feature branches.
Never place tokens in Git, logs or the MCP client configuration.

Use the installed browser CLI's own setup procedure to install its browser
runtime. Run `python -m agentz.mcp_browser_server` from the repository root
with an MCP client using stdio transport.

`AGENTZ_BROWSER_NETWORK_ISOLATED=true` is **not proof** of isolation.
Only set it after enforcing outbound firewall restrictions blocking loopback,
RFC1918, link-local, metadata services and private DNS resolutions for the
browser process and all redirects. Run a network-layer negative test.

## Remote access

Use a trusted MCP gateway on the same host/private network that:
1. Terminates TLS and authenticates each client with a separate identity.
2. Exposes only named MCP tools, with request limits, audit records, and
   concurrency limits; no generic shell or unrestricted browser scripting.
3. Forwards calls to the local stdio MCP server, without exposing the
   AgentZ API Bearer token.
4. Supports revocation and short-lived credentials.
5. Publishes a stable HTTPS MCP endpoint through a free-tier tunnel or
   an already-owned domain, only after confirming the actual cost is $0.

This repository does not yet provide that remote gateway. A local MCP client
configuration is not sufficient for ChatGPT remote callability.

## Readiness acceptance

- [ ] Native unit tests run successfully on exact PR head
- [ ] Browser binary exists and browser runtime launches
- [ ] Private evidence directory exists with mode 0700
- [ ] Navigation blocks private targets, DNS rebinding and redirects
- [ ] GitHub code token scoped to development permissions
- [ ] Stdio MCP initialize/list_tools/call_tool succeeds
- [ ] Remote gateway authenticates and denies anonymous calls
- [ ] Remote connector invokes a real read-only task
- [ ] Production dispatch remains disabled until server-verified release gates

The MCP `readiness` tool reports presence of prerequisites, not an
independent proof that the host is secure or production-ready.
