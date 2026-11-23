# DPP activation outbox — #2482 release and recovery

**Status, 2026-11-20: SOURCE MERGED; RUNTIME RELEASE UNVERIFIED.** PR #2648 merged this outbox implementation into protected main. A read-only check of the QRON-v2 project (`nhdnkzhtadfkkluiulhs`) confirmed migration `20261119133000` applied, RLS and RPC-only privileges, with zero outbox records. The configured `SUPABASE_URL` and Hyperdrive origin of the live apex edge-router point to QRON-v2. This does NOT prove the deployed Worker source SHA or both actual runtime database connections. The currently deployed authichain-app and edge-router versions predate the protected merge; runtime attestation pins are not yet present on authichain-app. Do not claim activation readiness or email delivery until protected exact-SHA release, runtime attestation, Resend readiness and independent paid-buyer fulfillment evidence are obtained. This implementation supersedes the stale logging-only #2478 and nonmergeable #2481.

## Why

A grant can commit atomically while a later continuity or email step fails.
Before #2482, a replay of `grant_recorded` or `already_succeeded` returned
`activationEmail: skipped`, so a paid buyer could remain unnotified.

A single `stripe_events` or `founder_exit_actions` receipt does **not**
prove that an activation email was sent or that Resend delivered it.

## Delivery state machine

- A **verified new paid DPP session** writes a PII-free `pending` marker
  through `dpp_activation_prepare` before the entitlement grant. Never create
  this marker retroactively for an already-succeeded legacy action.
- After the atomic `grant:{session_id}` receipt, `dpp_activation_enqueue`
  binds the marker to its **same** profile ID.
- `dpp_activation_claim` atomically leases pending work. An expired unarmed
  lease can be reclaimed, because a provider call could not have started.
- `dpp_activation_begin_send` durably transitions to `sending` **before**
  contacting Resend. Only one provider is used. Cross-provider fallback
  is forbidden because a network failure may occur after acceptance.
- `dpp_activation_finish_send` records `accepted` or
  `needs_reconciliation`, with provider name/HTTP status but **no**
  recipient, body, provider error text or secrets.
- A replay of `sending` after lease expiration enters
  `needs_reconciliation`. A replay of `accepted` never resends.
- Historical `already_succeeded` actions without a marker are
  `legacy_untracked`: hold for human/provider reconciliation, not a new send.

An accepted Resend API response is **not proof of mailbox delivery**.
Status must not be described as `delivered` without independent
provider delivery evidence.

## Manual reconciliation

For a held session, use the verified Stripe session, immutable session ID,
profile grant receipt, `dpp_activation_outbox` status and Resend event
history (read-only). Do not infer non-delivery from a timeout, restart or
missing response. Releasing a hold requires a separately reviewed
idempotent procedure, not a raw SQL UPDATE or replay of a live Stripe event.

The `needs_reconciliation` state deliberately has **no** public or automatic
reset RPC. This initial patch prioritizes at-most-once provider dispatch.

## Release gates

1. Validate the SQL migration in isolated PostgreSQL; inspect RLS and
   `service_role`-only EXECUTE privileges. Keep `anon` and
   `authenticated` revoked.
2. Run source-level crash/replay tests, mock provider acceptance ambiguity,
   concurrent atomic claims and no-send demo/legacy scenarios.
3. Require a true isolated multi-connection PostgreSQL race test in
   addition to the included PGlite engine tests before merge approval.
4. Obtain the complete required exact-head CI statuses and confirm no
   conflicting production writers or older checkout integrations.
5. Apply the reviewed migration via the protected production schema workflow,
   verify the schema fingerprint and permissions, then separately publish
   the exact tested Worker SHA through its protected manual workflow.
6. Confirm source-to-live-version provenance and safe read-only endpoint
   health. A real signed paid-checkout → grant → accepted email → verified
   delivery test requires separate buyer consent; **no live charge, email or
   webhook replay** is authorized by this PR.

Do not weaken `humanHold`, `production_send=false`,
`OWNER_LIVE_SEND=false`, payment checks or protected branch policy.
