# Independent free-MCP developer reproduction — opt-in evidence intake

**Status:** public submission contract and offline preflight. This is **not** a recorded third-party activation, a verified on-chain receipt, a product authenticity claim, or payment acceptance.

## 1. Run the existing bounded client (only with your own consent)

Start from a known repository commit and save the **full 40-hex commit SHA**. Inspect the code first. Node.js >=22; no wallet, account, private keys, payment headers, customer identifiers, or production write access.

~~~sh
node scripts/agent-adoption/free-record-smoke.mjs > free-result.json
sha256sum free-result.json   # or: shasum -a 256 free-result.json
~~~

The existing client pins "https://authichain.com/mcp/free", performs initialize, tools/list, then tools/call verify_record({id:"polygon-anchor-1"}), and fails closed on HTTP 402, unexpected tools, version mismatch and malformed results. A failed run must be reported as failed, not silently discarded. The output is a **self-reported summary**: it cannot by itself prove who operated the client, that a network request arrived, or that JSON-RPC IDs matched on the wire. Inspect the output and never publish raw secrets or personal data.

## 2. Prepare a separate submission.json

Replace the illustrative identity, full Git commit SHA, runtime, and hash with **your** evidence. The example below is intentionally invalid until filled in. "unaffiliated" and "consentToPublish" are self-declarations reviewed against the actual GitHub submission author.

~~~json
{
  "schema": "authichain-free-mcp-reproduction/v1",
  "protocol": "mcp",
  "operator": {
    "github": "YOUR_PUBLIC_GITHUB_HANDLE",
    "unaffiliated": true,
    "consentToPublish": true
  },
  "client": {
    "repoUrl": "https://github.com/undone0603/authichain-unified",
    "commitSha": "REPLACE_WITH_FULL_40_HEX_SHA",
    "runtime": "Node.js 22"
  },
  "execution": {
    "command": "node scripts/agent-adoption/free-record-smoke.mjs",
    "endpoint": "https://authichain.com/mcp/free",
    "tool": "verify_record",
    "demoId": "polygon-anchor-1",
    "resultSha256": "REPLACE_WITH_SHA256_OF_EXACT_FREE_RESULT_JSON_BYTES"
  }
}
~~~

Run the offline acceptance preflight, without external HTTP or paid service calls:

~~~sh
node scripts/agent-adoption/validate-independent-receipt.mjs submission.json free-result.json
node --test scripts/agent-adoption/validate-independent-receipt.test.mjs
~~~

**REVIEW_REQUIRED means only that supplied JSON passes structural and free-scope checks.** It cannot certify independent authorship, remote transport, protocol correctness, signature validity, physical provenance, Polygon confirmation, settlement, or adoption. REJECTED identifies missing or unsafe evidence. The hash protects supplied bytes against accidental modification; it does not authenticate origin. A summary verdict of unverified may be a successful transport test, not a verified product.

## 3. Submit only if you choose to

Use the [voluntary GitHub issue form](https://github.com/undone0603/authichain-unified/issues/new?template=independent-mcp-reproduction.yml), or link redacted artifacts in [developer acceptance #2486](https://github.com/undone0603/authichain-unified/issues/2486). Include your public GitHub identity, affiliation disclosure, full source SHA, UTC, runtime, exact command, complete **sanitized** free-result.json, submission.json, SHA-256, preflight output, and any independently obtained redacted HTTP status/request-ID evidence. No unsolicited outreach or private personal information is necessary.

### Maintainer acceptance is a separate step

1. Verify that the submitter affirmatively consented and that their GitHub identity authored the issue; compare declared affiliation against known owner/house identities. No self-attestation alone is accepted as independence.
2. Pin the exact client commit and inspect the allowed endpoint, demo ID, operation, runtime and safety boundaries. Reject forks invoking paid tools or overriding the endpoint.
3. Verify the file SHA and rerun the offline preflight. Obtain corroborating redacted HTTP request-response IDs/statuses or arrange an explicitly authorized independent reproduction. An owner's server-side smoke test does not establish independent authorship.
4. Record explicit ACCEPTED, REJECTED, or INCONCLUSIVE, with dated reviewer identity and source URLs, in [#2486](https://github.com/undone0603/authichain-unified/issues/2486), then update [central scorecard #2263](https://github.com/undone0603/authichain-unified/issues/2263). Count distinct independent operators **only after** authenticated evidence and reviewer acceptance, never by ticket count or script runs.

## Reuse boundaries for future A2A and x402

Reuse the consent / commit provenance / sanitized evidence / SHA-256 / manual review pattern only after a genuine independent free-MCP success. A2A needs its own verified task/message lifecycle and version negotiation. x402 discovery and synthetic ledger tests are not settled purchases: any money movement, buyer delivery and paid attribution require their own explicit authority and independent receipts. This intake refuses both protocols rather than treating them as MCP successes.

### Existing external participation is not yet MCP acceptance

A third-party contributor, [VibeMirror-coder](https://github.com/undone0603/authichain-unified/issues/2263#issuecomment-6849756206), voluntarily supplied a pinned **offline no-funds** synthetic delivery/settlement fixture for peer discussion. This is a real external code proposal, **not** a report that the contributor ran AuthiChain's MCP verify_record against the live free endpoint, nor a settled payment or consented paid integration. Keep it in the peer-contribution lane and do not mark this acceptance gate complete from it.
