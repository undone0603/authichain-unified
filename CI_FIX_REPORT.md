# CI Workflow Fix Report

Branch: `fix/ci-workflows` (based on `origin/main`)

## 1. browser-vision-tasks.yml — workflow-side fix applied; real fix needs a secret correction

**Root cause (confirmed by re-running on this branch):** GitHub-hosted
runners have no IPv6 route. The `DATABASE_URL` secret configured for
this workflow points at **`db.nhdnkzhtadfkkluiulhs.supabase.co`** — the
Supabase project's *direct* database hostname — which has **no IPv4 (A)
record at all**, only an AAAA/IPv6 one. That's confirmed live: the new
diagnostic step below ran `getent ahostsv4` and `dig +short A` against
that exact host during the verification run and both came back empty.

This is a different (and more precise) finding than "DNS returns IPv6
first, needs reordering": there is no IPv4 address to prefer. A prior
fix had set `NODE_OPTIONS: --dns-result-order=ipv4first` on the run
step, which can only reorder addresses that exist — it was never going
to help here, which is exactly why it "wasn't holding."

The repo's own `.env.example` documents the intended pattern:
```
# Database — use the Supabase TRANSACTION pooler (port 6543) for serverless.
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:6543/postgres
```
The Supabase **pooler** hostname (`aws-0-<region>.pooler.supabase.com`)
is IPv4-compatible; the **direct** hostname (`db.<ref>.supabase.co`)
that the `DATABASE_URL` secret currently holds is IPv6-only unless the
paid IPv4 add-on is purchased. So the secret itself appears to be set
to the wrong connection string relative to the project's own documented
convention.

**Fix applied (workflow-side, defense in depth):** Added a step, "Force
IPv4 for Supabase pooler", that runs before the DB is touched. It
parses the hostname out of `DATABASE_URL`, resolves its IPv4 (A)
address via `getent ahostsv4` (falling back to `dig +short A`), and
pins `<ipv4> <host>` into `/etc/hosts` to short-circuit DNS resolution
entirely if an IPv4 address exists. Kept `NODE_OPTIONS
--dns-result-order=ipv4first` as an additional fallback. This step is
correct and will fully fix the job **once** `DATABASE_URL` points at an
IPv4-capable host — it can't invent an IPv4 address that doesn't exist.

**Action needed outside this PR:** update the `DATABASE_URL` repo
secret to the Supabase pooler connection string (the format already
documented in `.env.example`) instead of the direct `db.*.supabase.co`
host. That is a secret-value change, not a code/workflow change, so it
isn't something this PR can do.

