# Cedr v0.8.1 ↔ AuthiChain: independent public MCP peer validation

**Status: test fixture, not a completed live interoperability certification.** This package is read-only and requires no private GitLab checkout, API key, wallet, payment, or production access. It exercises the official Cedr 0.8.1 binary against the public `https://authichain.com/mcp` server by `initialize` and `tools/list` only.

## Reproduce on an isolated network-enabled host

Use a disposable Ubuntu x86_64 or ARM64 host with Node.js 22, `bash`, `curl`, `sha256sum`, `tar`, `timeout`, and GitHub CLI (`gh`). No production secrets or wallet environment.

```bash
cd docs/alliances/cedr-v081-public-peer-kit
node --test verify-report.test.mjs
export CEDR_PEER_EVIDENCE_DIR="$PWD/cedr-public-peer-evidence"
bash run-peer.sh
```

The runner fetches official Cedr v0.8.1 Linux release binaries, uses pinned SHA256 digests for the binary and `SHA256SUMS`, verifies upstream GitHub release attestation, and creates a fresh temporary `HOME` containing only one `.mcp.json` public endpoint. `guard lock --remote` must successfully introspect an actual nonempty tool surface; `guard remote --force --format json` must report exactly `claude.authichain` as `unchanged`, no errors or changes. Other states such as `failed`, `auth_required`, `unsupported`, `not_pinned`, empty tool surfaces and missing baselines are **not passing** evidence even if Cedr exits 0.

## Evidence and claim limits

Keep `cedr-public-peer-evidence/` private until you review and sanitize raw outputs. Submit the filled `PEER_REVIEW_REPORT.md`, UTC timestamp, release checksum and attestation, Cedr version, `remote-report.json`, `verdict.json`, exit code, nonempty introspected surface, and `evidence-digests.txt`. A successful immediate lock-and-recheck is only **self-baselined public MCP tool-surface evidence**; it does not establish sustained remote drift monitoring, record signature authenticity, ownership, provenance, formal A2A compliance, or any external endorsement.

The 15 offline tests can execute without a network but do **not** count as live handshake evidence. Source staging review: private AuthiChain GitLab MR !2030. No release, production payment, deployment, or merge is authorized by running this kit. A runner must be independently authorized and isolated. Prior hosted CI attempts were blocked before execution by account billing/quota restrictions.

**Review workflow:** This branch is staged as a draft because the project’s GitHub-hosted Actions are billing-locked and same-repository PR checks otherwise target a persistent self-hosted runner. The last commit intentionally includes a CI-skip marker; do not merge or treat skipped checks as validation. An independently approved, disposable executor must run the live peer test first.
