import type {
  AgentIdentityResolver,
  AgentReplayStore,
  AgentVerificationFailureReason,
} from "./agent-types";
import type { SignedAgentMessage } from "./agent-message";
import { sha256Base64Url } from "./agent-message";
import { verifyAgentMessage } from "./agent-verifier";
import {
  assessRecipient,
  type VerificationSource,
} from "../../../server/outreach/recipient-rules";
import {
  AcquisitionLedger,
  normalizeEmail,
  type AuditRow,
} from "./acquisition-ledger";
import {
  isCommercialOutboundOffer,
  sameIdSet,
  type OutboundActionPayload,
  type OutboundCampaign,
  type OutboundDecision,
  type OutboundDenial,
  type OutboundEnvelope,
  type OutboundPolicy,
  type OutboundTransportKind,
  type DraftOutboundPayload,
} from "./outbound-types";

const GATE_BRAND = Symbol("authichain.outbound.gate");
const GATE_CONSUMED = Symbol("authichain.outbound.consumed");

export interface BrandedDecision extends OutboundDecision {
  [GATE_BRAND]?: true;
}

function brand(decision: OutboundDecision): BrandedDecision {
  const branded = decision as BrandedDecision;
  Object.defineProperty(branded, GATE_BRAND, {
    value: true,
    enumerable: false,
  });
  return branded;
}

export function decisionIsGated(decision: OutboundDecision): boolean {
  return (decision as BrandedDecision)[GATE_BRAND] === true;
}

const BLOCKED_INTENTS = new Set([
  "PURCHASE",
  "REFUND",
  "CONTRACT",
  "TRANSFER",
  "LEGAL_COMMITMENT",
  "CHARGE",
  "IMPERSONATE",
]);

export function outboundDisclosure(input: {
  agentId: string;
  organizationId: string;
  role: string;
  attestationId: string;
}): string {
  return [
    "This message is from an AI agent acting for AuthiChain, not a human.",
    `agent_id: ${input.agentId}`,
    `organization_id: ${input.organizationId}`,
    `role: ${input.role}`,
    "capability: SEND_OUTBOUND",
    `attestation_id: ${input.attestationId}`,
    "protocol: authichain-agent/1",
    "The sender is software. It is not a person and it cannot bind AuthiChain to a contract, a payment, or a legal commitment.",
  ].join("\n");
}

export function buildOutboundBody(input: {
  agentId: string;
  organizationId: string;
  role: string;
  attestationId: string;
  offerLine: string;
  checkoutUrl: string;
}): string {
  return [
    input.offerLine,
    `Checkout: ${input.checkoutUrl}`,
    outboundDisclosure(input),
  ].join("\n\n");
}

export function checkoutIntentUrl(offerId: string, campaignId: string): string {
  const url = new URL(`https://authichain.com/checkout/${offerId}`);
  url.searchParams.set("utm_source", "authichain");
  url.searchParams.set("utm_medium", "agent_outbound");
  url.searchParams.set("utm_campaign", campaignId);
  url.searchParams.set("utm_content", offerId);
  return url.toString();
}

export const DPP_OFFER_LINE =
  "EU DPP Workspace is $299. One-time checkout that opens an AuthiChain workspace. Not an audit, not certification, and not legal advice.";

export async function contentHash(body: string): Promise<string> {
  return sha256Base64Url(body);
}

export function envelopeOf(
  message: SignedAgentMessage<OutboundActionPayload>
): OutboundEnvelope {
  return {
    message_id: message.message_id,
    agent_id: message.agent_id,
    organization_id: message.organization_id,
    prospect_id: message.payload.prospect_id,
    opportunity_id: message.payload.opportunity_id,
    campaign_id: message.payload.campaign_id,
    action: "SEND_OUTBOUND",
    timestamp: message.issued_at,
    policy_version: message.policy_version,
    capability: "SEND_OUTBOUND",
    attribution: message.payload.attribution,
    content_hash: message.payload.content_hash,
    signature: message.signature,
    evidence_ids: [...message.evidence_ids],
  };
}

