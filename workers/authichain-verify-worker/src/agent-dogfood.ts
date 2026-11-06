import { MemoryAgentReplayStore } from "./agent-store";
import { createAgentPassport, verifyAgentMessage } from "./agent-verifier";
import {
  AGENTZ_SALES_CAPABILITIES,
  GUARDIAN_CAPABILITIES,
  SCOUT_CAPABILITIES,
} from "./agent-types";
import { generateP256, issueAgentIdentity, MemoryAgentRegistry, signAgentMessage } from "./agent-issuer";
import { AcquisitionLedger, acquisitionReport, type AcquisitionReport } from "./acquisition-ledger";
import {
  buildOutboundBody,
  checkoutIntentUrl,
  contentHash,
  DPP_OFFER_LINE,
  performOutbound,
  authorizeDraft,
  TestOutboundTransport,
  type BrandedDecision,
} from "./outbound-gate";
import {
  advanceToFulfillment,
  applyInbound,
  executeCreateOpportunity,
  executeDiscover,
  observePayment,
  recordCheckoutIntent,
  type PaymentObservation,
} from "./scout";
import {
  defaultOutboundCampaign,
  defaultOutboundPolicy,
  messageWindow,
  OUTBOUND_POLICY_VERSION,
  type CreateOpportunityPayload,
  type DiscoverProspectPayload,
  type DraftOutboundPayload,
  type Opportunity,
  type OutboundActionPayload,
  type Prospect,
} from "./outbound-types";

export const DOGFOOD_NOW = new Date("2026-10-08T19:00:00.000Z");
export const DOGFOOD_ORG = "org:authichain:core";
export const DOGFOOD_ISSUER = "issuer:authichain:root";
export const SCOUT_AGENT_ID = "agent:authichain:scout-01";
export const AGENTZ_AGENT_ID = "agent:authichain:agentz-sales-01";
export const GUARDIAN_AGENT_ID = "agent:authichain:guardian-01";

const EVIDENCE = {
  evidence_id: "evi:example-test:dpp-notice",
  kind: "dpp_requirement" as const,
  source_url: "https://example.test/notices/dpp-readiness",
  summary: "Example Battery Works published a DPP readiness notice for its battery line.",
  observed_at: "2026-10-01T00:00:00.000Z",
};

export interface DogfoodTrace {
  prospect?: Prospect;
  opportunity?: Opportunity;
  decision: BrandedDecision;
  capture: { recipient: string; agent_id: string; signature: string; delivered: boolean; external: false } | undefined;
  delivered: boolean;
  external: boolean;
  inboundStatus?: string;
  checkoutUrl?: string;
  fixturePayment: PaymentObservation;
  providerPayment: PaymentObservation;
  fulfillment: { ok: false; code: "ENTITLEMENT_NOT_GRANTED" };
  selfVerified: boolean;
  guardianVerified: boolean;
  passportStatus: string;
  report: AcquisitionReport;
}

/**
 * Mocked AgentZ path. Uses the test transport only.
 * Does not send mail, open Stripe, grant an entitlement, or mark cash.
 */
