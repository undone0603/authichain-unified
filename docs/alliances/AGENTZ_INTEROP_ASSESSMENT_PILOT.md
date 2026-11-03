# AgentZ interoperability assessment — delivery contract v0.1 (draft)

Status: **NOT FOR SALE** until an authorized independent buyer, fulfillment rehearsal, and approved agreement exist. No price is live.

## Proposed buyer deliverable
1. Client-authorized endpoint inventory (A2A AgentCard, MCP GET discovery, protocol POST).
2. Reproducible read-only HTTP fixture with sanitized request/response metadata.
3. Version matrix, supported methods, schema errors, header mismatch findings.
4. Security boundaries: authorization claims, unsupported/paid methods, no active penetration testing.
5. Signed evidence manifest when existing signing infrastructure can produce a verifiable signature; otherwise mark UNSIGNED.
6. Clear verdict: observed / not observed / inconclusive. No guarantee of physical authenticity, legal compliance, or security certification.

## Zero-new-spend fulfillment gate
- Buyer gives explicit written permission for target endpoints, scope, data retention and test rate.
- Run only GET and read-only MCP initialize/tools/list, never tools/call, payments, credential guessing, or aggressive traffic.
- Execute fixture against authorized endpoint; preserve SHA, UTC time, client version, and redacted results.
- Independently replay results from a separate network environment or report inability.
- Deliver an accessible report and verify client can retrieve it.
- Only then offer paid execution under a separately authorized agreement.

## Proposed pilot prices (not active)
Basic $99; extended $299. Validate demand before publishing or collecting funds.

## Outreach and contract controls
- Discover prospects from public opt-in requests or prior authorized relationships.
- Draft personalized asynchronous email; do not send automatically without approved recipient and messaging policy.
- Contract signing requires valid narrow mandate, delivery capacity and legal review.
- humanHold=true and production_send=false remain unchanged.
- No claims of revenue until independently verified settlement and buyer delivery.