function mapIdentity(
  reasons: AgentVerificationFailureReason[]
): OutboundDenial {
  if (
    reasons.includes("MESSAGE_REPLAYED") ||
    reasons.includes("MESSAGE_ID_CONFLICT")
  )
    return "REPLAY";
  if (reasons.includes("CAPABILITY_NOT_GRANTED")) return "CAPABILITY_MISSING";
  return "IDENTITY_INVALID";
}

export async function authorizeOutbound(input: {
  message: SignedAgentMessage<OutboundActionPayload>;
  registry: AgentIdentityResolver;
  replay: AgentReplayStore;
  ledger: AcquisitionLedger;
  policy: OutboundPolicy;
  campaign: OutboundCampaign | null;
  transport: OutboundTransportKind;
  now?: Date;
}): Promise<BrandedDecision> {
  const now = input.now ?? new Date();
  const policy = input.policy;
  const campaign = input.campaign;
  const base = {
    transport: input.transport,
    production_send: policy.production_send,
    human_send_approved: campaign?.human_send_approved ?? false,
    message_id: input.message?.message_id,
    agent_id: input.message?.agent_id,
    organization_id: input.message?.organization_id,
    attestation_id: input.message?.attestation_id,
    policy_version: input.message?.policy_version,
    prospect_id: input.message?.payload?.prospect_id,
    opportunity_id: input.message?.payload?.opportunity_id,
    campaign_id: input.message?.payload?.campaign_id,
  };

  const finish = (
    code: "ALLOW" | OutboundDenial,
    reasons: string[],
    extra: Partial<OutboundDecision> = {}
  ): BrandedDecision => {
    const decision: OutboundDecision = {
      ...base,
      ...extra,
      allow: code === "ALLOW",
      code,
      reasons,
    };
    input.ledger.recordAudit(auditFrom(decision, now));
    return brand(decision);
  };

  if (policy.kill_switch || input.ledger.emergencyStop) {
    return finish("KILL_SWITCH", ["kill_switch"]);
  }

  const verified = await verifyAgentMessage(input.message, {
    resolver: input.registry,
    replayStore: input.replay,
    now,
    requiredCapability: "SEND_OUTBOUND",
    expectedIntent: "SEND_OUTBOUND",
  });
  const identityExtra = {
    agent_id: verified.agent_id ?? base.agent_id,
    organization_id: verified.organization_id ?? base.organization_id,
    attestation_id: verified.attestation_id ?? base.attestation_id,
    message_digest: verified.message_digest,
    policy_version: verified.policy_version ?? base.policy_version,
    verifier_reasons: verified.reasons,
  };
  if (!verified.valid) {
    return finish(
      mapIdentity(verified.reasons),
      verified.reasons,
      identityExtra
    );
  }

  const payload = input.message.payload;
  if (
    !payload ||
    payload.action !== "SEND_OUTBOUND" ||
    input.message.intent !== "SEND_OUTBOUND"
  ) {
    const intent = input.message.intent || "missing";
    if (BLOCKED_INTENTS.has(intent)) {
      return finish(
        "POLICY_DENIED",
        [`action_not_permitted:${intent}`],
        identityExtra
      );
    }
    return finish("BINDING_MISMATCH", ["action_mismatch"], identityExtra);
  }
  if (!input.message.capabilities.includes("SEND_OUTBOUND")) {
    return finish("CAPABILITY_MISSING", ["SEND_OUTBOUND"], identityExtra);
  }
  if (!policy.allowed_capabilities.includes("SEND_OUTBOUND")) {
    return finish(
      "POLICY_DENIED",
      ["capability_revoked_by_policy"],
      identityExtra
    );
  }
  if (input.message.policy_version !== policy.policy_version) {
    return finish("POLICY_DENIED", ["policy_version_mismatch"], identityExtra);
  }
  if (!campaign || !campaign.authorized || campaign.paused) {
    const reason = !campaign
      ? "campaign_missing"
      : campaign.paused
        ? "campaign_paused"
        : "campaign_not_authorized";
    return finish("CAMPAIGN_UNAUTHORIZED", [reason], identityExtra);
  }
  if (campaign.policy_version !== policy.policy_version) {
    return finish("POLICY_DENIED", ["campaign_policy_mismatch"], identityExtra);
  }
  if (!campaign.attribution.trim() || !payload.attribution.trim()) {
    return finish("ATTRIBUTION_MISSING", ["attribution_empty"], identityExtra);
  }
  if (payload.attribution !== campaign.attribution) {
    return finish("BINDING_MISMATCH", ["attribution_mismatch"], identityExtra);
  }

  // Public, non-targeted community introductions have no qualified commercial
  // prospect, email recipient or Scout opportunity. They use the SAME signed
  // gate but a separate campaign approval and a single fixed room.
  if (input.transport === "forum") {
    const endpoint = "https://agenticsuperhero.com/api/v1/channels/lobby/messages";
    if (!campaign.allow_public_forum) {
      return finish("CAMPAIGN_UNAUTHORIZED", ["public_forum_not_approved"], identityExtra);
    }
    if (payload.campaign_id !== campaign.campaign_id ||
        payload.prospect_id !== "community:agenticsuperhero" ||
        payload.opportunity_id !== "community:agenticsuperhero:lobby") {
      return finish("BINDING_MISMATCH", ["community_scope_mismatch"], identityExtra);
    }
    if (payload.recipient !== endpoint || payload.recipient_source !== "published_contact") {
      return finish("RECIPIENT_INELIGIBLE", ["forum_endpoint_not_allowlisted"], identityExtra);
    }
    if (input.message.evidence_ids.length === 0) {
      return finish("ATTRIBUTION_MISSING", ["public_room_evidence_required"], identityExtra);
    }
    if (!payload.body.includes(outboundDisclosure({
      agentId: input.message.agent_id,
      organizationId: input.message.organization_id,
      role: input.message.role,
      attestationId: input.message.attestation_id,
    }))) {
      return finish("POLICY_DENIED", ["agent_disclosure_missing"], identityExtra);
    }
    if (await contentHash(payload.body) !== payload.content_hash) {
      return finish("BINDING_MISMATCH", ["content_hash_mismatch"], identityExtra);
    }
    const contactKey = endpoint;
    if (input.ledger.isSuppressed(contactKey)) {
      return finish("SUPPRESSED", ["forum_suppressed"], identityExtra);
    }
    if (input.ledger.duplicateContact(campaign.campaign_id, contactKey)) {
      return finish("DUPLICATE_CONTACT", ["duplicate_contact"], identityExtra);
    }
    if (input.ledger.sendsForAgent(input.message.agent_id) >= policy.max_sends_per_agent ||
        input.ledger.sendsForCampaign(campaign.campaign_id) >= policy.max_sends_per_campaign ||
        input.ledger.sendsForRecipient(contactKey).length >= policy.max_sends_per_recipient) {
      return finish("RATE_LIMIT", ["forum_rate_limit"], identityExtra);
    }
    if (!policy.production_send) {
      return finish("PRODUCTION_SEND_DISABLED", ["production_send_disabled"], identityExtra);
    }
    if (!campaign.human_send_approved) {
      return finish("CAMPAIGN_UNAUTHORIZED", ["human_send_not_approved"], identityExtra);
    }
    const decision = finish("ALLOW", [], {
      ...identityExtra, capability: "SEND_OUTBOUND",
      prospect_id: payload.prospect_id,
      opportunity_id: payload.opportunity_id,
      campaign_id: campaign.campaign_id,
    });
    input.ledger.recordSend({
      at: now.toISOString(),
      message_id: input.message.message_id,
      agent_id: input.message.agent_id,
      campaign_id: campaign.campaign_id,
      prospect_id: payload.prospect_id,
      opportunity_id: payload.opportunity_id,
      recipient: contactKey,
      content_hash: payload.content_hash,
    });
    return decision;
  }
  if (
    !isCommercialOutboundOffer(campaign.offer_id) ||
    !policy.public_offers.includes(campaign.offer_id)
  ) {
    return finish("OFFER_NOT_PUBLIC", ["offer_not_public"], identityExtra);
  }
  if (payload.campaign_id !== campaign.campaign_id) {
    return finish("BINDING_MISMATCH", ["campaign_mismatch"], identityExtra);
  }

  const opportunity = input.ledger.opportunities.get(payload.opportunity_id);
  if (!opportunity)
    return finish(
      "ATTRIBUTION_MISSING",
      ["opportunity_not_found"],
      identityExtra
    );
  if (opportunity.prospect_id !== payload.prospect_id) {
    return finish("BINDING_MISMATCH", ["prospect_mismatch"], identityExtra);
  }
  if (
    opportunity.campaign_id !== campaign.campaign_id ||
    opportunity.offer_id !== campaign.offer_id
  ) {
    return finish(
      "BINDING_MISMATCH",
      ["opportunity_campaign_mismatch"],
      identityExtra
    );
  }
  if (opportunity.recommended_agent !== input.message.agent_id) {
    return finish(
      "BINDING_MISMATCH",
      ["agent_assignment_mismatch"],
      identityExtra
    );
  }
  if (opportunity.attribution !== payload.attribution) {
    return finish(
      "BINDING_MISMATCH",
      ["opportunity_attribution_mismatch"],
      identityExtra
    );
  }
  if (
    !sameIdSet(input.message.evidence_ids, opportunity.evidence_ids) ||
    opportunity.evidence_ids.length === 0
  ) {
    return finish("ATTRIBUTION_MISSING", ["evidence_mismatch"], identityExtra);
  }
  if (opportunity.next_action !== "SEND_OUTBOUND") {
    return finish("POLICY_DENIED", ["opportunity_hold"], identityExtra);
  }
  if (
    opportunity.status === "OPTED_OUT" ||
    opportunity.status === "BOUNCED" ||
    opportunity.status === "LOST"
  ) {
    return finish("SUPPRESSED", ["opportunity_closed"], identityExtra);
  }

  const draft = input.ledger.drafts.get(opportunity.opportunity_id);
  if (!draft || draft.content_hash !== payload.content_hash) {
    return finish("POLICY_DENIED", ["draft_required"], identityExtra);
  }
  const hashed = await contentHash(payload.body);
  if (hashed !== payload.content_hash || payload.body !== draft.body) {
    return finish("BINDING_MISMATCH", ["content_hash_mismatch"], identityExtra);
  }
  if (
    !payload.body.includes(
      outboundDisclosure({
        agentId: input.message.agent_id,
        organizationId: input.message.organization_id,
        role: input.message.role,
        attestationId: input.message.attestation_id,
      })
    )
  ) {
    return finish("POLICY_DENIED", ["agent_disclosure_missing"], identityExtra);
  }

  const recipient = assessRecipient(
    payload.recipient,
    payload.recipient_source,
    { allowRoleInbox: campaign.allow_role_inbox === true }
  );
  if (recipient.status !== "allow") {
    return finish("RECIPIENT_INELIGIBLE", recipient.reasons, identityExtra);
  }
  const contactKey = recipient.email;
  if (input.ledger.isSuppressed(contactKey)) {
    return finish(
      "SUPPRESSED",
      [input.ledger.suppressionReason(contactKey) ?? "suppressed"],
      identityExtra
    );
  }
  if (input.ledger.duplicateContact(campaign.campaign_id, contactKey)) {
    return finish("DUPLICATE_CONTACT", ["duplicate_contact"], identityExtra);
  }
  if (
    input.ledger.sendsForAgent(input.message.agent_id) >=
    policy.max_sends_per_agent
  ) {
    return finish("RATE_LIMIT", ["agent_rate_limit"], identityExtra);
  }
  if (
    input.ledger.sendsForCampaign(campaign.campaign_id) >=
    policy.max_sends_per_campaign
  ) {
    return finish("RATE_LIMIT", ["campaign_rate_limit"], identityExtra);
  }
  const prior = input.ledger.sendsForRecipient(contactKey);
  if (prior.length >= policy.max_sends_per_recipient) {
    return finish("RATE_LIMIT", ["recipient_rate_limit"], identityExtra);
  }
  const last = prior[prior.length - 1];
  if (last) {
    const elapsed = now.getTime() - Date.parse(last.at);
    if (Number.isFinite(elapsed) && elapsed < policy.cooldown_ms) {
      return finish("RATE_LIMIT", ["recipient_cooldown"], identityExtra);
    }
  }

  if ((input.transport === "email" || input.transport === "forum") && !policy.production_send) {
    return finish(
      "PRODUCTION_SEND_DISABLED",
      ["production_send_disabled"],
      identityExtra
    );
  }
  if ((input.transport === "email" || input.transport === "forum") && !campaign.human_send_approved) {
    return finish(
      "CAMPAIGN_UNAUTHORIZED",
      ["human_send_not_approved"],
      identityExtra
    );
  }

  const decision = finish("ALLOW", [], {
    ...identityExtra,
    capability: "SEND_OUTBOUND",
    prospect_id: payload.prospect_id,
    opportunity_id: payload.opportunity_id,
    campaign_id: campaign.campaign_id,
  });
  // Count the authorization itself. A later transport call cannot mint a second send.
  input.ledger.recordSend({
    at: now.toISOString(),
    message_id: input.message.message_id,
    agent_id: input.message.agent_id,
    campaign_id: campaign.campaign_id,
    prospect_id: payload.prospect_id,
    opportunity_id: payload.opportunity_id,
    recipient: contactKey,
    content_hash: payload.content_hash,
  });
  return decision;
}

