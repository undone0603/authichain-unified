# Publish paths

Split the machines. AgentZ publishes. Grok Bot does not.

## Path A — AgentZ + OpenClaw + xurl (default for live posts)

On the OpenClaw host that runs AgentZ

1. Confirm the binary — `xurl auth status` then `xurl whoami`.
2. Account must be `@Undone0603` with tweet.write.
3. Publish — `xurl post "exact text"`.
4. Capture the returned post id and build `https://x.com/Undone0603/status/<id>`.

Never read or print `~/.xurl`. Never ask the owner to paste tokens into Grok.

If xurl is missing, install on that host only (`brew install --cask xdevplatform/tap/xurl` or `@xdevplatform/xurl`). Auth stays on that host.

## Path B — This Grok chat (draft only)

Research with read-only X tools. Emit the output pack. STATUS stays DRAFT unless AgentZ returns a live URL.

## Path C — Grok Bot + Cursor (not the publisher)

Bot id `be68e544-29a7-4bc6-a3f0-dcedc1e94d83`. Official X plugin is read-only. Use for code, files, research. Do not send it to click Post on x.com as the production path.

## Path D — Paid or extra MCP

Only if the owner names Buffer, OpenTweet, Postiz, etc. Prefer xurl to stay on the $0 stack.

## Confirm live

STATUS becomes PUBLISHED only with an `x.com/Undone0603/status/<id>` URL from xurl or the owner.
