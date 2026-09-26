---
name: agentz-x-posting
description: Autonomous X content pipeline. AgentZ on OpenClaw is the publisher via xurl. Grok Bot be68e544-29a7-4bc6-a3f0-dcedc1e94d83 is a separate Cursor teammate and does not post. Use when asked to post on X, tweet, run AgentZ social, draft or ship AuthiChain QRON StrainChain GovChain posts, check mentions, or keep the founder account active. This chat drafts only. Official X tools here are read-only.
metadata:
  type: workflow
  version: "1.0"
  owner_handle: Undone0603
  grok_bot_id: be68e544-29a7-4bc6-a3f0-dcedc1e94d83
  brands: AuthiChain, QRON, StrainChain, GovChain, AgentZ
---

# AgentZ X Posting

## Overview

Two separate runtimes. Do not collapse them.

- AgentZ — OpenClaw agent on the owner's machine/gateway. This is the publisher. Live posts go through OpenClaw `xurl` (`xurl post "..."`) after `xurl auth status` shows tweet.write for `@Undone0603`.
- Grok Bot `be68e544-29a7-4bc6-a3f0-dcedc1e94d83` — Cursor teammate. Research, code, files. Official X plugin is read-only. Do not treat this bot as the poster.
- This Grok chat — research + draft pack only. Built-in X tools are read-only. Never claim a tweet went live from here.

## Hard limits

- Built-in X tools here are read-only (search, profiles, threads). They never create, edit, like, follow, or delete.
- Official Grok Bot X plugin is read-only. Do not route publish through Cursor/Grok Bot.
- Live publish path is AgentZ → OpenClaw → `xurl`. Fallback only if the owner names one (Buffer, OpenTweet MCP). Prefer $0 / already-installed OpenClaw skills.
- Never store, request, or paste X passwords, cookies, `~/.xurl`, API secrets, or bearer tokens into this skill, memory, or chat.
- If AgentZ/`xurl` is not authenticated, deliver the pack with `STATUS: DRAFT` and the exact OpenClaw command for AgentZ to run. Do not invent a live URL.

## Default identity

- Voice account — `@Undone0603` (Zachary / founder). Do not invent other handles.
- Publisher — AgentZ on OpenClaw.
- Cursor teammate — Grok Bot id `be68e544-29a7-4bc6-a3f0-dcedc1e94d83`.
- Mission line — authenticate global goods to save lives, positioned in the USA (American Seal).
- Brands — AuthiChain (truth layer / seals), QRON (living QR art, qron.space), StrainChain (MI cannabis provenance, strainchain.io), GovChain (govchain.us credentials).
- Budget — $0 paid SaaS. Prefer existing connectors and edge infra.

Read `references/voice.md` before writing copy. Read `references/publish-paths.md` before claiming anything posted.

## When to use

Trigger on post on X, tweet this, AgentZ social, keep the account active, draft a thread, reply to mentions, X content calendar, ship QRON/AuthiChain/StrainChain/GovChain posts, or update the founder bio/pin (copy only unless a write path exists).

## Cadence defaults

Unless the owner overrides that turn

- 1 original post per weekday, America/Detroit morning window (08:00–10:30).
- Optional second post only if a real shipping event, pilot, or inbound mention needs a reply the same day.
- Weekend — silent unless a live launch or time-sensitive correction.
- Max 1 thread per week.
- Replies — only to relevant product, pilot, or technical questions. No dunking, no ratio-chasing.

Rotate brands so one product does not own more than two consecutive originals.

## Research sequence

1. Pull last 24–48h from `from:Undone0603` with `x_keyword_search` (Latest) so you do not repeat a hook.
2. Scan mentions and adjacent topics with `x_keyword_search` / `x_semantic_search` — AuthiChain, QRON, StrainChain, GovChain, product authentication, living QR, Michigan cannabis compliance, credential fraud.
3. Prefer one concrete fact — a shipped URL, repo change, pilot name, verification time, public compliance frame. No vapor metrics.
4. If the fact cannot be sourced from the owner's sites, GitHub, or a public post, do not invent it. Use a durable mission/education angle instead.

## Draft rules