function auditFrom(decision: OutboundDecision, now: Date): AuditRow {
  return {
    at: now.toISOString(),
    action: "SEND_OUTBOUND",
    code: decision.code,
    reasons: decision.reasons,
    agent_id: decision.agent_id,
    organization_id: decision.organization_id,
    attestation_id: decision.attestation_id,
    message_id: decision.message_id,
    message_digest: decision.message_digest,
    prospect_id: decision.prospect_id,
    opportunity_id: decision.opportunity_id,
    campaign_id: decision.campaign_id,
    capability: decision.capability,
    policy_version: decision.policy_version,
  };
}

export interface CapturedOutbound {
  recipient: string;
  message: string;
  agent_id: string;
  signature: string;
  campaign_id: string;
  prospect_id: string;
  authorization: OutboundDecision;
  delivered: boolean;
  external: false;
}

export interface TransportResult {
  delivered: boolean;
  external: boolean;
  code: "ALLOW" | OutboundDenial;
  reason?: string;
  platform_message_id?: string;
  external_url?: string;
}

function consumeDecision(decision: OutboundDecision): boolean {
  const branded = decision as BrandedDecision & { [GATE_CONSUMED]?: true };
  if (branded[GATE_CONSUMED]) return false;
  Object.defineProperty(branded, GATE_CONSUMED, { value: true });
  return true;
}

