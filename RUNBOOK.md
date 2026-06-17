# AuthiChain Economy — Launch Runbook

Operational guide for taking the platform from a green build to live, revenue-generating
production. The code is already build-green, type-checked, and tested on `main`; everything
below is **operator action** that requires *your* secrets and Cloudflare/GitHub auth.

> **Golden rule:** money never moves until you've (a) verified the app is alive, (b) approved
> real outreach + at least one conversion end-to-end, and (c) deliberately flipped
> `PAYOUTS_ENABLED` last. Each stage below is a checkpoint — do not skip ahead.

---

## Stage 0 — Protect `main` (do this first, ~5 min)

The entire build-repair effort happened because broken commits reached `main` with no gate.
CI now builds + type-checks on every PR (`.github/workflows/ci.yml`). Lock it in so it can't
regress.

**Via API** (run in Codespace; `gh` is pre-authenticated there):

```bash
gh api -X PUT repos/undone0603/authichain-unified/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Test suite (22.x, 3.12)' \
  -f 'enforce_admins=true' \
  -f 'required_pull_request_reviews[required_approving_review_count]=0' \
  -f 'restrictions=' \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Test suite (22.x, 3.12)"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

> The `Test suite` job runs `pnpm check` (types) → `pnpm test` → **`pnpm build`** (the Next.js
> + Cloudflare Workers build gate added in #318). Requiring it means a PR cannot merge unless
> the production build succeeds. Add more contexts (e.g. `CodeQL`, `Secret scan (gitleaks)`)
> to `contexts` if you want those required too.

**Verify:**

```bash
gh api repos/undone0603/authichain-unified/branches/main/protection \
  --jq '.required_status_checks.contexts, .enforce_admins.enabled'
```

✅ Checkpoint: direct pushes to `main` are now rejected; PRs must pass CI to merge.

---

## Stage 1 — Set Required secrets, verify the app is alive (no autonomy, no money)

Run the committed activation script from the repo root in your Codespace:

```bash
bash launch.sh
```

On this first pass:

1. Enter `CLOUDFLARE_API_TOKEN` (and account id) when prompted.
2. Fill **only the Required tier**:
   - `DATABASE_URL` — Supabase session pooler (port 6543)
   - `JWT_SECRET` — ecosystem token signing key
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` (`whsec_…`)
   - `OPENAI_API_KEY`
3. **Press Enter to skip** every Recommended / Email / Optional secret (skipping leaves any
   existing value untouched — the script is safe to re-run).
4. Answer **`N`** to the *autonomous pipeline* prompt.
5. Answer **anything other than `ENABLE PAYOUTS`** to the payouts prompt (leaves it off).

**Then confirm a deploy picked up the secrets and the app serves real traffic:**

```bash
# from the worker dir, confirm secrets are present (names only, never values)
npx --yes wrangler secret list
# trigger / confirm a deploy, then smoke-test a live route
curl -fsS https://authichain.com/api/health   # or your health/status route
```

✅ Checkpoint: auth + billing work against live Supabase/Stripe. Zero autonomy, zero payouts.

---

## Stage 2 — Add Recommended secrets (CRM, chain, ownership, outreach)

Re-run `bash launch.sh` and fill the **Recommended** + **Email** tiers for the features you
want live:

- **Autonomy/CRM:** `HUBSPOT_SERVICE_KEY`, `CRON_SECRET`, `INTERNAL_API_SECRET`
- **Ownership/founder dashboard:** `OWNER_EMAILS`, `OWNER_OPEN_ID`
- **Chain/wallet:** `VITE_THIRDWEB_CLIENT_ID`, `WALLET_PRIVATE_KEY`
- **Email provider (pick one):** `RESEND_API_KEY` *or* `SENDGRID_API_KEY` *or* the
  `GMAIL_*` set

Keep both approval gates ON (they default safe):

- `REQUIRE_OUTREACH_APPROVAL=true` — outreach is drafted, never auto-sent
- `REQUIRE_DEV_APPROVAL=true` — autonomous code/asset actions held for review

✅ Checkpoint: integrations connected; outreach still draft-only.

---

## Stage 3 — Enable the autonomous pipeline (drafts only)

Re-run `bash launch.sh` and answer **`y`** to the autonomous-pipeline prompt (this triggers
`set-pipeline-enabled.yml`, setting `AUTONOMOUS_PIPELINE_ENABLED=true`), **or**:

```bash
gh workflow run set-pipeline-enabled.yml
```

What starts: the pipeline tick — **lead-find → research → outreach drafts (held for your
approval) → conversions → `revenueRecords` → founder snapshot.** With
`REQUIRE_OUTREACH_APPROVAL=true`, nothing is sent until you approve it in-app.

**Watch revenue:** the founder income figure is the `founder.snapshot` tRPC query
(`server/founder/snapshot.ts` — today / 7d / 30d from `revenueRecords`).

✅ Checkpoint: first approved outreach → first conversion → first `revenueRecords` entry.

---

## Stage 4 — Enable payouts (MOVES REAL MONEY — last, deliberate)

Only after you've personally approved at least one outreach batch **and** seen one conversion
land in `revenueRecords`.

Re-run `bash launch.sh` and type **exactly** `ENABLE PAYOUTS` at the payouts prompt, or:

```bash
printf 'true' | npx --yes wrangler secret put PAYOUTS_ENABLED
```

Defense in depth that stays in force even with payouts enabled:

- Each payout batch still requires **human approval in-app**
  (`server/payouts/service.ts` → `executeApprovedPayouts()` refuses otherwise).
- Hard caps: `PAYOUT_MAX_PER_ITEM` (default `$500`), `PAYOUT_MAX_PER_RUN` (default `$5000`).
  Raise via secrets only when you're confident.

✅ Checkpoint: approved batches disburse, within caps, with an audit trail.

---

## Roll-back / kill switches

| To stop… | Do this |
|---|---|
| All disbursements | `printf 'false' \| npx wrangler secret put PAYOUTS_ENABLED` |
| The autonomous pipeline | re-run `set-pipeline-enabled.yml` with the disable path, or set `AUTONOMOUS_PIPELINE_ENABLED=false` |
| A single bad batch | reject it in-app (it never executes without approval) |

## Where things live

- Activation script: [`launch.sh`](./launch.sh)
- Env contract: [`server/_core/env.ts`](./server/_core/env.ts)
- CI gate (types + tests + build): [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- Pipeline toggle workflow: `.github/workflows/set-pipeline-enabled.yml`
- Payout guard: `server/payouts/service.ts`
- Founder income query: `server/founder/snapshot.ts`
