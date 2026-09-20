# CashPing Compound — Authichain $0 Buyer Traffic Plan

**Date:** 2026-09-20 (America/New_York)  
**Owner:** Zachary Kietzman / Authichain  
**Spend:** $0 ad budget (X Ads structure may exist paused; **not** part of this plan)  
**Mode:** 100% autonomous — GitHub Actions schedules, IndexNow, AgentZ/OpenClaw publish, capped outbound, Grok Bot routines. No owner posting chores.

**Named system: CashPing Compound (CPC)**

> Ping live money URLs via IndexNow → compound first-party programmatic SEO pages that deep-link those URLs → AgentZ publishes approval-gated social from `content/social/` → reddit-monitor feeds intent into capped `b2b-outreach` / DPP outreach (dry-run default) → Stripe checkouts fire without a human in the loop.

---

## 1. Situation & constraints

### Live money paths (only CTAs allowed)

| Brand | Buyer offer | Live rail |
|---|---|---|
| AuthiChain | EU DPP Readiness / Starter | `GET https://authichain.com/api/checkout/dpp` → 303 Stripe; `https://authichain.com/pricing` Starter **$299**/mo Payment Link |
| QRON | Packs + generation credits | `https://qron.space/pricing` (Starter Pack **$29**, Creator **$99**, credits **$9.99 / $39.99**); `https://qron.space/generate` |
| StrainChain | Basic / Passport / Farm | `https://strainchain.io/pricing` Basic **$199**; Passport **$49** + Farm **$149** via `GET https://authichain.com/api/checkout/plan/strainchain_passport` \| `…/strainchain_farm` |
| Micropay | Agents / machines | x402 on Base (`/api/x402`, `/x402`) |
| GovChain | Public-sector surface | `https://govchain.us` (mint frozen until bytecode; traffic OK, no mint cron in CPC) |

Sources for catalogue figures: live `/pricing` pages + `src/lib/plans.ts` purchasable rows. Do not invent Claude draft prices.

### Hard constraints (autonomous path)

- **$0 ads.** No X Ads activation in CPC. Organic X = AgentZ/OpenClaw only; Grok Bot never posts organically on X.
- **No owner chores as core steps.** No “Zachary posts on LinkedIn,” no manual GSC URL Inspection loops, no weekly content calendar for humans.
- **Outbound capped + dry-run default.** `b2b-outreach` / `email-proposals` schedule force dry-run unless `vars.OWNER_LIVE_SEND=true`. Provenance gate rejects role inboxes / guessed emails (`docs/growth-autopilot-runbook.md`, `scripts/dpp-outreach/README.md`). Daily DPP outreach cap **10**.
- **Existing rails already in monorepo:** `gen-seo-pages.yml`, `ghost-traffic.yml`, `reddit-monitor.yml`, `marketing-autonomous.yml` (`seo_only`), `content-publish.yml` → AgentZ, `pipeline-tick.yml`, IndexNow key `authichain2026indexnow`, competitive-moat fail-closed rules.

### Buyer urgency (external)