function decisionBindsMessage(
  decision: OutboundDecision,
  message: SignedAgentMessage<OutboundActionPayload>
): boolean {
  return Boolean(
    decision.message_id &&
    decision.message_id === message.message_id &&
    decision.agent_id &&
    decision.agent_id === message.agent_id &&
    message.signature
  );
}

export class TestOutboundTransport {
  readonly captured: CapturedOutbound[] = [];

  deliver(
    decision: OutboundDecision,
    message: SignedAgentMessage<OutboundActionPayload>
  ): TransportResult {
    if (
      !decisionIsGated(decision) ||
      decision.transport !== "test" ||
      !decisionBindsMessage(decision, message) ||
      !consumeDecision(decision)
    ) {
      return {
        delivered: false,
        external: false,
        code: "TRANSPORT_REFUSED",
        reason: "ungated_decision",
      };
    }
    const delivered = decision.allow;
    this.captured.push({
      recipient: normalizeEmail(message.payload?.recipient ?? ""),
      message: message.payload?.body ?? "",
      agent_id: message.agent_id,
      signature: message.signature,
      campaign_id: message.payload?.campaign_id ?? "",
      prospect_id: message.payload?.prospect_id ?? "",
      authorization: decision,
      delivered,
      external: false,
    });
    return delivered
      ? { delivered: true, external: false, code: "ALLOW" }
      : { delivered: false, external: false, code: decision.code };
  }
}

