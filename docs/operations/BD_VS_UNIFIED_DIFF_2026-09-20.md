# BD sibling vs `authichain-unified` workflow diff

**Snapshot:** 2026-09-20 (ET)  
**Method:** Read the copied BD/revenue-engine sources under `/workspace/notes/pulled-from-undone0603/` and queried the remote repository with `gh api` Contents/Tree endpoints. No repository was cloned.

## 1. What `authichain-unified` already covers

### Revenue and outbound

- **Daily autonomous pipeline:** `.github/workflows/pipeline-tick.yml` runs `server/jobs/pipeline-tick.ts` with Supabase/HubSpot/Apollo context, dry-run support, and `server/outreach/send-guard.ts` as the outbound gate.
- **B2B prospecting:** `.github/workflows/b2b-outreach.yml` runs `scripts/b2b-cold-outreach.ts` for GovChain, StrainChain, QRON, partners, and high-leverage segments. It has dry-run-by-default behavior, `OWNER_LIVE_SEND`, sender preflight, Apollo/CRM resolution, verified provenance, suppression checks, a two-send live cap, queue/flush behavior, and Resend delivery.
- **Government proposals:** `.github/workflows/email-proposals.yml` handles scheduled/manual proposal email with the same fail-closed live-send switch, unsubscribe/address requirements, and failure notification.
- **Warm-lead conversion and revenue health:** `.github/workflows/revenue-cycle.yml` plus `scripts/revenue-cycle.ts` already cover provenance repair, Stripe checkout-link attachment, proposal flags, closer-task enqueueing, dunning, Supabase lead/proposal/revenue reporting, and 30-day Stripe totals. It explicitly avoids guessed-email cold sends.
- **AgentZ revenue handlers:** The remote tree contains hot-lead activation, HubSpot-to-Cloudflare outreach sync, growth-loop scouting, pipeline reporting (Supabase/HubSpot/Stripe), executive reporting, and revenue-cycle handlers under `agentz/workflows/handlers/`.

### Content, SEO, and traffic

- **Validated social publishing:** `.github/workflows/content-publish.yml` is the sole live publisher for LinkedIn, Reddit, X, Telegram, and webhook fan-out. It validates every `content/social/*.json`, has scheduled/manual dry-run behavior, concurrency serialization, credential preflight, and a `.published.json` ledger to prevent reposts.
- **Content routine integration:** `.github/workflows/content-routine-pr.yml` opens PRs from content-routine branches, auto-merges content-only diffs, and leaves out-of-scope changes for review.
- **Marketing automation:** `.github/workflows/marketing-autonomous.yml` performs IndexNow and Google Search Console sitemap pings and exposes content-draft paths. Its old hardcoded LinkedIn/Reddit jobs are explicitly retired in favor of validated bundles.
- **Programmatic SEO:** `.github/workflows/gen-seo-pages.yml` regenerates `content/seo/pages.json` weekly and commits only when changed.
- **Inbound discovery and media:** `.github/workflows/reddit-monitor.yml` scans RSS feeds every six hours and creates de-duplicated, value-first GitHub issues; `.github/workflows/weekly-video.yml` produces the QRON informational video/YouTube loop when credentials are available.
- **AgentZ marketing handlers:** `agentz/core/marketing.py` has trend/content generation and hook learning; `authichain_social_launch.py`, `linkedin_post.py`, and `twitter_post.py` cover social distribution paths (with dry-run modes); outreach core has idempotent pending-DM storage and A/B hook support.

### Health, scheduled operations, and guardrails

- The workflow inventory includes ecosystem health, token metrics, subscription/customer health, retention, dunning, competitive monitoring, and automation task routes under `autonomous-business-cycle.yml`; its old scheduled app routes are retired and the file is manual-only.
- `guardrail-digest.yml` is also retired/manual-only because it points at the deleted `app.authichain.com` app. The live revenue/outreach workflows use the current send guard, provenance rules, caps, and suppression mechanisms instead.
- The unified repository therefore already has the important **delivery and safety plane**. BD code should not introduce another sender, social publisher, cron family, or lead ledger.

## 2. Unique value still only in the BD/revenue-engine copies

