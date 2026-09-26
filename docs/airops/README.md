# AirOps free-tier setup for authichain-unified

AirOps has no GitHub connector and no Grok connector. This pack is the workspace config: paste it into a Solo / start-for-free account at [app.airops.com](https://app.airops.com).

Official plan page: [airops.com/pricing](https://www.airops.com/pricing)

## Stay on free

| Cap | Use it this way |
| --- | --- |
| 1 Brand Kit | One kit named **AuthiChain**. Product lines cover QRON, StrainChain, GovChain. Do not create a second kit. |
| 3 Knowledge Bases | `AC Public Product`, `AC Repo Docs`, `AC Live Sites`. Do not add a fourth. |
| ChatGPT Insights only | Track ChatGPT prompts. Gemini / Perplexity / AI Overviews are paid. |
| Tasks | Insights tracking does not burn Playbook/Workflow tasks. Do not turn on scheduled Playbooks or Workflows. Manual Quill / one Playbook test only. |
| 1 seat | Sign up with `authichain@gmail.com`. Do not invite extra users. |
| Overage | Solo overage is billed at $0.025 / task after the monthly allotment. Never enable auto-run grids. |

If the signup screen offers Insights vs Solo, take **Solo / Start for free**. It is the current public free entry on the pricing page.

## Setup order (20 minutes)

1. Create the account. Skip paid trial upsells.
2. Brand Kit → paste `docs/airops/BRAND_KIT.md`.
3. Create the three Knowledge Bases in `docs/airops/KNOWLEDGE_BASES.md`.
4. Add tracked prompts from `docs/airops/TRACKED_PROMPTS.md` (cap at ~25 on day one).
5. Track owned pages listed in that same file.
6. Leave Playbooks, Workflows, CMS publish, and scheduled runs off.
7. Optional: Settings → MCP Connectors → GitHub MCP only if you already have a fine-scoped PAT. Not required for free-tier value.

## What AirOps is for here

AirOps is the **AI-search visibility + on-brand copy** layer for the public product in `undone0603/authichain-unified`.

It is not CI, not deploy, not AgentZ, and not a CMS for authichain.com.

## Never load into a Knowledge Base

- `.env*`, secrets, Stripe keys, worker tokens
- Internal ops metrics, bounce rates, revenue plumbing
- `docs/CAPABILITIES.md` (estate internals)
- `docs/OPERATING_CHARTER.md` (autonomy / outreach gates)
- Private outreach repo content
- Maison Élite / dropship experiments

Public-safe sources only. See `KB_PUBLIC_PRODUCT.md`.