- **EU batteries DPP mandatory 18 Feb 2027** (Battery Reg. Art. 77); DPP Registry operational Jul 2026. Source: [EC DPP page](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en), [infodpp timeline](https://infodpp.eu/en/blog/espr-timeline-2026/).
- Enterprise DPP vendors are quote-only or €15+/passport + €2k activation ([Traceable pricing](https://traceable.digital/pricing/)); SMB self-serve $299 audit is a wedge.
- Cannabis authentication demand rising (QR + CoA verification); StrainChain Passport $49 is impulse-priced vs packaging/label vendors. Sources: [AlpVision](https://alpvision.com/cannabis-anti-counterfeit-solution/), Flower Facts market note.
- IndexNow notifies Bing/participating engines, **not** Google; Google discovery = sitemaps + internal links + crawl. Sources: [IndexNow docs](https://www.indexnow.org/documentation), [Bing IndexNow guide](https://mediaofficers.com/insights/bing-sitemap-indexnow-guide).
- Programmatic SEO fails at indexing, not generation — pilot uniqueness + hub links before scale. Source: [SearchOptimo](https://searchoptimo.com/blog/programmatic-seo-pages-not-getting-indexed), [Search Engine Land](https://searchengineland.com/before-scaling-programmatic-seo-prove-pattern-works-486898).
- Small-volume cold email: SPF/DKIM/DMARC, verified lists, ≤30–50/mailbox/day, bounce pause ~2–3%. Sources: [Mailflow 2026](https://mailflowauthority.com/cold-email/cold-email-deliverability-guide), [B2B Data Index](https://b2bdataindex.com/deliverability/cold-email-deliverability-checklist/). Authichain already caps lower (10/day DPP).

---

## 2. ICP ranking (who will PAY soonest)

Ranked by **time-to-Stripe** under $0 autonomous acquisition (self-serve checkout affinity × urgency × outbound/SEO fit).

| Rank | ICP | Why they pay soonest | Primary money URL | Autonomous feeder |
|---|---|---|---|---|
| **1** | **EU/UK battery & LMT exporters** needing a passport before Feb 2027 | Fixed legal deadline; SMB cannot wait on Circulor sales cycles; $299 self-serve beats €2k activation | `https://authichain.com/api/checkout/dpp` (+ Starter $299 on `/pricing`) | `gen-seo-pages` DPP cluster + IndexNow money pings + `dpp-outreach` / `b2b-outreach` segment dry-run→capped live |
| **2** | **US licensed cannabis cultivators / brands** needing CoA-backed authenticity | Counterfeit cart/edible fear; $49 Passport is one-cultivar impulse; Farm $149 for libraries | Passport/Farm checkout plans; Basic $199 | StrainChain SEO pages + AgentZ social bundles + capped B2B cannabis segment |
| **3** | **SMB QR operators** (franchise ops, menus, campaigns) wanting signed Living QR without enterprise RFP | Packs $29/$99 and credits $9.99 convert without sales call; `/generate` is product-led | `https://qron.space/pricing` → Payment Links; `/generate` | QRON programmatic pages + ghost probes on money paths + AgentZ QRON archive → publish |
| **4** | **EU textile / steel early movers** (indicative delegated acts 2027+) | Longer fuse than batteries; nurture via SEO + dry-run proposals | DPP checkout / Starter | Same DPP SEO + reddit-monitor intent tags → proposal queue |
| **5** | **x402 agent builders** | Micropay experiments; low ACV, high signal for protocol | `/api/x402` rails | IndexNow on `/x402` docs + AgentZ technical posts |
| **6** | **Gov / civic** | Surface traffic only until mint unfrozen | `govchain.us` | SEO + monitor only; **no** `gov-mint` in CPC |

**Pay-soonest rule:** CPC always prioritizes ICP-1 and ICP-2 money URLs in IndexNow batches and gen-seo hubs. QRON is volume filler (cheap impulse). Gov stays discoverable, not outbound-heated.

---

## 3. Unique wedge (hard to copy from YOUR live stack)

Competitors can copy “blog about DPP.” They cannot easily copy **CashPing Compound** because it requires this specific stack:

1. **Live self-serve Stripe money URLs already returning 303/Payment Links** across three brands (DPP, QRON packs/credits, StrainChain Passport/Farm) — not demo-gated sales calendars like Circulor/Circularise.
2. **First-party verification data → programmatic pages** (`gen-seo-pages` → `content/seo/pages.json` + verified product/project surfaces) so pages are data-backed, not thin templates ([pSEO pilot rule](https://searchengineland.com/before-scaling-programmatic-seo-prove-pattern-works-486898)).
3. **IndexNow key hosted + AgentZ SEO handler** (`agentz/core/seo.py` → `api.indexnow.org`) pinging **money URLs and sitemaps**, not vanity blogs alone.
4. **Approval-first social publish path** (`content/social/` → `content-publish.yml` → AgentZ/OpenClaw) so Grok Bot never posts organically on X while publish still compounds.
5. **Provenance-gated, fail-closed outbound** (Apollo/reacher verified only, role-inbox reject, daily cap 10, `OWNER_LIVE_SEND` latch) — deliverability as product, not a growth hack.
6. **Cross-brand protocol story** (AuthiChain attestation + QRON Ed25519-signed QR + StrainChain CoA recompute + x402) that a single-category DPP SaaS cannot claim.

**Wedge one-liner for autonomous copy:** *“$299 DPP readiness and $49 genetics passports you can buy today — IndexNow’d, SEO-compounded, AgentZ-published, outreach-capped.”*

---

## 4. Offer → money-path mapping (one CTA per ICP)

| ICP | Single CTA | Exact URL | Forbidden secondary CTAs |
|---|---|---|---|
| Battery / LMT exporters | Start DPP Readiness | `https://authichain.com/api/checkout/dpp` | Do not also pitch Theater $499 in same asset |
| AuthiChain operators (post-audit) | AuthiChain Starter $299 | `https://authichain.com/pricing` | No fake $499/$999 |
| Cannabis cultivator (one SKU) | Publish one passport $49 | `https://authichain.com/api/checkout/plan/strainchain_passport` | Don’t bundle Farm in same ping |
| Cannabis farm (library) | Start Farm Plan $149 | `https://authichain.com/api/checkout/plan/strainchain_farm` | — |
| Cannabis ops (subscription) | StrainChain Basic $199 | `https://strainchain.io/pricing` | — |
| QR SMB impulse | Buy pack / credits | `https://qron.space/pricing` or `/generate` | One pack link per social bundle |
| Agent builders | Try x402 | `https://authichain.com/x402` (docs) → `/api/x402` | No Stripe confusion |

**CPC rule:** Every `gen-seo` page, IndexNow batch row, social bundle, and outreach template carries **exactly one** money URL from the table above.

---

## 5. Channel system (free / autonomous rails only)

### CashPing Compound — four gears

```
[A] MONEY PING          marketing-autonomous seo_only + AgentZ ping_indexnow
        ↓               (money URLs + sitemap.xml, key authichain2026indexnow)
[B] PAGE COMPOUND       gen-seo-pages (Fri) → hub/spoke pages deep-link money URLs
        ↓               ghost-traffic probes health of those URLs daily
[C] SOCIAL PUBLISH      content-routine-pr → content/social/ → content-publish → AgentZ
        ↓               (Grok Bot never posts X; AgentZ/OpenClaw is publisher)
[D] CAPPED CLOSE        reddit-monitor (intent) → pipeline-tick → b2b-outreach /
                        email-proposals / dpp-outreach (dry-run default; cap 10)
        ↓
     STRIPE CHECKOUT    /api/checkout/dpp | /api/checkout/plan/* | Payment Links
```

### Autonomous weekly schedule (UTC cron — unattended)

| UTC cron | Workflow | CPC gear | What it does |
|---|---|---|---|
| `0 0 * * *` | `pipeline-tick.yml` | D | Nightly pipeline advance (queue hygiene) |
| `0 */6 * * *` | `reddit-monitor.yml` | D | Intent scrape only — **no posts** |
| `0 9 * * 5` | `gen-seo-pages.yml` | B | Weekly first-party SEO page generation |
| `0 9 * * 5` | `marketing-autonomous.yml` (seo_only path) | A | Friday IndexNow + sitemap refresh |
| `0 13 * * *` | `ghost-traffic.yml` | B | Daily money-path probes (health ≠ vanity traffic) |
| `0 14 * * 1` | `b2b-outreach.yml` | D | Mon outreach; **dry-run unless OWNER_LIVE_SEND** |
| `0 14 * * 1` | `marketing-autonomous.yml` | A/C prep | Mon SEO/social lane (social publish still via content-publish) |
| `0 15 * * 1-5` | `email-proposals.yml` | D | Weekday proposals; dry-run default |
| `0 15 * * 1,4` | `content-publish.yml` | C | Mon/Thu AgentZ publish of oldest validated bundle |
| `0 16 * * 3` | `marketing-autonomous.yml` | A | Wed IndexNow / sitemap peak |
| every 8h (when enabled) | `dpp-outreach-trigger.yml` | D | DPP DM cycle; Worker send cap **10/day** |

**Grok Bot routines (allowed):** enable/verify workflow vars, dispatch dry-runs, read Action logs, IndexNow smoke curls, ghost probe status, write notes/artifacts — **never** organic X posts, never ask owner to post.

**Explicitly out of CPC core:** X Ads, manual LinkedIn posting by Zachary, manual GSC “Request indexing” chores, paid boosts, ungated blast email.

---

## 6. 30 / 60 / 90 day plan (cron / workflow / routine activations only)

All bullets are **enable / configure / schedule / dispatch** actions. Zero “write a LinkedIn post by hand.”

### Days 0–30 — Activate CashPing gears A+B (traffic compound)

| Week | Autonomous activations |
|---|---|
| **W1** | Confirm/enable `gen-seo-pages`, `ghost-traffic` (`GHOST_TRAFFIC_ENABLED=true`), `reddit-monitor`, `seo-regression`, `pipeline-tick`. Enable `marketing-autonomous` in **seo_only** mode (IndexNow + GSC sitemap pings only). IndexNow batch routine: ping money URL set below after each successful seo job. |
| **W2** | Enable `content-routine-pr` so social bundles keep landing in `content/social/` for AgentZ. Keep `content-publish` **dry-run on schedule** until one green dry-run log; then enable schedule with fail-closed dry-run→live flip only via existing latch (push-to-main / explicit dispatch) — **AgentZ publishes, not humans**. |
| **W3** | Enable `email-proposals` + `b2b-outreach` schedules with **dry_run forced** (`OWNER_LIVE_SEND` unset). Enable `agentz-orchestration` dry-run health. Seed ICP-1 targets via `scripts/dpp-outreach` research cron (quality gate only). |
| **W4** | Scale `gen-seo-pages` output toward **ICP-1 battery DPP hubs + ICP-2 cultivar/passport spokes** (unique first-party data only). Ghost probes assert 303/200 on money URLs. No live outbound yet unless dry-run logs are clean for 7 days. |

**Money URL IndexNow set (ping every seo_only run):**

1. `https://authichain.com/api/checkout/dpp`  
2. `https://authichain.com/pricing`  
3. `https://authichain.com/dpp` (landing)  
4. `https://qron.space/pricing`  
5. `https://qron.space/generate`  
6. `https://strainchain.io/pricing`  
7. `https://authichain.com/api/checkout/plan/strainchain_passport`  
8. `https://authichain.com/api/checkout/plan/strainchain_farm`  
9. `https://authichain.com/sitemap.xml` (+ brand sitemaps when present)  
10. `https://authichain.com/x402`

### Days 31–60 — Engage gear C+D (publish + capped close)

| Week | Autonomous activations |
|---|---|
| **W5** | Flip `content-publish` to live AgentZ publish on Mon/Thu schedule **only if** secrets present and dry-run succeeded (per `content-publish.yml` fail-closed). Bundles must each carry one money URL. |
| **W6** | After ≥1 week clean dry-run outreach logs: set `OWNER_LIVE_SEND=true` for **capped** live send (DPP Worker cap 10/day; b2b `MAX_LIVE_SENDS` tiny). Segments: ICP-1 DPP first, then StrainChain, then QRON. Pause automation if bounce >2% or complaints spike ([deliverability thresholds](https://b2bdataindex.com/deliverability/cold-email-deliverability-checklist/)). |
| **W7** | `revenue-cycle.yml` dry-run→live **checkout-links phase only** for warm/verified provenance leads (not cold guess). Attach exact CTA from §4. |
| **W8** | Expand gen-seo spokes that already show index/click signal in Action/GSC exports (automated pull if available); prune thin URLs via seo-regression fail. Reddit-monitor intent tags auto-enrich outreach queue — still no bot replies on Reddit. |

### Days 61–90 — Compound winners only

| Week | Autonomous activations |
|---|---|
| **W9** | Double IndexNow frequency on **winning** money URLs only (those with Stripe sessions started). Keep gen-seo cadence Fri; stop generating new thin clusters. |
| **W10** | Enable `dpp-outreach-trigger` schedule if still commented — still named-human + provenance only. Partners segment remains dispatch-gated (`ALLOW_PARTNER_SENDS`). |
| **W11** | AgentZ social: prefer bundles that historically preceded checkout events (pipeline attribution). Archive underperformers automatically into `content/social/archive-*`. |
| **W12** | Freeze new channel experiments. CPC steady-state = table in §5. Optional: unpause X Ads **only** if owner later funds — **outside** this plan. |

### Steady-state weekly cadence (one glance)

| Day (UTC) | Unattended jobs |
|---|---|
| **Daily** | `ghost-traffic` 13:00 · `reddit-monitor` */6h · `pipeline-tick` 00:00 · DPP outreach Worker hourly (if live) |
| **Mon** | `marketing-autonomous` 14:00 · `b2b-outreach` 14:00 · `content-publish` 15:00 · `email-proposals` 15:00 |
| **Tue–Fri** | `email-proposals` 15:00 |
| **Wed** | `marketing-autonomous` 16:00 |
| **Thu** | `content-publish` 15:00 |
| **Fri** | `gen-seo-pages` 09:00 · `marketing-autonomous` seo refresh 09:00 |

---

## 7. Metrics that prove buyers (not vanity)

Track in Action logs / Stripe / funnel — **not** follower counts.

| Metric | Proves | Target (90d) |
|---|---|---|
| `GET /api/checkout/dpp` → Stripe session creates | ICP-1 intent | ≥1 live paid DPP readiness |
| StrainChain Passport/Farm checkout sessions | ICP-2 impulse | ≥1 Passport **$49** or Farm start |
| QRON Payment Link charges ($29/$99/credits) | ICP-3 product-led | ≥3 pack/credit purchases |
| IndexNow HTTP 200/202 on money URL batch | Gear A alive | 100% of scheduled seo_only runs |
| `gen-seo` pages indexed (Bing via IndexNow; Google via sitemap crawl) | Gear B | Pilot 20–50 pages before scale ([pSEO rule](https://searchengineland.com/before-scaling-programmatic-seo-prove-pattern-works-486898)) |
| Ghost probe: money URLs return expected 303/200 | Rails healthy | 0 consecutive-day failures |
| AgentZ publish success (content-publish) | Gear C | ≥2 bundles/week with money URL |
| Outreach: sends ≤ cap, bounce <2%, provenance rejects logged | Gear D safe | Cap held; no role-inbox sends |
| `payment_succeeded` + provisioned webhook | Real buyer | ≥1 fully provisioned account |
| x402 settlement count | Protocol signal | Optional stretch |

**Vanity explicitly ignored:** raw sessions without checkout referrer, social impressions, Reddit karma, IndexNow ping count without Stripe correlation.

---

## 8. What NOT to do

1. **Do not** make Zachary post on LinkedIn/X/Reddit as a plan step.  
2. **Do not** run X Ads or any paid boost inside CPC.  
3. **Do not** treat ghost-traffic as acquisition volume — it is a **probe**.  
4. **Do not** mass-generate thin programmatic pages; prove pattern on 20–50 first.  
5. **Do not** expect IndexNow to index on Google; use it for Bing + participants + pair with sitemaps ([IndexNow](https://www.indexnow.org/documentation)).  
6. **Do not** live-send outreach without `OWNER_LIVE_SEND=true` **and** dry-run log review latch.  
7. **Do not** email `info@` / role inboxes or pattern-guessed addresses.  
8. **Do not** invent prices ($499/$999 Claude drafts); only live catalogue / Payment Links.  
9. **Do not** enable `gov-mint` / Workers Paid until a paid DPP or x402 settlement exists.  
10. **Do not** put multiple money CTAs on one SEO page or social bundle.  
11. **Do not** let Grok Bot post organically on X (AgentZ/OpenClaw only).  
12. **Do not** scale outbound when bounce/complaint gates trip — CPC stops gear D, keeps A–C.

---

## Appendix A — Source map

| Claim | Source |
|---|---|
| Battery DPP mandatory 18 Feb 2027; Registry Jul 2026 | [EC DPP](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en), [infodpp.eu timeline](https://infodpp.eu/en/blog/espr-timeline-2026/) |
| Transparent DPP competitor pricing €15/passport + €2k | [traceable.digital/pricing](https://traceable.digital/pricing/) |
| IndexNow protocol / batch submit | [indexnow.org/documentation](https://www.indexnow.org/documentation) |
| IndexNow ≠ Google; sitemaps for Google | [mediaofficers Bing guide](https://mediaofficers.com/insights/bing-sitemap-indexnow-guide) |
| pSEO pilot before scale | [Search Engine Land](https://searchengineland.com/before-scaling-programmatic-seo-prove-pattern-works-486898) |
| Cannabis authentication / QR+CoA demand | [AlpVision](https://alpvision.com/cannabis-anti-counterfeit-solution/), Flower Facts 2026 note |
| Cold email infra + volume caps | [Mailflow Authority 2026](https://mailflowauthority.com/cold-email/cold-email-deliverability-guide) |
| Authichain live checkouts, freeze/enable list, caps | `docs/operations/PUBLIC_LOOP_FREEZE.md`, `docs/growth-autopilot-runbook.md`, `scripts/dpp-outreach/README.md`, live `/pricing` pages |
| IndexNow implementation | `agentz/core/seo.py`, key file `public/authichain2026indexnow.txt` |
| Moat / no fabricated traction | `config/competitive-moat.yaml` |

## Appendix B — Enable one-liners (owner token / Grok Bot with actions:write)

```bash
# Gear A+B (traffic)
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/317153911/enable  # gen-seo-pages
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/276736651/enable  # ghost-traffic
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/300250832/enable  # marketing-autonomous

# Gear C prep
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/332484969/enable  # content-routine-pr
# content-publish (332964370): enable only after dry-run green → AgentZ publish

# Gear D dry-run
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/302131163/enable  # email-proposals
gh api -X PUT repos/undone0603/authichain-unified/actions/workflows/305529641/enable  # b2b-outreach
# Live close later: gh variable set OWNER_LIVE_SEND -b true
```

---

**End state:** CashPing Compound runs unattended: IndexNow keeps money URLs hot, gen-seo compounds first-party demand pages, AgentZ publishes, capped outbound closes into DPP / Passport / QRON Stripe rails — at **$0 ad spend**, with no owner posting required.
