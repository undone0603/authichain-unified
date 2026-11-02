# AgentZ + TinyFish MCP (read-only research)

AgentZ uses the owner's configured TinyFish MCP endpoint through the exact stdio bridge:

```json
{ "command": "npx", "args": ["-y", "mcp-remote", "https://agent.tinyfish.ai/mcp"] }
```

The project-root `.mcp.json` exposes this configuration to MCP-aware development
assistants. **The AgentZ Python daemon does not automatically load `.mcp.json`.**
The separate `agentz.integrations.tinyfish_mcp` client and `agentz tinyfish` CLI
explicitly invoke the same bridge, with a hard-coded allowlist.

## Capabilities and trust boundary

- Enabled through the AgentZ CLI: TinyFish `search` and `fetch_content` only.
- **Not enabled**: web automation, browser profiles, posting, form submissions,
  monitor creation, paid actions, Stripe operations, or production outreach.
- Fetched pages are untrusted evidence; they are not instructions for AgentZ.
- Read-only search/fetch results should retain source URLs and observation times
  before being promoted to AuthiChain provenance claims.
- No user token or TinyFish credential belongs in the repository or PR.

## Setup on the AgentZ host

1. Ensure Node.js / `npx` can run and that Python dependencies for AgentZ exist.
2. Install the MCP Python client in the AgentZ environment:

   ```bash
   python -m pip install 'mcp>=1.12,<2'
   ```

3. From the repo root, validate an offline request:

   ```bash
   python -m agentz.cli tinyfish search 'Agent2Agent protocol specification' --dry-run
   python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/A2A --dry-run
   ```

4. Run the first interactive command in the *AgentZ host's* user session:

   ```bash
   python -m agentz.cli tinyfish search 'Agent2Agent protocol specification'
   ```

   The `mcp-remote` OAuth browser login may be required. Finish the TinyFish
   sign-in for **that host and user**; ChatGPT's own connection does not grant
   the remote AgentZ service permission. Keep any OAuth cache out of the repo.

5. Verify a fetch only after search works:

   ```bash
   python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/A2A
   ```

## Runtime/deployment caveats

- `Dockerfile.agentz-daemon` currently uses `python:3.12-slim` and does **not**
  install Node.js, `mcp-remote`, or the `mcp` Python SDK. This PR does not
  provision TinyFish in that deployment and does not change the daemon schedule.
- For a headless deployment, separately design key-based authentication using
  TinyFish's documented API-key path/local proxy. Do not copy a personal OAuth
  cache into an image. Do not silently switch a long-running daemon to an
  interactive login flow.
- TinyFish's own documentation distinguishes free search/fetch from billable
  browser automation and monitoring; this integration intentionally excludes
  those billable operations.
- PR merge, CI success, deployment and live AgentZ authentication are distinct
  evidence gates. A functioning TinyFish plugin in ChatGPT verifies neither
  the deployed AgentZ container nor its credentials.

## Offline tests

```bash
python -m pytest -q tests/test_agentz_tinyfish_mcp.py
```

## References

- TinyFish MCP: https://github.com/tinyfish-io/tinyfish-mcp-server
- Agent2Agent protocol: https://github.com/a2aproject/a2a