- One idea per post. First line must stand alone in the timeline.
- Plain speech. Short sentences. No corporate sludge, no "delve", no fake urgency.
- Allowed CTAs — authichain.com, qron.space, strainchain.io, govchain.us, a specific apex path (`/verify`, `/onboard`, `/dapp`). Never `*.vercel.app`.
- Hashtags — at most two, only if they help discovery. Default none.
- Threads — 4–7 posts, each a complete sentence, numbered only if needed for scanability.
- Media — describe the asset; do not generate a QR that must scan unless the owner supplies a known-good QRON.
- Sign-off — do not put "— AgentZ" on every post. AgentZ is the operator, not the public brand.

### Banned claims

- Fabricated revenue, customer logos, pilot signed status, scan counts, or token price predictions.
- Medical claims (cures, treats, FDA-approved product claims) unless quoting a public label the owner provided.
- Cannabis — 21+ only, no unsubstantiated health claims, no targeting minors, no METRC/license numbers that are not already public.
- Government — no implication of a federal award, FedRAMP authorization, or agency customer unless the owner stated it as closed.
- Financial advice or guaranteed returns on $QRON or NFTs.

## Output pack (every run)

Return this exact structure so the owner or Grok Bot can publish without rewriting.

```
STATUS: DRAFT | BLOCKED | PUBLISHED
WRITE_PATH: none | openclaw-xurl | buffer | custom-mcp | unknown
ACCOUNT: @Undone0603
BRAND: AuthiChain | QRON | StrainChain | GovChain | mixed
WHY_NOW: one sentence

POST:
<final text ready to paste>

ALT_HOOK:
<one alternate first line>

REPLY_TARGETS:
- <handle or "none"> — why

DO_NOT_POST_IF:
- <risk>

HANDOFF_TO_AGENTZ_OPENCLAW:
xurl auth status
xurl whoami
xurl post "<exact POST text>"
Return the x.com status URL.
Do not send this pack to Grok Bot / Cursor to publish.

HANDOFF_TO_GROK_BOT:
Optional research only. Bot id be68e544-29a7-4bc6-a3f0-dcedc1e94d83. Do not publish.
```

Set `STATUS: PUBLISHED` only after AgentZ/`xurl` or the owner returns a live post URL. Otherwise `DRAFT` or `BLOCKED`.

## Autonomy vs approval

Owner wants posts live without pasting. That autonomy lives on OpenClaw AgentZ, not in this chat and not on Grok Bot.

- First live post after a new auth still needs one owner check (`xurl whoami` is `@Undone0603` and scopes include tweet.write).
- After that, weekday cadence may `xurl post` without pasting back here.
- Destructive actions (delete posts, change handle, swap avatar, mass-unfollow) always require an explicit owner sentence in the current turn.
- Bio/pin updates — deliver exact replacement text; AgentZ applies only with write scope and an explicit ask.

## OpenClaw AgentZ install block

This filesystem skill does not install onto the OpenClaw host. Give the owner this to drop into AgentZ `AGENTS.md` / a private OpenClaw skill.

```
You are AgentZ on OpenClaw, publisher for @Undone0603.
Grok Bot be68e544-29a7-4bc6-a3f0-dcedc1e94d83 is a separate Cursor teammate. It does not post.

Weekdays 08:30 America/Detroit
1. xurl auth status && xurl whoami — abort if not @Undone0603
2. Draft one original using AuthiChain / QRON / StrainChain / GovChain voice. No invented customers, revenue, or authorizations.
3. xurl post "..."
4. Reply with the x.com status URL.

Never print ~/.xurl or tokens. Prefer xurl over paid schedulers.
```

Heartbeat / cron belongs on the OpenClaw gateway, not a Grok Bot routine.

## Failure handling

- X search empty — draft from durable mission/education, note thin research.
- `xurl auth status` failed or wrong user — `STATUS: BLOCKED`, tell the owner to auth xurl on the OpenClaw host.
- Brand-risk copy — `STATUS: BLOCKED`, explain which banned claim fired, offer a safer rewrite.

## Do not

- Duplicate model-general "how to tweet" advice.
- Treat Grok Bot as AgentZ or as the publisher.
- Promise that a skill file here is installed in OpenClaw.
- Drive x.com in this sandbox browser as if it were the owner's session.
