# Verifiable outbound agents

AuthiChain agents that discover prospects or send mail use the existing agent protocol `authichain-agent/1`. There is no second identity system.

Identity is an issuer-signed `AgentIdentityAttestation` (ECDSA P-256, domain separator `authichain-agent-identity/1`). A passport `status` is derived by `createAgentPassport`. Status is not inside the signature, so revocation can take effect without rewriting the attestation. `agent_id = "AgentZ"` is not an identity.

## Capabilities

Grants are the role lists in `workers/authichain-verify-worker/src/agent-types.ts`.

| Role | Capabilities |
| --- | --- |
| Scout | `DISCOVER_PROSPECT`, `READ_EVIDENCE`, `SCORE_PROSPECT`, `CREATE_OPPORTUNITY` |
| AgentZ sales | `READ_EVIDENCE`, `DRAFT_OUTBOUND`, `SEND_OUTBOUND`, `READ_INBOUND`, `MANAGE_CONVERSATION`, `PROPOSE_OFFER` |
| Guardian | `VERIFY_ATTESTATION`, `READ_EVIDENCE`, `CREATE_AUDIT_RECORD` |

No role receives every capability. A presented capability must be a subset of the attestation. The outbound policy must also still allow that capability.

## Authorization

`authorizeOutbound` in `outbound-gate.ts` is the only send gate. `performOutbound` is the only path that hands a decision to a transport. Decisions carry an unexported brand. A hand-built `{ allow: true }` object is refused by both transports.

The gate requires all of the following:

1. `verifyAgentMessage` accepts the signed `authichain-agent/1` message (issuer, signature, lifetime, revocation, replay, message-id).
2. The message presents `SEND_OUTBOUND` and the policy version `outbound-2026.10` still allows it.
3. The campaign is authorized, unpaused, and carries attribution.
4. The offer is in the campaign policy and in `COMMERCIAL_OUTBOUND_OFFERS` (a subset of `PUBLIC_PLAN_IDS`, not `free`, not Farm, not Theater). The default policy allows `dpp_readiness` only.
5. The opportunity was created by a signed Scout assignment, the evidence ids match, and a signed draft matches the body hash.
6. `assessRecipient` allows the address (trusted source, not a role inbox unless the campaign explicitly allows it, not `.gov` or `.mil`).
7. The recipient is not suppressed, not a duplicate for that campaign, and inside agent, campaign, recipient, and cooldown limits.
8. Email also requires `production_send` and `human_send_approved`. Both default to false.

An allow records the contact immediately. Handing that same decision to a transport twice is refused. A missing email sender still consumes the slot and sends nothing.

Denials use a stable `code`: `IDENTITY_INVALID`, `CAPABILITY_MISSING`, `POLICY_DENIED`, `RECIPIENT_INELIGIBLE`, `CAMPAIGN_UNAUTHORIZED`, `OFFER_NOT_PUBLIC`, `SUPPRESSED`, `RATE_LIMIT`, `DUPLICATE_CONTACT`, `KILL_SWITCH`, `PRODUCTION_SEND_DISABLED`, `REPLAY`, `ATTRIBUTION_MISSING`, `BINDING_MISMATCH`, `TRANSPORT_REFUSED`. Verifier reasons stay on the decision. Allowed and denied send attempts are rows in `AcquisitionLedger.audits`.

`packages/policy` evaluates product manufacturing and inspection evidence. It is not this gate. Recipient provenance stays in `server/outreach/recipient-rules.ts`.

Identity does not authorize `PURCHASE`, `REFUND`, `CONTRACT`, `TRANSFER`, `CHARGE`, `LEGAL_COMMITMENT`, or `IMPERSONATE`.

## Scout

`qualifyProspect` scores only caller-supplied public HTTPS evidence. It does not crawl and it does not invent companies. Sensitive phrases (SSN, password, date of birth, medical record) disqualify the prospect. A qualified prospect stores evidence ids, scores, the `dpp_readiness` offer, and the recommended agent id. `executeDiscover` and `executeCreateOpportunity` require signed Scout messages.

## Transports

`TestOutboundTransport` records the recipient, body, agent id, signature, campaign, prospect, and the branded decision. It does not leave the process. A capture is not an inbox delivery. The funnel event is `test_transport_captured` with `external_delivery:false`.

`EmailTransport` sends only when the decision is branded, `allow` is true, `production_send` is true, `human_send_approved` is true, and a sender function was injected. The default sender is null, so the adapter returns `sender_not_configured` and does not call the network. No Resend client is wired.

## Inbound and funnel

Replies resolve by conversation id created at capture. The reply itself is not agent-signed, so `reply_verified` stays false and `context_verified` is true only when the conversation exists. Opt-out and bounce write recipient suppression. The next send is denied with `SUPPRESSED`. Unknown conversations and malformed events, including an `engaged` event without `transport_confirmed`, do not change state. This path does not invent opens.

`recordCheckoutIntent` stores `https://authichain.com/checkout/<offer>` with `utm_medium=agent_outbound`. It does not create a Stripe Checkout Session.

`observePayment` refuses fixtures (`NOT_PROVIDER_PAYMENT`). A provider-shaped note (`source: "provider"`, `livemode: true`, a positive amount, a `cs_` session id) records `PAID` with `entitlement_granted: false` and `cash_recognized: false`. It does not call `provisionPurchase`. `advanceToFulfillment` always returns `ENTITLEMENT_NOT_GRANTED`. Grants, activation, first value, and retention remain on the existing Stripe webhook and DPP loop. Duplicate checkout and payment observations are not written twice.

`acquisitionReport` counts ledger events only. `entitlements_granted`, `provisioned`, `activated`, `first_value`, `retained`, and `expanded` are zero in this module because nothing here writes them.

## Production boundary

`schema/agent-outbound.sql` is the D1 shape and is not applied. The tested store is in memory.

Production mail stays off until a human sets `production_send`, sets `human_send_approved` on a campaign, and configures a sender. This tree does not do those three things. The kill switch and attestation revocation block the next send. No mail is sent by the dogfood path.

Human authorization is still required for a real charge, a contract, a refund, a purchase, mass outreach, and sensitive personal targeting. The mocked dogfood in `runAgentZDogfood` uses `standards@example.test` and the test transport.