| Capability found only in the inspected sibling copies | Source | Gap/qualification in unified |
|---|---|---|
| **Lifecycle nurture state machine:** cold/warm/hot/customer tiers; behavior, profile, intent, and return-visit scoring; time decay; new-lead webhook; onboarding, re-engagement, token-holder, and upsell sequences; pending-email queue | `authichain-ai-business-manager/workers/customer-engagement/index.js` | Unified has CRM/ICP scoring, cold outreach, proposals, checkout CTAs, and dunning, but no single post-capture lifecycle state machine covering onboarding, inactivity, customer expansion, and token-holder messaging. |
| **Deterministic multi-brand content planner:** five ecosystem brands, daily brand rotation, weekly theme and content-angle rotation, exactly five output formats (X single/thread, LinkedIn, Discord, newsletter), plus template fallback | `authichain-ai-business-manager/scripts/generate-content.js` | Unified can generate/receive content and publish validated bundles, and AgentZ has trend generation, but no equivalent deterministic cross-brand planner that feeds the bundle surface. |
| **Persistent content calendar/queue contract:** weekly calendar, pending queue, templates endpoint, and a storage-backed engagement record | `authichain-ai-business-manager/workers/social-engine/index.js` | Unified has file bundles and a publish ledger, not the BD worker's explicit calendar/queue API. The worker's engagement numbers are placeholders, so only the calendar/queue shape is valuable. |
| **Cross-ecosystem weekly digest:** one HTML/JSON artifact joining four-domain uptime, content counts by platform, token/network metrics, CRM totals/pipeline, and next-week priorities | `authichain-ai-business-manager/scripts/weekly-digest.js` | Unified has separate revenue, guardrail, pipeline, health, and token paths. Its guardrail digest is retired and is not this executive operating digest. |
| **D1/Airtable deal-subscription metric adapter:** total deals/value, active subscriptions, MRR, pipeline value, conversion rate, annualized revenue, and Airtable revenue-metric sync | `authichain-unified-revenue-engine/workers/src/services/revenue-tracker.ts` | Unified's current report is Supabase/Stripe-centric. It has revenue records and Stripe totals, but not this D1 deal/subscription plus Airtable KPI join. Port as an adapter only if those systems remain canonical. |
| **Simple cross-repository/domain daily operations report:** all four domain HEAD checks, Polygon `$QRON` supply/block read, GitHub commit activity, issue alerts, and daily/evening priorities | `authichain-ai-business-manager/workers/daily-tasks/index.js` | Unified has ecosystem-health/token-metrics task routes and richer pipeline/revenue reporting. The only non-duplicate value is the unified operator summary, not another set of timers. |

## 3. Recommended ports (maximum three, ranked)

### 1. Port the customer lifecycle/nurture semantics into the existing pipeline (highest revenue impact)

**Port:** tiered scoring inputs and sequence state from the BD customer-engagement worker, not its storage or sender. Preserve its strongest parts: explicit lifecycle states, time-decay/re-engagement, onboarding steps after activation, and customer/token-holder expansion paths.

**Destination paths:**

