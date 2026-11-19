# AgentZ MCP receipt release evidence and remaining gates

This draft does not establish live deployment, actual AgentZ key possession, or a genuine signature.

## Live transport

Run from an authorized networked environment (no payment or production write):

```bash
curl --fail-with-body -sS -X POST https://authichain.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":"probe-get-pricing-1","method":"tools/call","params":{"name":"get_pricing","arguments":{}}}'
```

Record UTC time, HTTP status, exact request/response bytes, SHA-256 digests,
server content type, and whether an initialize/session negotiation was required.
Never claim POST success from the GET manifest. The draft implementation currently
assumes a direct tools/call with a JSON response. If the live server requires
initialize, session headers, or SSE, adapt the transport and tests before release.

## Protected runtime identity

Authenticate through Cloudflare Access using an authorized session, then GET
`https://agentz.authichain.com/identity`. Require
`key_possession.status == "proven"`, `can_sign_as_self == true`,
`expired == false`, and a DID matching the independently fetched published
identity. A 200 response from /health alone is insufficient.

## Deployment provenance

`AGENTZ_SOURCE_SHA` and `AGENTZ_DEPLOYED_COMMIT_SHA` matching is **not**
independent provenance. The deploy pipeline must record an immutable source SHA,
build artifact digest, protected workflow run ID, deployment ID and release
timestamp in an independently retrievable release attestation. Verify these
against the running artifact before accepting the sourceCommit field.

## Replay acceptance

`agentz/core/mcp_receipt_acceptance.py` atomically rejects a repeated execution
ID or JWS digest in a shared durable SQLite database. It is **not wired to an
API endpoint** and must not be used with per-instance ephemeral SQLite. For
multi-instance deployments, move the same unique constraints and transaction
semantics to the shared durable database and test concurrent acceptors. A
verifier must supply the expected execution ID from its own challenge context.

## Release checklist

- [ ] Live POST response captured and redacted with exact-byte digests
- [ ] Transport initialization/session/SSE behavior reproduced in tests
- [ ] Exact-head Python tests and full required CI pass
- [ ] Independent release artifact digest and deployment provenance
- [ ] Shared durable acceptance storage and concurrent replay test if one-time use is required
- [ ] Authenticated AgentZ key-possession check with published DID comparison
- [ ] Protected deployment and independent verification of a real signed receipt

No private key, synthetic locally generated identity, or fabricated receipt may
be used as production proof.
