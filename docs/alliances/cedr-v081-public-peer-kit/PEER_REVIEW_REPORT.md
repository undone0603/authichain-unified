# Cedr v0.8.1 ↔ AuthiChain MCP independent test report

This is a **blank evidence form, not a passing certification**. Do not mark complete until an authorized, independently isolated networked Linux runner executes the official Cedr v0.8.1 release binary.

## Runner and release integrity

- Independent reviewer/organization (optional):
- Date/time in UTC:
- Isolated execution host or disposable VM:
- Linux architecture (x86_64 or aarch64):
- No production credentials, wallets, or private code accessible?:
- Exact Cedr version:
- Official release archive SHA-256 and matching pinned digest:
- SHA256SUMS manifest digest:
- `gh attestation verify` outcome:
- Command: `bash run-peer.sh`
- Process exit code:

## Actual public MCP handshake

- Did Cedr send JSON-RPC `initialize`? Yes / No / Unconfirmed:
- Did Cedr send `tools/list`? Yes / No / Unconfirmed:
- Observed remote client/name/URL:
- `servers[].status`:
- Parsed tool count and names (metadata only):
- Evidence of nonempty `method=introspect` surface:
- Observed protocol version, if known:
- Sanitized `remote-report.json` and `verdict.json` evidence link:
- Evidence SHA-256 manifest:
- Error detail on failure/inconclusive run:

## Peer decision

- [ ] PASS: verified Cedr v0.8.1 release, exact public endpoint, nonempty introspected MCP tool surface, `unchanged` recheck and exit 0
- [ ] FAIL: actual remote command produced incompatible/failed/changed result
- [ ] INCONCLUSIVE: no real network run, missing attestation, absent report, incomplete verification or unavailable runner

A self-baselined passing MCP tool listing **does not prove** physical product authenticity, signed-record verification, issuer authority, Cedr endorsement, A2A TCK conformance, a customer sale, or long-term monitoring. Redact raw logs and never share session identifiers, API secrets or private artifacts. Keep the linked draft GitLab !2030 under its independent approval and release hold.
