# Secret Dependency Audit - 2026-10-02

## Scope and preservation rule

This is a read-only, redacted inventory created from `.gitignore`, the checked-in
environment templates, secret-scanning configuration, and source references.
It contains no secret values, copies of ignored files, hashes, or instructions
to remove legacy work. Treat every unclassified ignored path as preserved.

## Ignored secret-bearing paths

| Pattern or path | Intended purpose | Observed local artifact | Classification |
| --- | --- | --- | --- |
| `.env`, `.env.*`, `.env*` | Runtime and developer environment configuration | No `.env` or `.env.local` file found | Required configuration family; no local value inspected |
| `*.pem` | Certificates and private keys | Only `certs/supabase-root-2021.pem` found | Explicitly tracked public CA exception |
| `*.key` | Private keys | No matching file found | Required configuration family; no local value inspected |
| `credentials.json`, `**/credentials.json` | Provider credentials | No matching file found | Required configuration family; no local value inspected |
| `supabase/key.txt` | Supabase credential material | No matching file found | Required configuration family; no local value inspected |
| `scripts/agentz-tunnel/config.yml`, `scripts/agentz-tunnel/*.json` | Local Cloudflare tunnel configuration and credentials | No matching JSON file found | Required configuration family; no local value inspected |

The root ignore file also excludes database files, logs, local Wrangler state,
deployment receipts, and machine-local agent artifacts. Those are retained as
operational/history candidates rather than treated as disposable secrets.

## Reverse dependency map

The checked-in templates document environment-variable names only. High-impact
consumers confirmed in source include:

| Secret family | Confirmed consumer areas | Expected behavior |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge/gateway code, app API routes, server libraries | Server-only database administration |
| `STRIPE_SECRET_KEY` and webhook secrets | Checkout, billing, affiliate, and webhook routes | Server-only payment processing and signature verification |
| `CRON_SECRET` | Cron authorization helper and scheduled API routes | Protected scheduled work; tests document fail-closed behavior |
| `MINTER_PRIVATE_KEY`, `WALLET_PRIVATE_KEY` | Hardhat and blockchain/deployment scripts | Signing/deployment identity; must remain local or managed-secret only |
| `CLOUDFLARE_API_TOKEN`, GitHub tokens | Actions workflows and operational scripts | Deployment and automation control-plane access |

The root templates are an intentionally broad registry. A variable appearing in
them is not evidence that its matching feature is active; the repository's
network and capability maps must be consulted before consolidating or retiring
any related code or configuration.

## Controls observed

- Root `.gitignore` blocks the standard environment, private-key, and provider
  credential paths while retaining explicit safe templates.
- `.gitleaks.toml` defines detectors for Stripe, OpenAI, Resend, Groq, Telegram,
  and Supabase token formats.
- `.gitleaksignore` records historical findings and remediation provenance
  without reproducing values.
- The checked-in CA certificate is explicitly documented as public and is kept
  separate from private-key patterns.

## Findings and non-destructive next steps

1. **Broaden automated detection before treating a clean scan as comprehensive.**
   The custom Gitleaks rules cover several important providers but not every
   credential family documented by the templates, such as Cloudflare,
   GitHub, Anthropic, Hugging Face, blockchain private keys, database URLs,
   and generic bearer tokens.
2. **Keep history exclusions under periodic review.** Historical fingerprints
   in `.gitleaksignore` preserve useful remediation provenance, but each should
   remain tied to an already-rotated credential and a documented incident.
3. **Do not delete ignored material on the basis of this inventory.** Before
   archiving any ignored artifact, identify its deployment/CI/runtime consumer
   and record the owner and replacement secret location.
4. **Use a redacted, local-only follow-up check.** Validate that every required
   secret is present in its deployment platform without printing values, then
   run the scanner against tracked files and Git history in an environment
   where findings are handled as credentials, not copied into reports.

## Limitations

This audit intentionally did not open ignored secret files, inspect secret
values, query external secret managers, or modify runtime configuration. The
absence of matching local artifacts means only that this workspace did not
expose those paths to the audit, not that production secrets do not exist.

## Follow-through status

The repository now includes a value-free regression check at
`scripts/__tests__/secret-hardening-workflows.test.ts`. It verifies that
Gitleaks extends its default rules, the environment templates are scanned, and
the manual binding workflows use GitHub Secrets through guarded environment
variables rather than dispatch-provided credential inputs. The check is run by
the lint workflow.

The following actions require access outside this repository and remain
operator-owned:

- Rotate every credential that may have been supplied to a legacy workflow
  dispatch form, then update its GitHub Secret.
- Run the hardened binding workflows from a protected GitHub Environment after
  rotation.
- Verify the deployed secret-name inventory in GitHub, Cloudflare, Vercel, and
  other providers without retrieving or recording values.
- Run Gitleaks, actionlint, and the focused Vitest command in CI or on a host
  with their command runner available.
