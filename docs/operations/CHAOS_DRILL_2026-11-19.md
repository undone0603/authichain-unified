# Chaos drill — 2026-11-19 (owner host, local only)

Fault injection against the AgentZ / Signal stack on the owner's machine. Nothing public was killed: the Signal origin and the tunnel serve `signal.authichain.com`, so they were inspected, not crashed.

| # | Fault | Result | Verdict |
|---|---|---|---|
| D1 | `SIGKILL` the AgentZ API (systemd user service) | Came back by itself in **14.5 s** (`Restart=always`, 5 s back-off, plus about 9 s uvicorn start) | ✅ self-healing |
| D2 | Start a second AgentZ instance **without `AGENT_SECRET`** | `/workflows` refused every request (no auth, a guessed bearer, an empty bearer) with **HTTP 500** | ⚠️ fails closed, but with a 500 crash response instead of a clear 503 "not configured" |
| D3 | Corrupt copies of `night-book.json`: NUL-filled (the Nov 14 incident), truncated, garbage, empty | Recovers from `.tmp` in all 4 modes. With no good copy it returns `value: null`, so `loadBook` refuses to start. A crash between the temp write and the rename leaves the main file intact. **9/9** | ✅ |
| D4 | Verify AgentZ-signed evidence with the **network removed** (`unshare -rn`) | `valid-unanchored`, digest matches | ✅ truly offline-verifiable |
| D5 | Is anything supervising the public-facing processes? | The runner tunnel has `Restart=always`. **The Signal server and the agentz-dex connector have no supervisor**: the Windows logon task `AuthiChain Signal stack` isn't registered. | ❌ the cause of the Nov 14–18 outage is still open |
| D6 | OpenClaw bridge unreachable | Clean JSON error (`unreachable: Connection refused`), no crash. Exit code is 0. | ⚠️ graceful, but exit 0 hides the failure from automation |
| — | Reasoning model for AgentZ's planner | Ollama is up with **no models**; LM Studio isn't reachable at `:1234` | ❌ AgentZ runs workflows but has no model doing the thinking |

## Fixes, in priority order
1. **Supervise Signal (D5).** The owner registers `scripts/register-signal-autostart.ps1` in `agentz-dex-terminal`. A watchdog loop is also on AgentZ's backlog (`watchdog`).
2. **Give AgentZ a local reasoning model.** For example, `ollama pull qwen2.5:7b-instruct` (about 4.7 GB, $0), with LM Studio pointed at it or the client set to the Ollama endpoint. Size it to free RAM: Windows was down to 0.4 GB free on 2026-11-19.
3. **D2:** have `verify_token` return 503 `agent secret not configured` instead of an unhandled 500.
4. **D6:** have `agentz openclaw status` exit non-zero when `health_ok` is false.

Ledger drill test: `agentz-dex-terminal/test/chaos-ledger.test.mjs`.
