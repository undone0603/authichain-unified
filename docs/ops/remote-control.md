# Remote Control — driving a local Claude Code session from phone or browser

Remote Control connects [claude.ai/code](https://claude.ai/code) or the Claude
mobile app to a `claude` process running **on your own machine**. The phone or
browser is only a window. Code runs, files change and MCP servers are reached
on the local machine the whole time.

Upstream reference: <https://code.claude.com/docs/en/remote-control>. When it
and this page disagree, upstream is right; fix this page.

## Where it sits in the autonomous stack

`docs/OPERATING_CHARTER.md` requires the autonomous stack to run without the
owner's computer. Remote Control does the opposite, because it depends on a
local process that must stay running. That puts it in the charter's
**manual** lane: a tool the owner uses to steer work already in progress.

- Never make a loop, workflow or Routine depend on a Remote Control session.
  Anything that has to run unattended belongs in GitHub Actions or a cloud
  session, classified in `.github/autonomy.json`.
- The charter's "always waits for the owner" list still applies to anything
  you ask for from the phone. Steering from a phone doesn't remove any gate.

| Need                                                       | Use                                              |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Carry on local work (local MCP, secrets, LAN) from phone   | **Remote Control**                               |
| Start a task with no local setup, or run tasks in parallel | Cloud session at claude.ai/code                  |
| Recurring, unattended work                                 | GitHub Actions loop (charter) or a cloud Routine |

## Requirements

- A claude.ai **Pro, Max, Team or Enterprise** login. API-key auth,
  `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper` and `claude setup-token` tokens don't work.
  If you're on Team or Enterprise, an Owner has to enable the Remote Control
  toggle first.
- The session must talk to `api.anthropic.com` directly: not Bedrock, Agent
  Platform or Foundry, and no custom `ANTHROPIC_BASE_URL`.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `DISABLE_GROWTHBOOK` must be
  unset.
- Run `claude` once in the repo root and accept the workspace trust dialog.

## Start it

From the repo root:

```bash
claude remote-control --spawn worktree --name "AuthiChain"
```

- `--spawn worktree` gives every session you start from the phone its own git
  worktree, so parallel sessions don't edit the same files. The session
  created at startup stays in the repo root. Press `w` to toggle the mode.
- Press the spacebar to show a QR code, and scan it with the Claude app.
- On a remote or headless box, run it inside `tmux` or `screen` so it survives
  an SSH disconnect.

Other ways to start it:

| From                     | Command                                |
| ------------------------ | -------------------------------------- |
| New interactive terminal | `claude --remote-control "AuthiChain"` |
| Existing CLI session     | `/remote-control` (or `/rc`)           |
| VS Code / Desktop app    | `/remote-control` in the prompt box    |

`/rc active` in the terminal footer means it's connected. Run
`/remote-control` again to see the URL and QR code, or to disconnect.

### Auto-connect

This repo **can't** switch auto-connect on for everyone. Claude Code ignores
`remoteControlAtStartup: true` in `.claude/settings.json` and only honours
`false`. Turn it on per person in one of these places:

- `/config` → **Enable Remote Control for all sessions** → `true`, or
- `"remoteControlAtStartup": true` in `~/.claude/settings.json`.

## Resuming after you stop the server

For about 4 hours after Ctrl+C, run one of these in the same directory:

| Command                                   | Brings back                          |
| ----------------------------------------- | ------------------------------------ |
| `claude remote-control`                   | Every session the server was serving |
| `claude remote-control --continue`        | Only the session it started with     |
| `claude remote-control --session-id <id>` | One session (id from the URL)        |

For sessions started with `--remote-control` or `/rc`, use `claude --continue`
or `claude --resume` instead.

## Push notifications

1. Sign in to the Claude mobile app with the same account and organization,
   and allow notifications.
2. In the terminal, run `/config` and turn on **Push when actions required**
   (permission prompts and questions). **Push when Claude decides** is optional.
3. If `/config` says **No mobile registered**, open the app once so it
   refreshes its push token.

## Security posture

- Your machine only makes outbound HTTPS calls. It opens no inbound ports.
- While connected, the transcript is stored on Anthropic servers. Don't paste
  secrets into the conversation. Keep them in env files the session reads locally.
- **Trusted Devices** (beta): the owner should turn on **Require trusted
  devices** (Pro/Max: Account or Cowork settings; Team/Enterprise: Admin →
  Capabilities → Remote sessions). Each device then has to enroll, and
  sign-ins older than 18 hours need a biometric step-up. Revoke lost devices at
  claude.ai/settings/account → Trusted devices.
- To switch Remote Control off entirely on a machine, set
  `disableRemoteControl` in settings.

## Troubleshooting

| Symptom                                                | Fix                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| "requires a claude.ai subscription" / names an API key | `claude auth login` (claude.ai option); unset the named variable        |
| "requires a full-scope login token"                    | Stop using `CLAUDE_CODE_OAUTH_TOKEN`; `claude auth login`               |
| "isn't enabled for this account"                       | `claude auth logout && claude auth login`; `claude doctor`              |
| "only available when using … api.anthropic.com"        | Unset `ANTHROPIC_BASE_URL` / `CLAUDE_CODE_USE_*`                        |
| "requires feature-flag evaluation"                     | Unset `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK` |
| "Couldn't verify your organization's policy"           | Network or VPN not ready; retry `/remote-control`                       |
| "Remote credentials fetch failed"                      | `claude remote-control --verbose`; check the proxy allows port 443      |
| "unexpected server response"                           | `claude update`, then `/remote-control`                                 |
| Server-mode session crashed                            | Send it a message from the device; it restarts (v2.1.238+)              |
| Server exited after ~10 min offline                    | Re-run `claude remote-control`                                          |

`/plugin` and `/resume` only work in the local terminal. Most text commands
work from the phone (`/compact`, `/clear`, `/model <name>`,
`/effort <level>`, `/mcp`, `/config key=value`).