export interface EmailSendRequest {
  recipient: string;
  body: string;
  message_id: string;
  agent_id: string;
}

export type EmailSender = (request: EmailSendRequest) => Promise<void>;

/**
 * Email adapter. It never authorizes. With no sender configured it cannot emit,
 * even when the gate returns ALLOW and production_send is on.
 */
export class EmailTransport {
  constructor(private readonly sender: EmailSender | null = null) {}

  async deliver(
    decision: OutboundDecision,
    message: SignedAgentMessage<OutboundActionPayload>
  ): Promise<TransportResult> {
    if (
      !decisionIsGated(decision) ||
      decision.transport !== "email" ||
      !decisionBindsMessage(decision, message) ||
      !consumeDecision(decision)
    ) {
      return {
        delivered: false,
        external: false,
        code: "TRANSPORT_REFUSED",
        reason: "ungated_decision",
      };
    }
    if (
      !decision.allow ||
      !decision.production_send ||
      !decision.human_send_approved
    ) {
      return {
        delivered: false,
        external: false,
        code: decision.allow ? "PRODUCTION_SEND_DISABLED" : decision.code,
      };
    }
    if (!this.sender) {
      return {
        delivered: false,
        external: false,
        code: "TRANSPORT_REFUSED",
        reason: "sender_not_configured",
      };
    }
    await this.sender({
      recipient: normalizeEmail(message.payload.recipient),
      body: message.payload.body,
      message_id: message.message_id,
      agent_id: message.agent_id,
    });
    return { delivered: true, external: true, code: "ALLOW" };
  }
}

