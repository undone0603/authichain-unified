# First verified purchase evidence Site — isolated free hosting

Status: **deployment held**. This branch does not publish or alter production.

## Approved destination

Cloudflare account `4c1869b90f13f86940aa3747839bf420`, separate **new** static-only Worker/Pages project named `authichain-first-purchase-evidence`. Do not overwrite existing `authichain-dashboard`, `authichain-unified`, `authichain-com`, `authichain-edge-router`, or any existing route/domain. Use a provider-assigned `*.workers.dev` or `*.pages.dev` hostname, no custom DNS and no bindings, secrets, remote D1 migrations, payment endpoints, or cron triggers.

## Source and review

Source artifact prepared in the ChatGPT session: `authichain-first-purchase-site.zip` with `index.html` (standalone HTML, CSS, JS). **Artifact has not been committed here**, so this is a deployment plan, not a releasable source tree. Attach and review exact source in a subsequent source-only commit. Confirm HTML is read-only, inspect any fetch origins and CORS, check for script injection and exposed personal data, and test fail-closed unknown/stale status. Pin the reviewed artifact hash and obtain eligible independent review and exact-head applicable checks before any hosted publication.

## Feed scope

Public unauthenticated GitHub evidence only: main revision, PR #2411 checkout watchdog, PR #2414 DPP proof, PR #2270 DPP guards, protected deploy run 42608783162. Show UTC checked-at and upstream timestamps separately, with stale/unknown and source links. Private Stripe, Supabase, HubSpot, Gmail and Vercel records are NOT browser-accessible feeds; no credentials in static assets. Future private evidence must use a separately reviewed, read-only authenticated server-side aggregator returning sanitized summaries with provenance and no personal buyer details.

## Release gate

Do not merge, dispatch protected production deployment, publish the Site, charge, send outreach, or relax `humanHold`, `production_send=false`, `OWNER_LIVE_SEND=false`, webhook signature checks or economic PR protections without appropriate exact-head evidence and independent approval. Keep $0 new spend. After approved static-only release, verify the provider-issued URL and check a live refresh, timestamp display, and blocked private feeds. Log immutable deployed source/hash and UTC verification.
