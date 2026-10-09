# AuthiChain Unified

**The canonical implementation of AuthiChain's physical-world trust layer.**

AuthiChain turns a physical product or asset into a verifiable digital identity: a standards-aware identifier resolves to a signed claim, policy and provenance data are evaluated, and an independent verifier returns an auditable result.

This repository is the canonical build/deploy surface for:

- **AuthiChain** — verification, attestations, product identity, API and billing
- **QRON** — beautiful, programmable verification experiences and QR studio
- **GovChain** — government/contractor trust workflows and seals
- **StrainChain** — provenance and product verification for regulated physical goods
- **AgentZ / MCP** — agentic orchestration and machine-facing access to the same trust primitives

> **Core thesis:** one verification protocol, many commercial surfaces. The vertical products should not fork the trust model.

## Security

### Deploy invariant

A push to `main`, including a docs-only commit, runs `deploy-cloudflare.yml` and `deploy-edge-worker.yml`. Do not add `paths` or `paths-ignore`.

Secret scan (gitleaks 8.28.0, `--no-git`) runs first and must fail closed. Deploy permissions stay `contents: read`. No token values in Git.

A green Wrangler deploy means that commit's bundle was published. It is not a SOC 2, FedRAMP, FDA, government, or cannabis COA certificate. A verifier pass is the checks this checkout ran.

`authichain-consensus-engine` is an identity collision. Confirm it in Cloudflare before any retirement. This file does not retire it.

Security is part of the protocol presentation, not an afterthought.

- **No credentials in Git.** Runtime secrets belong in environment/deployment secret stores.
- **No live secrets in examples.** Use placeholders such as `sk_live_…`, `whsec_…`, or `postgresql://USER:PASSWORD@HOST/DB`.
- **Rotate exposed credentials immediately.** Removing a secret from the current tree does not invalidate a credential that may already exist in Git history, caches or logs.
- **Verify before release.** Run secret scanning before merging and keep the existing security checks enabled.
- **Least privilege.** Prefer narrowly scoped credentials and service bindings over broad account tokens.

If a credential has ever been committed, treat it as compromised until the provider confirms rotation/revocation.

## License

See `docs/project/LICENSE.md`.
