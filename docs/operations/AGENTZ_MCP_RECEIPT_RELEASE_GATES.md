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

## Protected live challenge proof (added to this draft)

Once deployed through a protected release and authenticated through the existing
Cloudflare Access policy **and** the AgentZ API bearer token, submit an
operator-generated fresh random ASCII challenge (16–256 printable characters)
to `POST /agentz/evidence/sign-identity-challenge` with JSON body
`{"challenge":"<unique-random-value>"}`. The API signs the exact challenge
with the same published Ed25519 key and returns only a compact JWS and public
payload. Independently verify EdDSA signature, the published `did:key`, JWS
`kid`, challenge equality, and timestamp. Never upload or print the private
key. This proves signing-key possession at the observed time, not deployment
source provenance or ongoing key custody. Challenge signing is protected by
the same `AGENT_SECRET` dependency as MCP receipt signing; Cloudflare Access
must remain enforced.

**Do not mistake the newly committed endpoint for a deployed endpoint.**
Until protected release, live runtime proof remains unverified.

## Independent deployment provenance verification (draft implementation)

The `agentz/core/deployment_provenance.py` verifier requires:
1. An AgentZ Ed25519 JWS using the **published** DID public key.
2. The exact deployable artifact bytes; SHA-256 must match the signed claim.
3. The protected GitHub release's source SHA and workflow run ID, independently
   retrieved by the verifier, not copied from the signed manifest.
4. The Cloudflare deployment ID and version ID, independently retrieved from
   the authenticated Cloudflare deployments API, not copied from the manifest.
5. A signed UTC timestamp.

The verifier deliberately fails closed if any of these are absent, invalid,
or mismatched. Test-only ephemeral keys are used in offline tests, never as
evidence of production AgentZ identity.

**Evidence still missing:** a protected workflow that builds the exact bytes,
records their digest, deploys those same bytes, captures the Cloudflare
deployment/version IDs, and obtains an AgentZ signature over that immutable
manifest. No signer has yet produced a real production attestation, and the
connected Cloudflare deployment API does not currently supply a trusted source
commit/artifact digest. The live AgentZ API is behind Access and the challenge
signing endpoint is not yet deployed. This code therefore proves verifier
behavior only; it is not a completed deployment attestation.

## AgentZ provenance signing producer (draft, not deployed)

`agentz.core.deployment_provenance.sign_deployment_provenance` now
produces a compact Ed25519 JWS using the *existing* AgentZ private key
only when `identity_status.can_sign_as_self` is true and the PEM matches
the published DID. It binds the exact deployable artifact SHA-256,
source SHA, GitHub protected workflow run ID, Cloudflare deployment ID
and Cloudflare version ID.

This signer is intentionally a library function, **not** a public HTTP
endpoint. It must be invoked only by a trusted protected release
controller after it has independently gathered these facts. Passing
caller-supplied identifiers into the signer without checking their
origin would produce a signed claim, not independent deployment
provenance. The verifier separately requires independently sourced
expectations and the exact deployable artifact bytes.

**Still needed for real proof:** identify and review the existing
protected AgentZ deployment path; instrument it to retain the actual
deployable artifact, record a GitHub run/source and Cloudflare
deployment/version, and invoke the authenticated AgentZ signer from a
trusted execution environment. Obtain a real signature, verify it
independently, and preserve the result as immutable release evidence.
No deployed AgentZ signing proof exists yet.