/**
 * Single-destination, signed AgentZ public-forum adapter. External I/O only
 * occurs after the existing branded authorization is verified and consumed.
 * A zero-credential guest post is not itself proof of issuer-signed identity.
 */
export interface ForumSendRequest {
  endpoint: string;
  body: string;
  message_id: string;
  agent_id: string;
}
export interface ForumReceipt {
  platform_message_id: string;
  external_url?: string;
}
export type ForumSender = (request: ForumSendRequest) => Promise<ForumReceipt>;

export class ForumTransport {
  constructor(private readonly sender: ForumSender | null = null) {}

  async deliver(
    decision: OutboundDecision,
    message: SignedAgentMessage<OutboundActionPayload>
  ): Promise<TransportResult> {
    if (!decisionIsGated(decision) || decision.transport !== "forum" ||
        !decisionBindsMessage(decision, message) || !consumeDecision(decision)) {
      return { delivered: false, external: false, code: "TRANSPORT_REFUSED", reason: "ungated_decision" };
    }
    if (!decision.allow || !decision.production_send || !decision.human_send_approved) {
      return { delivered: false, external: false,
        code: decision.allow ? "PRODUCTION_SEND_DISABLED" : decision.code,
        reason: "forum_send_not_approved" };
    }
    if (!this.sender) {
      return { delivered: false, external: false, code: "TRANSPORT_REFUSED", reason: "forum_sender_not_configured" };
    }
    try {
      const receipt = await this.sender({
        endpoint: message.payload.recipient,
        body: message.payload.body,
        message_id: message.message_id,
        agent_id: message.agent_id,
      });
      if (!receipt?.platform_message_id) {
        return { delivered: false, external: false, code: "TRANSPORT_REFUSED",
          reason: "post_response_lacks_message_id_do_not_retry_automatically" };
      }
      return { delivered: true, external: true, code: "ALLOW",
        platform_message_id: receipt.platform_message_id, external_url: receipt.external_url };
    } catch {
      // A timed-out POST may have arrived: do not retry without first reconciling.
      return { delivered: false, external: false, code: "TRANSPORT_REFUSED",
        reason: "post_delivery_unknown_do_not_retry_automatically" };
    }
  }
}

