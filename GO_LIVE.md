# AuthiChain — Go-Live Runbook

You built the system. This is the order to switch it on. Each step says who
acts: **you** (a setting or a decision only you can make) or **it** (the system
runs autonomously once switched on).

Run the readiness check at any time:

```bash
pnpm preflight
```

It prints GO / NO-GO per subsystem from your *actual* config — fix the ❌, then
the rest follows.

---

## Phase 0 — Preflight (5 min)  ·  you
Run `pnpm preflight`. Resolve every ❌ blocker. 🟡 items are optional features
you can turn on later. You want **🟢 GO** before going further.

## Phase 1 — Make it sellable (the real revenue engine)  ·  you
This is the path to money that needs **no** mass outreach: the product is live,
people can pay, and they get provisioned automatically.

1. **Apply the database schema.** Push migrations to Supabase, including the new
   payouts table: `drizzle/0001_payouts.sql` (via `supabase db push` or your
   migration flow).
2. **Set production env** (see `.env.example`): `DATABASE_URL`, `JWT_SECRET`
   (≥32 chars), `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET`, and
   an email sender (`SENDGRID_API_KEY` / Gmail / SMTP).
3. **Point the Stripe webhook** at `POST /webhooks/stripe` and confirm the
   signing secret matches.
4. **Test one real purchase end-to-end** (a real card, smallest plan). Confirm:
   payment → webhook → account provisioned → access email received. This single
   test proves the whole collection path. *(Now hardened: the webhook
   idempotency + service-order capture fixes shipped on PR #242.)*

> ✅ After Phase 1 you can take money today by simply sending people to your
> checkout link. Everything below scales that.

## Phase 2 — Turn on the autonomous pipeline (safe, gated)  ·  it
With `AUTONOMOUS_PIPELINE_ENABLED` on (default), the scheduler already runs:
lead ingest → Bayesian scoring → **draft** outreach (queued for review),
plus the daily payout-preparation job (queues, never sends).

Keep `REQUIRE_OUTREACH_APPROVAL=ON`. The system works the leads and writes
drafts; nothing leaves your domain unattended.

## Phase 3 — First revenue lever  ·  you approve, it sends
Pick the fastest honest channel:
- **Drive traffic** to checkout (you already have the storefront + pricing).
- **Approve outreach**: open `/email-campaigns` → Pending Review → approve the
  AgentZ drafts you want → they send. You stay the gate; sending scales from
  there.

## Phase 4 — Payouts (only once money is flowing)  ·  you approve, it sends
Admin Dashboard → **Payouts** tab:
1. Read the **dry-run** (what would pay; zero side effects).
2. **Prepare / Queue** eligible payouts.
3. **Approve** the batch you choose.
4. Set `PAYOUTS_ENABLED=true`, then **Execute**. Per-item/per-run caps and
   idempotency are enforced server-side. (Leave it off until you've read a
   dry-run.)

## Phase 5 — Non-dilutive funding (parallel track)  ·  you submit
Real, live, rolling opportunities AuthiChain fits — you have draft material for
the top two:
- **DHS SVIP – Forgery/Counterfeiting of Certificates** (up to $800K) →
  `DHS_SVIP_Grant_Application.md`
- **NSF SBIR – Cybersecurity & Authentication** (up to $1.5M; start with the
  fast Project Pitch) → `NSF_SBIR_Project_Pitch.md`

I can turn those drafts into submission-ready packages on request. You sign and
submit (federal applications carry certifications only you can make).

---

### The honest boundary
Two things stay on your trigger, by design: **sending real outreach** and
**moving real funds**. The system queues both and gets you one click away — that
is the launch, not a limitation. Everything else runs itself.
