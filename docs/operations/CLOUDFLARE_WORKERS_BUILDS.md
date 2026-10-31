# Deploy through Cloudflare Workers Builds (no Cloudflare token in GitLab)

Goal: deploys run inside Cloudflare, connected to the GitLab repository, so no
Cloudflare API token has to be stored as a GitLab CI/CD variable. GitLab CI keeps
doing checks (`launch_gates`, tests); Cloudflare does the deploy.

This is a runbook for the dashboard steps. They need a person once. Dashboard
labels change, so confirm each setting against the first build log.

## What the repo looks like

- 50+ directories under `workers/`, each with a `wrangler.toml`.
- `workers/authichain-com` has its own `package.json`, `pnpm-lock.yaml` and
  `pnpm-workspace.yaml`, and `workers_dev = false`. It owns live routes (apex
  `authichain.com/api/x402*`, `/api/v1/agent-verify*`, and
  `authichain.govchain.us` listing routes).
- `workers/manufacturer-status` has no route and `workers_dev = false`. Its
  dependencies are locked in the root `pnpm-lock.yaml`.
- The `wrangler.toml` of `authichain-com` says it must not run on PR Workers
  Builds: live checkout, x402 and `/m/*` should update only from `main`.

## Order of connection

1. **`manufacturer-status` first (pilot).** No route and no public address, so a
   bad build cannot affect customers.
2. **`authichain-com`** once the pilot builds cleanly.
3. Everything else only when it is needed. Do not connect all 50 at once; the
   estate already has 66 live Workers with unresolved drift (#1331, #1817).

## Settings per Worker (Workers & Pages > the Worker > Settings > Builds)

| Setting | `manufacturer-status` | `authichain-com` |
| --- | --- | --- |
| Git provider | GitLab, project `authichain-group/authichain-unified` | same |
| Production branch | `main` | `main` |
| Non-production branch builds | **Off** | **Off** (matches the note in its `wrangler.toml`) |
| Root directory | `workers/manufacturer-status` | `workers/authichain-com` |
| Build command | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy` |

If the pilot's install fails because the lockfile lives at the repository root,
set the root directory to `/` and use the deploy command
`npx wrangler deploy --config workers/manufacturer-status/wrangler.toml`.

The Worker name in the dashboard must match `name` in its `wrangler.toml`
(`manufacturer-status`, `authichain-com`), or the build will fail.

## Runtime secrets

Runtime secrets are stored on the Worker in Cloudflare and survive deploys, so
they are set once (Worker > Settings > Variables and Secrets, or
`npx wrangler secret put NAME` from an owner machine). Nothing goes in GitLab.

- `manufacturer-status`: `POLYGON_RPC`.
- `authichain-com`: the values the old `deploy-authichain-com.yml` bound on each
  run (Stripe key, x402 pay-to address, facilitator, USDC asset). Set them once
  by hand. Do not paste values into issues, merge requests or this repository.

## After the first successful build

1. Probe the public hosts. The `public-hosts-reachable` gate does this with no
   credentials.
2. Re-run the `launch_gates` job (CI/CD > Pipelines > Run pipeline).
3. Keep the previous version id handy for rollback.

## Rollback

`npx wrangler rollback <version-id> --name <worker>` from an owner machine, or
the Deployments tab in the dashboard.

## Limits

- Workers Builds free plan: about 3,000 build minutes per month, versus 400
  shared-runner minutes on GitLab Free (see `GITLAB_LAUNCH.md`).
- This does not replace the live Worker inventory check
  (`estate-live-drift`), which needs a read-only token. Run
  `scripts/autonomy/estate-drift.mjs` where such a token is available, or leave
  that gate pending.
- If some Workers are already connected to GitHub through Workers Builds, check
  the dashboard and reconnect them to GitLab. Do not leave two connections
  deploying the same Worker.