/** Native fetch sender. Explicitly opt in via ForumTransport; never default to network sending. */
export function agenticSuperHeroForumSender(fetchFn: typeof fetch = fetch): ForumSender {
  return async ({endpoint, body}) => {
    if (endpoint !== "https://agenticsuperhero.com/api/v1/channels/lobby/messages") {
      throw new Error("forum_endpoint_not_allowlisted");
    }
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("forum_post_non_success");
    const data = await response.json() as {
      id?: string | number;
      message_id?: string | number;
      url?: string;
      message?: {id?: string | number};
    };
    const id = data.id ?? data.message_id ?? data.message?.id;
    // Reject invented URLs; accept only an explicit canonical URL from the platform.
    const external_url =
      typeof data.url === "string" && data.url.startsWith("https://agenticsuperhero.com/")
        ? data.url : undefined;
    return { platform_message_id: id == null ? "" : String(id), external_url };
  };
}

export async function performOutbound(input: {
  message: SignedAgentMessage<OutboundActionPayload>;
  registry: AgentIdentityResolver;
  replay: AgentReplayStore;
  ledger: AcquisitionLedger;
  policy: OutboundPolicy;
  campaign: OutboundCampaign | null;
  transport: OutboundTransportKind;
  now?: Date;
  testTransport?: TestOutboundTransport;
  emailTransport?: EmailTransport;
  forumTransport?: ForumTransport;
}): Promise<{ decision: BrandedDecision; result: TransportResult }> {
  const decision = await authorizeOutbound(input);
  const at = (input.now ?? new Date()).toISOString();
  const result =
    input.transport === "email"
      ? await (input.emailTransport ?? new EmailTransport(null)).deliver(
          decision,
          input.message
        )
      : input.transport === "forum"
        ? await (input.forumTransport ?? new ForumTransport(null)).deliver(decision, input.message)
        : (input.testTransport ?? new TestOutboundTransport()).deliver(
          decision,
          input.message
        );
  if (result.delivered) {
    const offer = input.campaign?.offer_id;
    input.ledger.recordFunnel({
      type: "outbound_authorized",
      at,
      prospect_id: input.message.payload.prospect_id,
      opportunity_id: input.message.payload.opportunity_id,
      agent_id: input.message.agent_id,
      campaign_id: input.message.payload.campaign_id,
      offer_id: offer,
      message_id: input.message.message_id,
    });
    const conversationId = `conv:${input.message.message_id}`;
    input.ledger.conversations.set(conversationId, {
      conversation_id: conversationId,
      message_id: input.message.message_id,
      prospect_id: input.message.payload.prospect_id,
      opportunity_id: input.message.payload.opportunity_id,
      agent_id: input.message.agent_id,
      campaign_id: input.message.payload.campaign_id,
      recipient: normalizeEmail(input.message.payload.recipient),
      status: "DELIVERED",
      reply_verified: false,
      context_verified: true,
      updated_at: at,
    });
    input.ledger.setOpportunityStatus(
      input.message.payload.opportunity_id,
      "DELIVERED",
      at
    );
    input.ledger.recordFunnel({
      type: result.external ? "external_delivery" : "test_transport_captured",
      at,
      message_id: input.message.message_id,
      agent_id: input.message.agent_id,
      prospect_id: input.message.payload.prospect_id,
      opportunity_id: input.message.payload.opportunity_id,
      campaign_id: input.message.payload.campaign_id,
      detail: result.external
        ? "external_delivery:true"
        : "external_delivery:false",
    });
  }
  return { decision, result };
}