export async function runAgentZDogfood(now = DOGFOOD_NOW): Promise<DogfoodTrace> {
  const issuer = await generateP256();
  const registry = new MemoryAgentRegistry();
  registry.registerIssuer(DOGFOOD_ISSUER, issuer.publicKeyJwk);
  const replay = new MemoryAgentReplayStore();
  const ledger = new AcquisitionLedger();
  const policy = defaultOutboundPolicy();
  const campaign = defaultOutboundCampaign();
  const issuedAt = "2026-10-08T18:00:00.000Z";
  const common = {
    organizationId: DOGFOOD_ORG,
    version: "1.0.0",
    policyVersion: OUTBOUND_POLICY_VERSION,
    issuerId: DOGFOOD_ISSUER,
    issuedAt,
    effectiveAt: issuedAt,
    expiresAt: "2026-10-09T19:00:00.000Z",
    issuerPrivateKey: issuer.privateKey,
    now,
  };
  const scout = await issueAgentIdentity({
    ...common,
    agentId: SCOUT_AGENT_ID,
    role: "scout",
    capabilities: SCOUT_CAPABILITIES,
    attestationId: "att:agent:scout-01",
  });
  const agentz = await issueAgentIdentity({
    ...common,
    agentId: AGENTZ_AGENT_ID,
    role: "sales",
    capabilities: AGENTZ_SALES_CAPABILITIES,
    attestationId: "att:agent:agentz-sales-01",
  });
  const guardian = await issueAgentIdentity({
    ...common,
    agentId: GUARDIAN_AGENT_ID,
    role: "guardian",
    capabilities: GUARDIAN_CAPABILITIES,
    attestationId: "att:agent:guardian-01",
  });
  registry.put(scout.attestation);
  registry.put(agentz.attestation);
  registry.put(guardian.attestation);

  const window = messageWindow(now);
  const selfMessage = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:agentz:self-check",
    agent_id: agentz.attestation.agent_id,
    organization_id: agentz.attestation.organization_id,
    attestation_id: agentz.attestation.attestation_id,
    role: agentz.attestation.role,
    version: agentz.attestation.version,
    capabilities: ["READ_EVIDENCE"],
    policy_version: agentz.attestation.policy_version,
    ...window,
    intent: "READ_EVIDENCE",
    evidence_ids: [EVIDENCE.evidence_id],
    payload: { subject: "self" },
  }, agentz.privateKey);
  const selfVerified = await verifyAgentMessage(selfMessage, { resolver: registry, replayStore: replay, now, requiredCapability: "READ_EVIDENCE", expectedIntent: "READ_EVIDENCE" });
  const guardianMessage = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:guardian:verify-agentz",
    agent_id: guardian.attestation.agent_id,
    organization_id: guardian.attestation.organization_id,
    attestation_id: guardian.attestation.attestation_id,
    role: guardian.attestation.role,
    version: guardian.attestation.version,
    capabilities: ["VERIFY_ATTESTATION", "READ_EVIDENCE"],
    policy_version: guardian.attestation.policy_version,
    ...window,
    intent: "VERIFY_ATTESTATION",
    evidence_ids: [agentz.attestation.attestation_id],
    payload: { subject_attestation_id: agentz.attestation.attestation_id },
  }, guardian.privateKey);
  const guardianVerified = await verifyAgentMessage(guardianMessage, { resolver: registry, replayStore: replay, now, requiredCapability: "VERIFY_ATTESTATION", expectedIntent: "VERIFY_ATTESTATION" });

  const discoverPayload: DiscoverProspectPayload = {
    action: "DISCOVER_PROSPECT",
    prospect_id: "prospect:example.test:dpp-notice",
    organization: "Example Battery Works",
    domain: "example.test",
    evidence: [EVIDENCE],
    contact: { email: "standards@example.test", source: "published_contact" },
    recommended_agent: AGENTZ_AGENT_ID,
  };
  const discover = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:scout:discover:example-test",
    agent_id: scout.attestation.agent_id,
    organization_id: scout.attestation.organization_id,
    attestation_id: scout.attestation.attestation_id,
    role: scout.attestation.role,
    version: scout.attestation.version,
    capabilities: ["DISCOVER_PROSPECT", "READ_EVIDENCE", "SCORE_PROSPECT"],
    policy_version: scout.attestation.policy_version,
    ...window,
    intent: "DISCOVER_PROSPECT",
    evidence_ids: [EVIDENCE.evidence_id],
    payload: discoverPayload,
  }, scout.privateKey);
  const discovered = await executeDiscover({ message: discover, registry, replay, ledger, policy, now });
  const opportunityId = "opp:example.test:dpp-notice";
  const assignPayload: CreateOpportunityPayload = {
    action: "CREATE_OPPORTUNITY",
    prospect_id: "prospect:example.test:dpp-notice",
    opportunity_id: opportunityId,
    campaign_id: campaign.campaign_id,
    offer_id: "dpp_readiness",
    recommended_agent: AGENTZ_AGENT_ID,
    evidence_ids: [EVIDENCE.evidence_id],
    attribution: campaign.attribution,
  };
  const assign = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:scout:opportunity:example-test",
    agent_id: scout.attestation.agent_id,
    organization_id: scout.attestation.organization_id,
    attestation_id: scout.attestation.attestation_id,
    role: scout.attestation.role,
    version: scout.attestation.version,
    capabilities: ["CREATE_OPPORTUNITY"],
    policy_version: scout.attestation.policy_version,
    ...window,
    intent: "CREATE_OPPORTUNITY",
    evidence_ids: [EVIDENCE.evidence_id],
    payload: assignPayload,
  }, scout.privateKey);
  await executeCreateOpportunity({ message: assign, registry, replay, ledger, policy, campaign, now });

  const body = buildOutboundBody({
    agentId: agentz.attestation.agent_id,
    organizationId: agentz.attestation.organization_id,
    role: agentz.attestation.role,
    attestationId: agentz.attestation.attestation_id,
    offerLine: DPP_OFFER_LINE,
    checkoutUrl: checkoutIntentUrl(campaign.offer_id, campaign.campaign_id),
  });
  const hash = await contentHash(body);
  const draftPayload: DraftOutboundPayload = {
    action: "DRAFT_OUTBOUND",
    prospect_id: "prospect:example.test:dpp-notice",
    opportunity_id: opportunityId,
    campaign_id: campaign.campaign_id,
    content_hash: hash,
    body,
  };
  const draft = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:agentz:draft:example-test",
    agent_id: agentz.attestation.agent_id,
    organization_id: agentz.attestation.organization_id,
    attestation_id: agentz.attestation.attestation_id,
    role: agentz.attestation.role,
    version: agentz.attestation.version,
    capabilities: ["DRAFT_OUTBOUND"],
    policy_version: agentz.attestation.policy_version,
    ...window,
    intent: "DRAFT_OUTBOUND",
    evidence_ids: [EVIDENCE.evidence_id],
    payload: draftPayload,
  }, agentz.privateKey);
  await authorizeDraft({ message: draft, registry, replay, ledger, policy, now });

  const sendPayload: OutboundActionPayload = {
    action: "SEND_OUTBOUND",
    prospect_id: "prospect:example.test:dpp-notice",
    opportunity_id: opportunityId,
    campaign_id: campaign.campaign_id,
    attribution: campaign.attribution,
    recipient: "standards@example.test",
    recipient_source: "published_contact",
    content_hash: hash,
    body,
  };
  const send = await signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: "msg:agentz:send:example-test",
    agent_id: agentz.attestation.agent_id,
    organization_id: agentz.attestation.organization_id,
    attestation_id: agentz.attestation.attestation_id,
    role: agentz.attestation.role,
    version: agentz.attestation.version,
    capabilities: ["SEND_OUTBOUND"],
    policy_version: agentz.attestation.policy_version,
    ...window,
    intent: "SEND_OUTBOUND",
    evidence_ids: [EVIDENCE.evidence_id],
    payload: sendPayload,
  }, agentz.privateKey);
  const testTransport = new TestOutboundTransport();
  const sent = await performOutbound({
    message: send,
    registry,
    replay,
    ledger,
    policy,
    campaign,
    transport: "test",
    now,
    testTransport,
  });
  const inbound = applyInbound(ledger, {
    conversation_id: "conv:msg:agentz:send:example-test",
    kind: "reply",
    body: "Yes, we are interested. Please send the checkout link.",
    at: "2026-10-08T20:00:00.000Z",
  });
  const checkout = recordCheckoutIntent(ledger, opportunityId, "2026-10-08T20:05:00.000Z");
  const fixturePayment = observePayment(ledger, {
    opportunity_id: opportunityId,
    source: "fixture",
    at: "2026-10-08T20:06:00.000Z",
  });
  const providerPayment = observePayment(ledger, {
    opportunity_id: opportunityId,
    source: "provider",
    livemode: true,
    amount_cents: 29900,
    session_id: "cs_observation_not_cash",
    at: "2026-10-08T20:07:00.000Z",
  });
  const fulfillment = advanceToFulfillment("PROVISIONED");
  return {
    prospect: discovered.prospect,
    opportunity: ledger.opportunities.get(opportunityId),
    decision: sent.decision,
    capture: testTransport.captured[0],
    delivered: sent.result.delivered,
    external: sent.result.external,
    inboundStatus: inbound.status,
    checkoutUrl: checkout.url,
    fixturePayment,
    providerPayment,
    fulfillment,
    selfVerified: selfVerified.valid,
    guardianVerified: guardianVerified.valid,
    passportStatus: createAgentPassport(agentz.attestation, false, now).status,
    report: acquisitionReport(ledger),
  };
}

