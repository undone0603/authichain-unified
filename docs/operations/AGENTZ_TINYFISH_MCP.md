# AgentZ + TinyFish MCP (read-only research)

## Architecture

The project-root `.mcp.json` retains the user's exact developer-client bridge:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://agent.tinyfish.ai/mcp"]
}
```

**AgentZ's Python service does not load `.mcp.json`.** It uses
`agentz.integrations.tinyfish_mcp` through `python -m agentz.cli tinyfish`
and chooses one of two transports:

- **Headless / production-capable:** If `TINYFISH_API_KEY` is set, the Python MCP SDK connects directly to `https://agent.tinyfish.ai/mcp` over Streamable HTTP with an `X-API-Key` header; Node.js is not required.
- **Interactive developer fallback:** If no API key exists, the same adapter runs `npx -y mcp-remote https://agent.tinyfish.ai/mcp`, using that host user's OAuth session. This requires Node.js, `npx`, and usually first-run browser authentication.

The Python MCP SDK is included in `requirements-agentz.txt`. The existing
`Dockerfile.agentz-daemon` installs those requirements, but its scheduled task
does **not** invoke TinyFish automatically. Deployment, a secured `TINYFISH_API_KEY`
runtime secret, and an explicit authorized research workflow remain separate
gates.

## Capabilities and trust boundary

- **Allowed:** `search` and `fetch_content`, each explicitly validated in the CLI.
- **Not enabled:** browser automations, signed-in profile control, monitoring,
  posting, form submissions, payment actions, external messaging, or outreach.
- Webpage text and search snippets are **untrusted evidence**, never executable
  instructions to AgentZ. Preserve URL and retrieval time before citing.
- URL validation blocks private IP literals and common numeric aliases, but
  cannot prove that any DNS hostname stays public; rely on TinyFish's own
  network safety controls as well.
- Neither API key nor OAuth cache belongs in code, Docker layers, CI logs,
  PRs, audit records, or stdout.
- Any new tools or write operations require a separate policy review.

## Local setup and testing

```bash
python -m pip install -r requirements-agentz.txt
python -m pytest -q tests/test_agentz_tinyfish_mcp.py
python -m agentz.cli tinyfish search 'Agent2Agent protocol specification' --dry-run
python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/a2a --dry-run
```

### Headless AgentZ host (preferred for noninteractive execution)

1. Create a TinyFish API key at https://agent.tinyfish.ai/api-keys.
2. Inject it as the runtime secret `TINYFISH_API_KEY`, using your host's
   secure secret manager. Do not paste it into a GitHub file or command log.
3. After the code has passed review and is deployed to that runtime, run:

```bash
python -m agentz.cli tinyfish search 'Agent2Agent protocol specification'
python -m agentz.cli tinyfish fetch_content https://github.com/a2aproject/a2a
```

The adapter sends `X-API-Key` to the hosted MCP endpoint when the secret is
present. Its dry-run prints **only the selected transport**, never the key.

### Local OAuth fallback

Without `TINYFISH_API_KEY`, install Node.js/`npx` and run the same commands.
The first call may open `mcp-remote` OAuth sign-in on **that host**. ChatGPT's
TinyFish connection does not authenticate the AgentZ host.

## Release evidence requirements

Record separately: local tests; repo CI; accepted PR/merge; dependency install;
remote AgentZ auth; live Search+Fetch; and deployed service revision.
Fail-closed on transport errors. A successful ChatGPT TinyFish search is not
proof that remote AgentZ has started.

## References

- [TinyFish MCP server and API-key documentation](https://github.com/tinyfish-io/tinyfish-mcp-server)
- [TinyFish MCP integration](https://docs.tinyfish.ai/mcp-integration)
- [Agent2Agent protocol](https://github.com/a2aproject/a2a)