export async function authorizeDraft(input: {
  message: SignedAgentMessage<DraftOutboundPayload>;
  registry: AgentIdentityResolver;
  replay: AgentReplayStore;
  ledger: AcquisitionLedger;
  policy: OutboundPolicy;
  now?: Date;
}): Promise<{
  ok: boolean;
  code: "RECORDED" | OutboundDenial;
  reasons: string[];
}> {
  const now = input.now ?? new Date();
  const verified = await verifyAgentMessage(input.message, {
    resolver: input.registry,
    replayStore: input.replay,
    now,
    requiredCapability: "DRAFT_OUTBOUND",
    expectedIntent: "DRAFT_OUTBOUND",
  });
  if (!verified.valid) {
    const code = mapIdentity(verified.reasons);
    input.ledger.recordAudit({
      at: now.toISOString(),
      action: "DRAFT_OUTBOUND",
      code,
      reasons: verified.reasons,
      agent_id: verified.agent_id,
      message_id: input.message.message_id,
    });
    return { ok: false, code, reasons: verified.reasons };
  }
  if (
    input.message.intent !== "DRAFT_OUTBOUND" ||
    input.message.payload?.action !== "DRAFT_OUTBOUND"
  ) {
    return refuseDraft(input.ledger, now, input.message, "BINDING_MISMATCH", [
      "action_mismatch",
    ]);
  }
  if (!input.message.capabilities.includes("DRAFT_OUTBOUND")) {
    return refuseDraft(input.ledger, now, input.message, "CAPABILITY_MISSING", [
      "DRAFT_OUTBOUND",
    ]);
  }
  if (!input.policy.allowed_capabilities.includes("DRAFT_OUTBOUND")) {
    return refuseDraft(input.ledger, now, input.message, "POLICY_DENIED", [
      "capability_revoked_by_policy",
    ]);
  }
  const payload = input.message.payload;
  const opportunity = input.ledger.opportunities.get(payload.opportunity_id);
  if (!opportunity || opportunity.prospect_id !== payload.prospect_id) {
    return refuseDraft(
      input.ledger,
      now,
      input.message,
      "ATTRIBUTION_MISSING",
      ["opportunity_not_found"]
    );
  }
  if (opportunity.recommended_agent !== input.message.agent_id) {
    return refuseDraft(input.ledger, now, input.message, "BINDING_MISMATCH", [
      "agent_assignment_mismatch",
    ]);
  }
  const hashed = await contentHash(payload.body);
  if (hashed !== payload.content_hash) {
    return refuseDraft(input.ledger, now, input.message, "BINDING_MISMATCH", [
      "content_hash_mismatch",
    ]);
  }
  if (!payload.body.includes("AI agent acting for AuthiChain, not a human.")) {
    return refuseDraft(input.ledger, now, input.message, "POLICY_DENIED", [
      "agent_disclosure_missing",
    ]);
  }
  input.ledger.drafts.set(opportunity.opportunity_id, {
    opportunity_id: opportunity.opportunity_id,
    content_hash: payload.content_hash,
    body: payload.body,
    agent_id: input.message.agent_id,
    at: now.toISOString(),
  });
  input.ledger.recordAudit({
    at: now.toISOString(),
    action: "DRAFT_OUTBOUND",
    code: "RECORDED",
    reasons: [],
    agent_id: input.message.agent_id,
    attestation_id: input.message.attestation_id,
    message_id: input.message.message_id,
    opportunity_id: opportunity.opportunity_id,
    prospect_id: opportunity.prospect_id,
    capability: "DRAFT_OUTBOUND",
  });
  return { ok: true, code: "RECORDED", reasons: [] };
}

function refuseDraft(
  ledger: AcquisitionLedger,
  now: Date,
  message: SignedAgentMessage<DraftOutboundPayload>,
  code: OutboundDenial,
  reasons: string[]
): { ok: false; code: OutboundDenial; reasons: string[] } {
  ledger.recordAudit({
    at: now.toISOString(),
    action: "DRAFT_OUTBOUND",
    code,
    reasons,
    agent_id: message.agent_id,
    message_id: message.message_id,
  });
  return { ok: false, code, reasons };
}

export type { VerificationSource };
