# Calling AgentZ: terminal, `@agentz` comments, isolated browser

## Terminal

Short form: **`z`** (Windows `%USERPROFILE%\.local\bin\z.cmd`, WSL `~/bin/z` -> `agentz`).

```
z                          status
z example.com              browse (any URL or domain)
z what is x402 pricing     research (any multi-word input; quotes optional)
z w launch_                workflows      z run <id>   dry-run      z b|r|s   browse|research|status
```

`agentz` is on PATH in PowerShell/cmd (`%USERPROFILE%\.local\bin\agentz.cmd`, which forwards to WSL)
and in WSL (`~/bin/agentz`). It talks to the local AgentZ API on `127.0.0.1:8000` and reads
`AGENT_SECRET` from `~/.config/agentz/env` without printing it.

```
agentz status                      service, identity, isolated browser, workflow count
agentz browse https://example.com  read a public page through the isolated browser
agentz research "<question>" -n 5   TinyFish search + read top results via the isolated browser
                                   -> cited note in ~/.local/share/agentz/research/ (no summarizing)
agentz workflows launch_           list workflow ids (filtered)
agentz run launch_score_prospects  dry-run a workflow (k=v args become JSON parameters)
agentz run <id> --live             live run; asks you to type the id to confirm
agentz results | agents | launch | score | control | identity
agentz api GET /launch/state       raw authenticated call
agentz cli list                    python -m agentz.cli inside the container (with AgentZ's env loaded)
agentz browser status|test|up|down manage the isolated browser host
```

## Key possession (`z verify`)

`z verify` proves that the key AgentZ is given is the one it publishes. It runs AgentZ's own
`identity.py` possession check, compares the result with the roster on main and the live
`did.json`, and signs a fresh challenge. No key material leaves the container.

`z verify --publish` also signs an operator-binding proof: an EdDSA JWS whose `kid` is
`did:web:authichain.com:agents:agentz#key-1` and whose freshness value is the current main commit.
It publishes the proof as a public gist from the logged-in gh account, then re-checks the published
copy with `verify_proof.py`, which anyone can run with only `cryptography` installed.

Latest proof: https://gist.github.com/undone0603/b3a5fe4338d417036852a7297937c2b3

## `@agentz` in GitHub comments

`.github/workflows/agentz-mention.yml`. The first line of an issue, PR or PR review comment that
starts with `@agentz` runs one of:

| comment | effect |
|---|---|
| `@agentz status` | health and workflow count |
| `@agentz workflows [filter]` | workflow list |
| `@agentz browse <https-url>` | page snapshot from the isolated browser (collapsed, marked untrusted) |
| `@agentz research <question>` | top 3 search results read through the isolated browser, cited (needs the `/agentz/research` endpoint) |
| `@agentz run <workflow_id> [k=v ...]` | **dry-run only** |
| `@agentz help` | command table |

Only the repository OWNER can trigger it (the job `if` is checked before a runner or secret is
used). It runs on the self-hosted WSL runner, checks nothing out, parses the comment in Python, and
calls `https://agentz.authichain.com` with `AGENT_SECRET` plus the Cloudflare Access service token.
Live runs are not available from comments; use *AgentZ — Manual post*.

## Network-isolated browser host

`POST /agentz/browser/navigate` refuses to run unless `AGENTZ_BROWSER_NETWORK_ISOLATED=true`.
That flag is set only because of this layout (`scripts/ops/agentz-browser/agentz-browser-stack`):

```
AgentZ (host net) --CDP 127.0.0.1:9222--> isobrowser-relay (alpine/socat)
                                              |  isobrowser-net: --internal, inhibit_ipv4
                                              v  (host has no address on it)
                                          isobrowser-chrome (chromedp/headless-shell)
                                              |  --proxy-server, only way out
                                              v
                                          isobrowser-egress (squid) --> public internet
                                          denies 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16,
                                          100.64/10, ::1, fc00::/7, fe80::/10 ... after DNS resolution
```

- The browser host contains no AgentZ code (separate images, `isobrowser-*` names), so
  `agentz-laws-check` non-replication still holds.
- `agentz/runtime/agentz-browser` (the `AGENTZ_BROWSER_BIN` wrapper, baked into the image by the image PR) is fail-closed: local isolated host first,
  then Browserbase (`BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`) or Browser Use
  (`BROWSER_USE_API_KEY`) if set, otherwise exit 3. It never launches a local Chromium.
- `agentz-browser-stack test` proves public HTTPS works and that direct egress, host ports,
  private ranges, cloud metadata and a DNS name resolving to 127.0.0.1 are all refused.
- `agentz-browser-stack.timer` runs `ensure` every 10 minutes: restarts the stack if CDP is down and
  re-copies the sha256-pinned `agent-browser` v0.43.0 into the AgentZ container if it was recreated.
  Durable fix: bake `agent-browser` + the wrapper into the AgentZ image.
- A human or supervising agent never attaches to this browser. They use the separate operator
  browser on `127.0.0.1:9223` and hand pages back and forth through the handoff exchange:
  [remote-browser.md](remote-browser.md).
