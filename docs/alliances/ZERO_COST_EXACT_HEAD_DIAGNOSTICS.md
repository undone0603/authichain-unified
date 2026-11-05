# Zero-cost exact-head CI diagnostic runbook

Target commit: cd3a23341746f134b9e5d02f44d05d7102570d3f (reconfirm exact head before running).

## Observed 2026-11-05 UTC
GitHub workflows Worker builds, CI Main, CI, Lint and Typecheck ratchet all completed with failure. Worker job 126083235561 returned 404 BlobNotFound for logs. **Root cause unknown.** Do not infer source compilation errors or runner isolation from workflow conclusions.

## Safe diagnostics (trusted code only)
1. Inspect GitHub workflow run page and check annotations, billing and Actions eligibility. Save screenshot or redacted API response.
2. On an already authorized trusted workstation or isolated VM, check `node --version`, `corepack --version`, `git status --short`, `git rev-parse HEAD`, `git remote -v` (redact sensitive URLs), disk and memory.
3. Fetch exact target commit; compare `git rev-parse HEAD` with approved SHA. Do not execute untrusted PR code on a machine containing production credentials.
4. If dependencies are already cached, run the repo's documented package-manager install in offline mode; if not, stop and record missing dependencies rather than paying for new capacity.
5. Execute the narrow MCP test suite, then repo lint/typecheck and Worker dry-run with the exact commands from workflow YAML. Record command, exit code, UTC time, redacted stdout/stderr, runtime and SHA.
6. Independently inspect results and runner credential/network boundaries before accepting exact-head CI evidence.

## Separate public-wire read-only probe
`MCP_URL=https://authichain.com/mcp SOURCE_SHA=<approved-sha> node scripts/interop/mcp-dual-protocol-readonly.mjs > mcp-evidence.json`

Only on an authorized network-capable environment. This sends read-only MCP discovery and listing requests; does not call tools or pay. Results reflect the **live deployed endpoint**, not the branch. A transport error is **incomplete**, not a protocol failure. Preserve a SHA-256 digest of the evidence file and redact tokens/identifiers before sharing.

## Release and commercial holds
No production deployment, merge, payments, outreach, or signed certification on this diagnostic alone. `humanHold=true` and `production_send=false` remain unchanged.
