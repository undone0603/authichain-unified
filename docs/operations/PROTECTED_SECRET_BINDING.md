# Protected production secret bindings

Tracking issue: https://github.com/undone0603/authichain-unified/issues/2629

These four workflows share one non-canceling concurrency group, so simultaneous
manual secret rotations queue instead of racing across Workers.

These four workflows are explicit manual-only operations. A main push must
never change a signing secret, lead credential, guardrail key, x402 pay-to
destination, facilitator, or USDC asset binding.

The shared read-only gate scripts/ci/guard-production-secret-binding.mjs checks
workflow_dispatch on the exact current protected main SHA, active no-bypass
main PR rules, eight successful CircleCI contexts on that SHA, and the matching
protected-branches-only GitHub environment with admin bypass disabled.
The workflow's GITHUB_TOKEN is read-only and has Actions: read to inspect
environment policy, while repository metadata access covers ruleset reads.
GitHub may omit ruleset bypass_actors from read-only API responses: absence
of that field does NOT prove a no-bypass configuration. Independently verify
all bypass permissions using authorized repository administration before
activating any manual secret-binding path. A visible bypass is rejected.

Missing or unreadable evidence fails closed. Jobs check out the exact SHA,
restore a full tree, and validate the gate immediately before secret writes.

Workflow | Protected environment | Dedicated Cloudflare credential prefix | Target
--- | --- | --- | ---
bind-stripe-webhook-secrets.yml | production-cloudflare-edge-router | AUTHICHAIN_EDGE_ROUTER_CLOUDFLARE | authichain-edge-router
bind-lead-secrets.yml | production-cloudflare-edge-router | AUTHICHAIN_EDGE_ROUTER_CLOUDFLARE | authichain-edge-router
bind-x402-secrets.yml | production-cloudflare-x402-secrets | AUTHICHAIN_X402_SECRET_BIND_CLOUDFLARE | one explicitly selected Worker
set-qron-outreach-guardrail-secret.yml | production-cloudflare-qron-outreach | AUTHICHAIN_QRON_OUTREACH_CLOUDFLARE | qron-outreach

Each credential prefix requires distinct _API_TOKEN and _ACCOUNT_ID secrets.
The live GitHub environment policies and actual Cloudflare token permissions
must be checked by an authorized administrator before any dispatch. Merely
using dedicated names does not establish scope or guarantee those secrets
were defined at the environment rather than repository level. Never expose
token values, install broad fallback credentials, or test by changing prod.

The x402 binder now targets one Worker per manually authorized dispatch. It
refuses a pay-to or facilitator different from the reviewed Base-mainnet pair.
A destination change requires a new reviewed protected PR and exact-head CI.
The general deploy-workers workflow retains existing bindings with
--keep-vars and no longer automatically calls secret put for x402 values.
First-time Workers lacking these settings remain unconfigured until
provisioned through a separate protected manual operation.

The qron-outreach guardrail workflow only binds its own Worker, with printf
to prevent a newline-changing secret rotation. An edge-router guardrail
rotation must use the protected lead-binding workflow independently.
Stripe webhook HMAC secret rotations still require byte-exact values and
independent post-change signature verification.

Emergency recovery can use a narrowly scoped single-Worker Cloudflare
operator session with recorded target, credential identity and verification.
The repository scripts/rotate-secrets.sh remains a manual recovery option,
NOT a scheduled CI path. Do not use scripts/push-secrets-to-cloudflare.sh as
a broad automated recovery shortcut. These operations are production writes
and require separately verified authorization and a documented rollback.

Landing these changes does not issue credentials, create protected
environments, deploy a Worker, alter any live binding, transfer funds,
charge a customer, or prove paid fulfillment.

## Additional protected manual releases (follow-up to #2629)

The revenue-worker and manufacturer-status deployment workflows must never
publish or refresh secrets on a push to main. Both are operator-initiated
workflow_dispatch jobs only, with an exact current protected-main SHA,
eight CircleCI contexts, read-only GitHub environment policy inspection,
and a non-cancelling concurrency group. The revenue-worker uses a dedicated
production-cloudflare-revenue-worker environment and
AUTHICHAIN_REVENUE_WORKER_CLOUDFLARE_API_TOKEN / _ACCOUNT_ID credentials.
Manufacturer-status uses production-cloudflare-manufacturer-status and
AUTHICHAIN_MANUFACTURER_STATUS_CLOUDFLARE_API_TOKEN / _ACCOUNT_ID.

The protected environments, token scopes, and code-to-target identity must be
verified by authorized administration before first dispatch. The manual
revenue-worker workflow may rewrite Supabase, Stripe and sales credentials;
that is never a validation technique. Existing production is unchanged by
this source-only change. Additional manual Gmail/social/outreach credential
input leaks require separately scoped remediation and must not be considered
fixed by this follow-up.

The general deploy-workers.yml workflow now requires an explicit
workflow_dispatch for both Worker code publishing and secret binding. No push
to main (including changes to the deploy workflow itself) can automatically
publish Worker versions from this workflow. Its five secret-binding steps (AgentZ, dashboard,
OpenClaw, authichain-com, GS1 resolver) must run **only** during an explicit
workflow_dispatch. A push may not rewrite credentials, even for an auto-
deploy-allowlisted Worker. This preserves --keep-vars, while retaining
separate protected release and credential-scope work for the broader Worker
publishing surface. No automatic deploy path here may be treated as proof
that all production writes are protected.