- New `server/services/customer-lifecycle.ts` for tier transitions, next-action calculation, sequence timing, and idempotency.
- Existing `server/jobs/pipeline-tick.ts` to evaluate due lifecycle events in the same daily pipeline tick.
- Existing `server/outreach/send-guard.ts` and the current Resend/send path for any actual email.
- Existing Supabase `leads`/activity model (or the repository's current event table) for state; do not create a second KV lead ledger.

**Acceptance criteria:** every transition is repeat-safe; replies, opt-outs, suppression, verified provenance, and live-send caps remain hard gates; onboarding and re-engagement events are observable; customer upsell is distinct from cold outreach. This fills the largest revenue gap without duplicating unified scoring or delivery.

### 2. Port the deterministic multi-brand planner into validated social bundles (highest traffic impact)

**Port:** the BD theme/brand/angle rotation and five-format output contract, optionally the useful calendar shape from `social-engine`. Do not port its publisher or placeholder engagement metrics.

**Destination paths:**

- New `scripts/generate-social-bundles.ts` (or `.mjs`) that writes dated JSON bundles under `content/social/`.
- `content/social/` as the only handoff surface.
- `.github/workflows/content-routine-pr.yml` for review/auto-merge of content-only changes.
- Existing `.github/workflows/content-publish.yml` and `scripts/validate-social-bundle.mjs` remain the only publishing path.

**Acceptance criteria:** all claims pass the existing validator/source review; Reddit bundles include affiliation disclosure; generation defaults to drafts/dry-run; no generated file can bypass the bundle validator or published ledger; brand rotation is deterministic and idempotent. This adds consistent weekly traffic coverage without creating a second social engine.

### 3. Port one executive operating digest, backed by unified revenue data (medium-high revenue/retention impact)

**Port:** the BD weekly digest layout and the revenue-engine metric set as one report: health, content/publish counts, leads/pipeline, deals/subscriptions/MRR where canonical, Stripe totals, and next actions. Treat `RevenueTracker` as a field/query mapping reference, not as a second ledger.

**Destination paths:**

- New `scripts/weekly-executive-digest.ts` (or `server/jobs/executive-digest.ts`).
- Existing `scripts/revenue-cycle.ts` report functions as the revenue input, plus Supabase/Stripe and the `content/social/.published.json` ledger.
- Existing `.github/workflows/revenue-cycle.yml` Monday report schedule as the trigger; send an internal digest through the repository's current Resend/email helper, not the retired `app.authichain.com/api/guardrail/digest` route.
- If D1/Airtable are still authoritative, add a narrowly scoped `server/services/revenue-metrics.ts` adapter and document the source-of-truth boundary before enabling it.

**Acceptance criteria:** one immutable weekly artifact with source timestamps and missing-data labels; no fabricated uptime/engagement/revenue; digest delivery is internal and idempotent; it links to the actual pipeline, checkout, and published-content evidence. This makes the existing revenue/traffic machinery actionable without another workflow family.

## 4. Explicit DO NOT PORT list (duplicates/noise)

1. **Do not port `daily-tasks/index.js` wholesale** or add its 6:00/12:00/18:00/every-four-hours cron family. Unified already has ecosystem-health/token-metrics task routes, pipeline ticks, and reporting. Reuse a health/token field only if the digest needs it.
2. **Do not port `social-engine/index.js` as another Worker, queue, calendar API, or publisher.** Unified already owns `content/social/`, `content-publish.yml`, validator, credentials, concurrency, and the published ledger. Port only the planner/calendar data model if needed.
3. **Do not copy `generate-content.js` fallback templates or hardcoded claims as-is.** The generated copy includes unsupported/aging quantitative claims; all new content must use current sourced facts and unified bundle validation.
4. **Do not create a third lead scorer or duplicate email-template library.** `authichain-unified-revenue-engine/workers/src/services/lead-scoring.ts`, `email-engine.ts`, `automation/pipeline.py`, and unified's live outreach scripts substantially overlap. Port lifecycle transitions and missing sequences around the existing unified score.
5. **Do not port `automation/pipeline.py` wholesale.** It is legacy orchestration around `manus-mcp-cli`, direct SMTP/MCP assumptions, a hardcoded webhook, and a local `/home/ubuntu/...` output path. Port only reviewed scoring/template ideas or the D1/Airtable metric mapping.
6. **Do not port direct Gmail SMTP, browser-driven social posting, or direct X/LinkedIn DMs** from the sibling/AgentZ paths into a new cron. They bypass the unified send guard, provenance, opt-out, validator, and ledger controls. Any future channel must call the existing guarded boundary.
7. **Do not port placeholder engagement collection** from `social-engine` (`likes/shares/comments: 0`) or treat it as analytics. Add a real provider/event source first.
8. **Do not re-enable the retired triggers:** `guardrail-digest.yml` (deleted app endpoint), `dpp-outreach-trigger.yml` and `outreach-trigger.yml` (exhausted queues/deliverability warnings), or the retired schedules in `autonomous-business-cycle.yml`, without a current endpoint, repopulated queue, authenticated sender, and an explicit dry-run proof.
9. **Do not port AgentZ social-launch/LinkedIn/Twitter handlers as a parallel publisher.** Their browser automation is duplicate capability and weaker than the validated-bundle path unless it is explicitly refactored to consume validated bundles and record the same ledger.
10. **Do not copy secrets, webhook URLs, fixed CRM IDs, or stale contract/marketing claims** from the local revenue-engine notes into unified source. Resolve all credentials through repository secrets/variables and make every metric/claim source-addressable.
