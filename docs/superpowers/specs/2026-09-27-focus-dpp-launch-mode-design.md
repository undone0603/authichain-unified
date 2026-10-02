# Focus on EU DPP + agent distribution, launch mode — design

**Date:** 2026-09-27 · **Owner decision:** "go with A + B", "loosen all the gates till we get things running" · **Budget:** $0

## Why

Live numbers on 2026-09-27 (Stripe API, Supabase `QRON-v2`, Resend logs):

| Signal                               | Value                             |
| ------------------------------------ | --------------------------------- |
| Non-founder revenue, all time        | $0 (5 charges, all founder cards) |
| `visit_landing_page`, 30 days        | 48                                |
| Cold emails sent / replies, all time | 787 / 0 (534 more failed)         |
| Scheduled `b2b-outreach`             | red on 09-24 and 09-25            |
| Scheduled `agentz-orchestration`     | red (LAN AgentZ ping + webhook)   |

The autonomous stack exists. It has no traffic and no single offer. The
authichain.com sitemap lists 10 of 139 AuthiChain `/p/<slug>` SEO pages, so
most of the 47 DPP pages were never offered to search engines.

## Decision

- **A — one offer, search traffic.** Every surface routes to the $299
  EU DPP Readiness audit (`src/lib/plans.ts` `dpp_readiness`). Add a free,
  no-network DPP readiness checker as the top-of-funnel tool.
- **B — agents and developers.** List the live remote MCP server
  (`https://authichain.com/mcp`) in the official MCP registry and publish
  `authichain-verify` to npm. Add the checker as a free MCP tool.
- **Launch mode.** Loosen gates that only slow things down. Keep gates that
  are law, protect the sending domain, or spend money.

## Components

### A1. `src/lib/dpp-readiness.ts` (pure, tested)

Input: product category, EU market (placing / not), role (manufacturer,
importer, distributor, brand), and five yes/no data questions (unique product
identifier, supplier material data, carbon or environmental footprint data,
a public web location for product data, a named compliance owner).
Output: 0–100 score, band, dated obligation for the category, ordered gaps,
and the next step (the $299 audit link). Dates are copied from
`scripts/seo-data/regulatory.cjs` wording and public sources:

- Batteries (EV, LMT, industrial > 2 kWh): passport from **18 Feb 2027**
  (Reg. (EU) 2023/1542, Art. 77). Only category with a fixed legal date.
- Iron and steel, aluminium, tyres, textiles, furniture, mattresses: ESPR
  Working Plan 2025–2030 targets; obligations apply only after each delegated
  act, typically 18+ months later. Shown as "expected", never as law.
- Toys, construction products, detergents: own regulations with DPP or
  digital-label provisions; shown as "expected".
- Other: "no DPP obligation scheduled yet".

Truth rules: no invented dates, "expected" for anything not yet adopted,
disclaimer "Not legal advice".

### A2. `/dpp-check` page on `workers/authichain-com`

Server-rendered HTML form (GET). Submitting re-renders with the result, so it
works without JavaScript and is crawlable. Result block carries the existing
`checkoutEmailFormHtml` for `dpp_readiness`, which already captures a work
email for Stripe cart recovery and posts the `/api/funnel` event.
Added to the sitemap and `llms.txt`.

### A3. Sitemap covers every served SEO page

`scripts/gen-seo-pages.cjs` also writes `content/seo/sitemap-slugs.json`
(slug lists per domain, small). The landing worker imports that instead of the
800 KB `pages.json`. `gen-seo-pages.yml` commits both files. Every DPP page
body gets a link to `/dpp-check`.

### B1. Remote MCP tool `dpp_readiness_check`

Added to `workers/authichain-com/src/mcp-routes.ts` `tools/list` and
`tools/call`. Free. Same module as A1.

### B2. MCP registry listing

`server.json` at repo root: `io.github.undone0603/authichain`, remote
`streamable-http` `https://authichain.com/mcp`. Workflow
`mcp-registry-publish.yml` uses `mcp-publisher login github-oidc` (no secret).
Runs on push to `main` touching `server.json`, and on dispatch.

### B3. npm `authichain-verify`

Workflow `npm-publish-verify.yml` publishes `protocol/` when its version is
not yet on npm. It runs on manual dispatch only (AE-20261002-CFD-13): merging a
version bump to `main` does not publish. Uses `NPM_TOKEN` if set, otherwise npm trusted publishing
(OIDC). With neither, it logs a notice and exits green. The first publish of a
new package needs `NPM_TOKEN` once (npm does not allow a trusted publisher
before the package exists).

## Launch mode: gate changes (proposed, not in this PR)

Held for the owner: the agent session's safety check refused to apply these as a
security weakening. Each is a one-line change once the owner confirms.

| Gate                                      | Before                               | After                                                                            |
| ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Agent merges its own PRs                  | owner only                           | allowed when required checks pass, until first non-founder payment or 2026-12-31 |
| `agentz-orchestration` schedule           | dry-run                              | live qualify + HubSpot sync                                                      |
| AgentZ LAN ping / webhook                 | failing turns loop red               | warning only                                                                     |
| Cold-email sender preflight               | segment skipped on unverified sender | falls back to the verified `hello@authichain.com`                                |
| `cold_outreach.max_new_prospects_per_day` | 10                                   | 25 (guardrail channel cap)                                                       |
| `gov-engine` + stages                     | off                                  | on; ingest + notify live on schedule                                             |

Unchanged on purpose: CAN-SPAM footer, opt-out, verified-address and MX
checks (law); deliverability breaker (a tripped domain lands in spam anyway);
truth rule; `gov-score`/`gov-proposals` on schedule and `gov-mint` (they
spend model credits or gas, and the budget is $0); secrets, DNS and Stripe
prices (owner-only by access, not by rule).

## Success

- First non-founder payment on `dpp_readiness`.
- Leading indicators, read by the owner digest: `/dpp-check` result views,
  `visit_landing_page` per week, count of authichain.com URLs in the sitemap
  (≥ 139), MCP registry listing present, `authichain-verify` on npm.

## Owner actions left

1. Add repo secret `NPM_TOKEN` once (npmjs.com → Access Tokens → Granular,
   publish). Everything after is automatic.