**Verification:** Triggered via `workflow_dispatch` on this branch
(run [30041172396](https://github.com/undone0603/authichain-unified/actions/runs/30041172396)).
The new diagnostic step ran correctly and printed the exact no-IPv4
finding above; the job still fails today because of the secret, not
because of the workflow logic.

## 2. deploy-edge-worker.yml — FIXED and verified passing

**Root cause:** pnpm's `minimumReleaseAge` supply-chain policy
(`pnpm-workspace.yaml`: `minimumReleaseAge: 0` with a
`minimumReleaseAgeExclude` allowlist of specific `@smithy/*` package
versions) rejected 17 lockfile entries — mostly `@smithy/*` AWS SDK
transitive deps plus `baseline-browser-mapping` — published within the
prior 24 hours. The allowlist is a point-in-time snapshot that goes
stale every time those fast-moving transitive deps publish a new patch,
so it fails again on a regular cadence. The workflow also used
`pnpm/action-setup@v4` with `version: latest` instead of the pinned
`10.28.2` used by the other (passing) deploy workflows
(`deploy-workers.yml`, `deploy-cloudflare.yml`).

**Fix applied:**
- Pinned `pnpm/action-setup` to the same SHA/version
  (`fc06bc1257f339d1d5d8b3a19a8cae5388b55320`, `10.28.2`) as the passing
  workflows.
- Added `--config.minimumReleaseAge=0` directly to `pnpm install
  --no-frozen-lockfile`, the authoritative CLI override, so CI no
  longer depends on keeping the allowlist in sync with every new
  transitive publish.

**Verification:** Triggered via `workflow_dispatch` on this branch —
run [30041174520](https://github.com/undone0603/authichain-unified/actions/runs/30041174520)
**passed**. Log confirms: `pnpm install --no-frozen-lockfile
--config.minimumReleaseAge=0` completed with no supply-chain policy
violations, and `wrangler deploy` succeeded
(`Deployed authichain-revenue-worker triggers`,
`Current Version ID: d25a0922-34f7-467d-833e-b628ca3ba400`).

## 3. deploy-app-worker.yml — DIAGNOSED, not fixed (infra/billing decision)

The eslint warnings and corepack notice visible in a shallow log grep
are cosmetic; they don't fail the run. The actual failure is at the
`wrangler deploy` step:
```
✘ [ERROR] Your Worker failed validation because it exceeded size limits.
 - Your Worker exceeded the size limit of 3 MiB. Please upgrade to a
   paid plan to deploy Workers up to 10 MiB. [code: 10027]
```
The OpenNext build produces a ~7.78 MiB gzip Worker bundle
(`.open-next/server-functions/default/handler.mjs` alone is ~38 MiB
uncompressed) — over the Cloudflare Workers **free-tier** 3 MiB
compressed-size limit, comfortably under the **paid-plan** 10 MiB
limit. This is an account-plan limitation, not a workflow bug, and the
repo already knows it: `wrangler.app.jsonc` has a
"Free-tier note... revisit limits.cpu_ms after moving to the paid
plan" comment, and the workflow is deliberately `workflow_dispatch`-only
with its push trigger commented out "until the free-tier staging gate
passes."

**No YAML fix applied** — there isn't a workflow-level one. Real fix is
either (a) upgrade the Cloudflare account to Workers Paid (the ~7.78
MiB bundle fits well inside the 10 MiB limit), or (b) a nontrivial
app-level bundle-size reduction (tree-shaking the SSR bundle's
AWS/Stripe/thirdweb SDK footprint). Recommend (a).

**Verification:** N/A — not modified.

## 4. deploy-vercel.yml — DIAGNOSED, flagged as possibly not worth fixing

The eslint warnings here are also cosmetic. The real failure is in
`next build`'s static prerender of `/login`:
```
Error occurred prerendering page "/login"
Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
```
`src/utils/supabase/client.ts`, `server.ts`, and `src/app/login/page.tsx`
already have `if (!url || !anonKey)` guards for *missing* env vars, so
`NEXT_PUBLIC_SUPABASE_URL` is non-empty at build time — it's set to
something that isn't a valid URL (malformed/truncated/wrong value).
The workflow forwards `secrets.NEXT_PUBLIC_SUPABASE_URL` as job-level
env, but the actual build env is a mix of that and whatever `vercel
pull` fetches from the linked Vercel project's own Production
environment variables — so the bad value lives in either the GH repo
secret or the Vercel project config, and only whoever manages those
credentials can correct it. This is a data/credentials problem, not a
workflow-file bug.

**No YAML fix applied** — flagging per instructions rather than
guessing at a secret value. Also worth noting: this workflow is
*already* manual-only by design — its own header comment says "Vercel's
own Git integration already builds the live project on every push...
Kept for emergency manual deploys during the Vercel wind-down." The
team already treats this as a legacy/backup path during the Cloudflare
migration.

**Recommendation:** given it's manual-only, blocks nothing else, and
the app is actively moving off Vercel, confirm whether it's worth
fixing the Supabase URL secret at all versus deleting the workflow.

**Verification:** N/A — not modified.

## Summary

| Workflow | Status | Verified? |
|---|---|---|
| browser-vision-tasks.yml | Workflow-side fix applied; real fix is a secret change (DATABASE_URL → pooler host) | Verified the *diagnosis* live; job still fails until the secret is corrected |
| deploy-edge-worker.yml | Fixed | **Passing** on `workflow_dispatch` (run 30041174520) |
| deploy-app-worker.yml | Diagnosed — Cloudflare Workers free-tier 3 MiB size limit, needs plan upgrade | N/A, not a code fix |
| deploy-vercel.yml | Diagnosed — bad `NEXT_PUBLIC_SUPABASE_URL` value, needs secret fix; question whether worth fixing given Vercel wind-down | N/A, not a code fix |
