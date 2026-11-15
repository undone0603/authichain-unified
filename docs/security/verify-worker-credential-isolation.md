# AuthiChain verify Worker: isolated credential handoff

Status: **NOT PROVISIONED OR RELEASE-AUTHORIZED**. This document does not assert that a new credential or GitHub environment exists. No live deployment is triggered.

## Existing token — evidence boundary

The existing `production-cloudflare` GitHub user token was verified active and able to **read** `authichain-verify-worker` by GitHub Actions run [#43626092970](https://github.com/undone0603/authichain-unified/actions/runs/43626092970). It did **not** prove write scope or least-privilege policy. The separately connected Cloudflare OAuth API returned HTTP 403 for `GET /user/tokens`; it cannot independently read this user token's permission policy. Never use account-token inventory as a substitute or copy/expose/expand the current user token.

## Provision a separate identity (requires authorized Cloudflare token provisioning)

1. In the Cloudflare account's **Manage account → Account API tokens**, create an **account-owned** token limited to **Specified Workers → authichain-verify-worker → Editor**. The Worker already exists. No account/product-wide Workers Editor/Admin; no DNS, zone, KV, D1, R2, billing, token administration, other Workers, or unrelated permissions. Wrangler `deploy` of an existing Worker requires only this role when no new route/custom domain is introduced.
2. In GitHub, create the **new** environment `production-cloudflare-verify-worker`. Restrict deployments to **protected branches only** and forbid administrator bypass. Verify the saved policy through authorized GitHub administrative read access before attaching any secret; do not rely on GitHub's environment auto-creation.
3. Set only these **new environment-scoped** secret names, without printing bearer values: `AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_API_TOKEN` and `AUTHICHAIN_VERIFY_WORKER_CLOUDFLARE_ACCOUNT_ID`. The account ID must match `workers/authichain-verify-worker/wrangler.toml`. Never reuse or broaden `AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN`.
4. Independently read **that exact new account-owned token's metadata** from Cloudflare's account-token detail API or dashboard, compare a SHA-256 of its **token ID**, verify active state, only `Specified Workers` with the selected Worker and `Editor`, and zero additional permissions. Preserve any expiration or IP conditions. Do **not** paste token values, raw token IDs, cookies, or permission JSON into issues.
5. Submit a **separate protected PR** introducing `.github/credential-policies/authichain-verify-worker.json` only after the policy is independently audited. It must contain:

```json
{
  "schema_version": 1,
  "token_id_sha256": "<SHA-256 of independently inspected account-token ID>",
  "account_id": "<expected Cloudflare account ID>",
  "worker": "authichain-verify-worker",
  "token_kind": "account-owned",
  "scope": "Specified Workers",
  "role": "Editor",
  "additional_permissions": [],
  "policy_source": "independent-cloudflare-account-token-detail",
  "observed_at": "<UTC ISO-8601 timestamp>"
}
```

The evidence file is an **operator attestation**, not cryptographic proof of Cloudflare policy. Review the underlying authoritative metadata separately. The protected release refuses to deploy without this file, if the token ID differs, or if the observation is more than 30 days old. Anyone with authority to change the attestation must follow the same independent evidence review.

## Protected release (separate authorization)

The existing manual `deploy-authichain-verify-worker-protected.yml` now references only the dedicated environment and dedicated secret names. Confirm all seven exact-main CircleCI contexts, GitHub rulesets, environment policy, runner isolation, Worker configuration, token identity, and verified least-privilege scope before authorizing its manual dispatch. The script performs no deployment automatically on merge. Do not modify or dispatch the `authichain-com` release, legacy Worker matrix or the DPP payment path as part of this handoff.

References:
- https://developers.cloudflare.com/workers/authorization/workers/
- https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/
