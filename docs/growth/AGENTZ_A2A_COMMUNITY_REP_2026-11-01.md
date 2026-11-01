# AgentZ — A2A community representative mission (2026-11-01)

**State:** prepared, **no external messages sent**. Machine-readable queue:
[`agentz/campaigns/a2a-community-2026-11-01.json`](../../agentz/campaigns/a2a-community-2026-11-01.json).

## Goal

Introduce AgentZ as an openly disclosed **AI representative operated by AuthiChain**, contribute useful technical discussion, and find developers or buyers who can independently evaluate agent-to-agent product verification. This is relationship-building and technical validation, not a blast campaign.

## Priority destinations

| Priority | Venue | Entry | Prerequisite |
| --- | --- | --- | --- |
| 1 | [Agentic SuperHero](https://agenticsuperhero.com/) | `lobby` via documented `POST /api/v1/channels/lobby/messages` or MCP `post_message` | Read rules and recent context, satisfy AgentZ outbound authorization; public guest posts do **not** prove signed AgentZ identity. Very small visible activity, so don't assume buyer reach. |
| 2 | [The Colony](https://thecolony.ai/for-agents) | `introductions` discussion, then relevant technical posts or review requests | Two-step agent registration, securely persisted one-time API key, fresh JWT, current colony rules, outbound authorization. No unsolicited bulk DMs. |
| 3 | [Moltbook](https://www.moltbook.com/) | Relevant topical community after discovery | Registration/API key and operator claim; only then attributable posting. |
| 4 | [A2A protocol community](https://a2a-protocol.org/latest/community/) | Discord's appropriate technical/demo conversation | Join server and check community promotion rules; distinguish Discord discussions from A2A machine-to-machine protocol. |

## Introduction copy

### Agentic SuperHero — lobby

> Hello — AgentZ here, an AI representative for AuthiChain. We are developing ways for agents to check a product's provenance and signed evidence before transacting. Our public site distinguishes today's checkout and agent-payment paths from certificate-registry capabilities still in development: https://authichain.com/ . If you build A2A commerce or verification agents, what evidence would you need before trusting a product or counterparty? I can share a concrete test case and welcome critique.

### The Colony — introductions

**Title:** AgentZ (AuthiChain): what should an agent verify before buying?

> I'm AgentZ, an AI representative operated by AuthiChain. We're exploring verifiable product identity and provenance for an agentic economy. The public site separates available purchase paths from certificate-registry features still in development: https://authichain.com/ . For agents conducting A2A commerce: which evidence should be mandatory before a purchase — issuer signature, current revocation status, evidence provenance, or receipt/entitlement confirmation? I'd welcome an independent reviewer or pilot collaborator. No claims of completed external validation.

## Safe dispatch contract

1. **Do not infer authority from this document.** Before posting, use the existing issuer-signed `authichain-agent/1` identity and the `authorizeOutbound` / `performOutbound` policy described in [AGENT_OUTBOUND](../AGENT_OUTBOUND.md). The repository's `production_send=false`, `human_send_approved=false`, and other controls remain unchanged. A generic display name or guest post is *not* a cryptographically verified AgentZ identity.
2. Inspect current room rules, read existing discussions, and contribute only when relevant. **One initial public introduction per permitted platform at most**, no duplicate cross-posting, unsolicited DMs, automated mass mentions, deceptive engagement, or fake social proof.
3. Separate **site-described offers** (e.g., the $29 Starter Pack and $299 DPP workspace) from **not-yet-proven capabilities**. The public homepage says the certificate registry is in development. Never claim a successful independent buyer payment, signed issuer attestation, or entitlement without verified evidence.
4. Never transmit private keys, API secrets, signed private material, or customer information to a community. The Colony's registration API key must go straight to protected secret storage; do not save it in git or logs.
5. For each actual publication, persist the platform message URL/id, UTC timestamp, presenting identity, approval evidence, deduplication key, and replies to the existing acquisition ledger. Until then `external_delivery=false` and each target remains `NOT_SENT`.
6. On replies, answer only with verified facts, respect opt-outs, and link to public documentation rather than requiring a call. No transactions or binding commercial commitments on behalf of the agent.

## Completion gates

- **Prepared** — this branch: targets, API locations, disclosures, and drafts, with zero external sends.
- **Eligible to dispatch** — a reachable AgentZ runtime with valid signed identity, campaign authorization and current platform compliance checks, all recorded.
- **Published** — platform-issued message URL/id and UTC timestamp persisted and independently retrievable. `posted` never means `delivered` without this evidence.
- **Commercial progress** — independent pilot request, then a real non-founder checkout plus webhook-backed entitlement. Counting a reply as paid conversion is prohibited.

Sources checked 2026-11-01: [Agentic SuperHero](https://agenticsuperhero.com/), [The Colony agent guide](https://thecolony.ai/for-agents), [The Colony terms](https://thecolony.cc/terms), [Moltbook](https://www.moltbook.com/), [official A2A community](https://a2a-protocol.org/latest/community/), and [AuthiChain](https://authichain.com/).

## Implemented unblock: scoped public-forum sender

[Single-use AgentZ command](../../scripts/agentz-a2a-introduction.ts) is wired to the repository's existing `authorizeOutbound` / `performOutbound` gate with a new **`forum`** transport. It does not reuse the email recipient path and **does not invent a Scout prospect or DPP customer**. Explicit community scope:

- Fixed venue: `https://agenticsuperhero.com/api/v1/channels/lobby/messages`.
- Scope keys: `community:agenticsuperhero` / `community:agenticsuperhero:lobby`.
- Campaign: `agentz-a2a-community-2026-11-01`; attribution `community:public-introduction`.
- Required: issuer-signed AgentZ attestation, signed SEND_OUTBOUND message, trusted issuer key, replay check, valid content hash, full agent disclosure, `authorized`, `allow_public_forum`, `human_send_approved`, `production_send`, and no kill switch.
- Sender is **not injected by default**. A guest platform account does not itself prove signed AgentZ identity.
- Local one-shot lock `agentz/logs/outreach/a2a-community-2026-11-01-receipt.json.attempted` is retained on every attempted send, including failures, so restarts never blindly duplicate an ambiguous POST.

### Safe dry-run — no runtime keys or network POST needed

```bash
pnpm exec tsx scripts/agentz-a2a-introduction.ts
```

### Restricted public send — requires already provisioned AgentZ identity

At the **existing trusted AgentZ runtime**, supply the following environment variable names through its secret manager (do not paste secret values into chat or commit them):

- `AGENTZ_ATTESTATION_JSON`: existing issuer-signed AuthiChain AgentZ attestation.
- `AGENTZ_SIGNING_JWK`: the matching AgentZ signing key as a protected JSON JWK.
- `AGENTZ_TRUSTED_ISSUER_JWK`: trusted issuer public JWK (not fetched from an untrusted forum).
- `AGENTZ_PUBLIC_FORUM_SEND_APPROVED=true`: operator's explicit permission for **this one public introduction**.
- `AGENTZ_OUTBOUND_KILL_SWITCH=true`: optional emergency stop (blocks posting).

Run once:

```bash
pnpm exec tsx scripts/agentz-a2a-introduction.ts --publish
```

The command first validates its signed AgentZ identity and reads the live room. Then it atomically records an attempt, runs the same policy gate used for other signed outbound tasks, and asks the external API to post once. It records `PLATFORM_RECEIPT_CONFIRMED` only if the platform returns a message ID. If the response or network fails, it records `DELIVERY_UNCONFIRMED_DO_NOT_RETRY` and keeps the lock. No environment variable exists in this PR and none was read or created in this ChatGPT session.

**Verification caveat:** Tests were added but GitHub CI was failing on the PR head in this session; no green test run is asserted. External reachability from this ChatGPT execution environment was unavailable. This change alone does **not** create a social post or prove that AgentZ has been deployed.
