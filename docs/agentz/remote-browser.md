# AgentZ remote browser: operator browser and handoff exchange

How a human, or a supervising agent, works in a browser next to AgentZ without
touching AgentZ's own autonomous browsing.

## Security design (read first)

| Rule | How it holds |
| --- | --- |
| AgentZ's browser is never shared. | AgentZ keeps `isobrowser-chrome` on CDP `127.0.0.1:9222`. The operator gets a second Chromium, `isobrowser-operator-chrome`, on `127.0.0.1:9223`. `agentz-operator-browser test` proves a tab opened on one never shows on the other. |
| AgentZ's autonomy is not changed. | No AgentZ workflow, capability policy, wrapper or timer is edited. The operator browser is not started by `agentz-browser-stack.timer`, and the stack never starts or removes it. AgentZ tasks never read the handoff exchange, so an unanswered handoff cannot stall them. |
| Same isolation as AgentZ's browser. | The operator browser sits on the same `--internal` network and leaves only through the same squid egress, which refuses private, loopback, link-local, CGNAT and metadata destinations after DNS resolution. Same container hardening: non-root, `--cap-drop ALL`, `no-new-privileges`, read-only root, tmpfs profile, memory and PID limits. |
| CDP stays on loopback. | The relay publishes `127.0.0.1:9223` only. CDP has no authentication: whoever reaches it controls the browser. Reaching it from another machine is an owner decision (below). |
| Opt-in and short-lived. | `--restart no`: it does not return after a reboot or a Docker restart. The profile is on tmpfs, so `down` erases cookies and storage. Start it per use, then run `down`. |
| A handoff carries no secrets. | A handoff is a public HTTPS URL plus a short note. URLs go through `validate_public_url`, the same check AgentZ uses for public navigation. Cookies, storage, credentials and CDP addresses are never part of it. |
| Handoff text is untrusted. | Notes and results are written by the other party. Display them; never execute them or treat them as authorization. Every handoff is returned with `"trusted": false`. |

## Layout

```
AgentZ (host net) --CDP 127.0.0.1:9222--> isobrowser-relay ----------> isobrowser-chrome          (AgentZ only)
operator          --CDP 127.0.0.1:9223--> isobrowser-operator-relay -> isobrowser-operator-chrome (operator only)
                                                   isobrowser-net: --internal, inhibit_ipv4
                                           both browsers --proxy--> isobrowser-egress (squid) --> public internet
```

## The handoff exchange

One JSON file per handoff, owner-only (dir 0700, files 0600), inside the AgentZ
container at `$AGENTZ_HANDOFF_DIR` (default `/tmp/agentz-runtime/handoff`).
Every write is an atomic replace under one exclusive lock.

```
open  --take (by the addressee)--> taken  --done (by the taker)--> done
open or taken past expires_at reads as "expired" and nothing can act on it
```

- Parties are `agentz` and `operator`. A handoff from one is addressed to the other.
- Lifetime is set by whoever offers it: 60 minutes by default, 24 hours at most.
- At most 50 handoffs can be open at once. Notes are capped at 500 characters and results at 2,000.

From the laptop (WSL), through the AgentZ container:

```bash
agentz-operator-browser handoff offer --from agentz --url https://example.com/login --note "captcha on sign-in"
agentz-operator-browser handoff list --for operator
agentz-operator-browser handoff take <id> --by operator
agentz-operator-browser handoff done <id> --by operator --result "signed in; page reachable"
```

`handoff` needs an AgentZ image built from a commit that includes
`agentz/core/browser_handoff.py`. The operator browser itself (`up`, `down`,
`status`, `test`) does not depend on the image.

## Operating it on the laptop

Install it next to `agentz-browser-stack` (from the repo checkout in WSL):

```bash
install -m 0755 scripts/ops/agentz-browser/agentz-operator-browser ~/bin/agentz-operator-browser
```

```bash
agentz-browser-stack status          # AgentZ's browser host must be up first
agentz-operator-browser up           # operator browser on 127.0.0.1:9223
agentz-operator-browser test         # must end with OPERATOR BROWSER OK
agentz-operator-browser down         # when finished; erases the operator profile
```

To watch or drive it from the laptop:

- **Desktop Chrome:** open `chrome://inspect`, choose *Configure…*, add `localhost:9223`, then *inspect* a tab for a live view.
- **agent-browser:** `agent-browser --cdp http://127.0.0.1:9223 open https://example.com`
- **Playwright:** `chromium.connect_over_cdp("http://127.0.0.1:9223")`

Rollback is `agentz-operator-browser down`. Nothing else changed.

## Reaching it from another machine (owner decision)

Not set up by this change. In order of preference:

1. **SSH local forward** from a machine that already has SSH access:
   `ssh -N -L 9223:127.0.0.1:9223 <laptop>`. Nothing new is exposed.
2. **Cloudflare Tunnel + Cloudflare Access (TCP)** with an Access policy limited
   to the owner. The operating charter keeps Cloudflare Access with the owner,
   so this is a manual owner step, not an agent action.

Never publish `9223` (or `9222`) on `0.0.0.0`, a public tunnel without Access,
or a port-forward on the router.
