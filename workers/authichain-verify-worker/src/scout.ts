import type { AgentIdentityResolver, AgentReplayStore } from "./agent-types";
import type { SignedAgentMessage } from "./agent-message";
import { verifyAgentMessage } from "./agent-verifier";
import { assessRecipient } from "../../../server/outreach/recipient-rules";
import { AcquisitionLedger } from "./acquisition-ledger";
import { checkoutIntentUrl } from "./outbound-gate";
import {
  isCommercialOutboundOffer,
  sameIdSet,
  type CommercialOutboundOffer,
  type CreateOpportunityPayload,
  type DiscoverProspectPayload,
  type EvidenceKind,
  type OutboundCampaign,
  type OutboundDenial,
  type OutboundPolicy,
  type Prospect,
  type PublicEvidence,
} from "./outbound-types";

const SENSITIVE = /\b(ssn|social security|password|date of birth|medical record)\b/i;

const WEIGHTS: Record<EvidenceKind, { fit: number; intent: number; urgency: number; vertical: string }> = {
  dpp_requirement: { fit: 40, intent: 30, urgency: 25, vertical: "battery_dpp" },
  battery_passport: { fit: 45, intent: 35, urgency: 30, vertical: "battery_dpp" },
  procurement: { fit: 25, intent: 20, urgency: 20, vertical: "public_procurement" },
  authenticity: { fit: 30, intent: 25, urgency: 20, vertical: "authenticity" },
  provenance: { fit: 30, intent: 20, urgency: 15, vertical: "provenance" },
  product_launch: { fit: 20, intent: 15, urgency: 10, vertical: "product_launch" },
  partnership: { fit: 15, intent: 10, urgency: 5, vertical: "partnership" },
  regulatory_change: { fit: 35, intent: 30, urgency: 30, vertical: "regulatory" },
  supply_chain: { fit: 25, intent: 20, urgency: 15, vertical: "supply_chain" },
  pharma_traceability: { fit: 35, intent: 25, urgency: 20, vertical: "pharma_device" },
  public_vendor_request: { fit: 30, intent: 25, urgency: 25, vertical: "procurement" },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceProblems(evidence: PublicEvidence[]): string[] {
  const reasons: string[] = [];
  if (evidence.length === 0) reasons.push("evidence_missing");
  const ids = new Set<string>();
  for (const item of evidence) {
    if (!item.evidence_id || ids.has(item.evidence_id)) reasons.push("evidence_id_invalid");
    ids.add(item.evidence_id);
    if (!item.summary.trim()) reasons.push("evidence_summary_missing");
    if (!/^https:\/\/[^\s]+$/i.test(item.source_url)) reasons.push("evidence_url_not_public_https");
    if (SENSITIVE.test(item.summary) || SENSITIVE.test(item.source_url)) reasons.push("sensitive_personal_data");
    if (!WEIGHTS[item.kind]) reasons.push("evidence_kind_unknown");
  }
  return [...new Set(reasons)];
}

/** Scores only the evidence the caller supplied. It does not fetch or invent companies. */
export function qualifyProspect(input: {
  prospectId: string;
  organization: string;
  domain: string;
  evidence: PublicEvidence[];
  contact: Prospect["contact_route"];
  recommendedAgent: string;
  discoveredBy: string;
  now: string;
}): Prospect {
  const problems = evidenceProblems(input.evidence);
  if (!input.organization.trim()) problems.push("organization_missing");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(input.domain) || input.domain.includes("@")) {
    problems.push("domain_invalid");
  }
  const uniqueProblems = [...new Set(problems)];
  if (uniqueProblems.length > 0) {
    return {
      prospect_id: input.prospectId,
      organization: input.organization.trim(),
      domain: input.domain.trim().toLowerCase(),
      vertical: "unspecified",
      source: "none",
      source_url: "",
      evidence: input.evidence,
      fit_score: 0,
      intent_score: 0,
      urgency_score: 0,
      confidence: 0,
      recommended_offer: null,
      recommended_agent: input.recommendedAgent,
      contact_route: input.contact,
      status: "DISQUALIFIED",
      disqualify_reasons: uniqueProblems,
      created_at: input.now,
      updated_at: input.now,
      discovered_by: input.discoveredBy,
    };
  }
  let fit = 0;
  let intent = 0;
  let urgency = 0;
  let strongest = input.evidence[0]!;
  for (const item of input.evidence) {
    const weight = WEIGHTS[item.kind];
    fit += weight.fit;
    intent += weight.intent;
    urgency += weight.urgency;
    if (weight.fit > WEIGHTS[strongest.kind].fit) strongest = item;
  }
  const fitScore = clamp(fit);
  const qualified = fitScore >= 40;
  return {
    prospect_id: input.prospectId,
    organization: input.organization.trim(),
    domain: input.domain.trim().toLowerCase(),
    vertical: WEIGHTS[strongest.kind].vertical,
    source: strongest.kind,
    source_url: strongest.source_url,
    evidence: input.evidence,
    fit_score: fitScore,
    intent_score: clamp(intent),
    urgency_score: clamp(urgency),
    confidence: clamp(input.evidence.length * 25),
    recommended_offer: qualified ? "dpp_readiness" : null,
    recommended_agent: input.recommendedAgent,
    contact_route: input.contact,
    status: qualified ? "QUALIFIED" : "DISCOVERED",
    disqualify_reasons: [],
    created_at: input.now,
    updated_at: input.now,
    discovered_by: input.discoveredBy,
  };
}

export async function executeDiscover(input: {
  message: SignedAgentMessage<DiscoverProspectPayload>;
  registry: AgentIdentityResolver;
  replay: AgentReplayStore;
  ledger: AcquisitionLedger;
  policy: OutboundPolicy;
  now?: Date;
}): Promise<{ ok: boolean; code: "RECORDED" | OutboundDenial; reasons: string[]; prospect?: Prospect }> {
  const now = input.now ?? new Date();
  const verified = await verifyAgentMessage(input.message, {
    resolver: input.registry,
    replayStore: input.replay,
    now,
  });
  if (!verified.valid) {
    const code: OutboundDenial = verified.reasons.includes("CAPABILITY_NOT_GRANTED")
      ? "CAPABILITY_MISSING"
      : verified.reasons.includes("MESSAGE_REPLAYED") || verified.reasons.includes("MESSAGE_ID_CONFLICT")
        ? "REPLAY"
        : "IDENTITY_INVALID";
    input.ledger.recordAudit({
      at: now.toISOString(),
      action: "DISCOVER_PROSPECT",
      code,
      reasons: verified.reasons,
      agent_id: input.message.agent_id,
      message_id: input.message.message_id,
    });
    return { ok: false, code, reasons: verified.reasons };
  }
  const required = ["DISCOVER_PROSPECT", "READ_EVIDENCE", "SCORE_PROSPECT"] as const;
  for (const cap of required) {
    if (!input.message.capabilities.includes(cap) || !input.policy.allowed_capabilities.includes(cap)) {
      input.ledger.recordAudit({
        at: now.toISOString(),
        action: "DISCOVER_PROSPECT",
        code: "CAPABILITY_MISSING",
        reasons: [cap],
        agent_id: input.message.agent_id,
        message_id: input.message.message_id,
      });
      return { ok: false, code: "CAPABILITY_MISSING", reasons: [cap] };
    }
  }
  if (input.message.intent !== "DISCOVER_PROSPECT" || input.message.payload?.action !== "DISCOVER_PROSPECT") {
    return { ok: false, code: "BINDING_MISMATCH", reasons: ["action_mismatch"] };
  }
  const payload = input.message.payload;
  if (!sameIdSet(input.message.evidence_ids, payload.evidence.map((item) => item.evidence_id))) {
    return { ok: false, code: "ATTRIBUTION_MISSING", reasons: ["evidence_mismatch"] };
  }
  const prospect = qualifyProspect({
    prospectId: payload.prospect_id,
    organization: payload.organization,
    domain: payload.domain,
    evidence: payload.evidence,
    contact: payload.contact,
    recommendedAgent: payload.recommended_agent,
    discoveredBy: input.message.agent_id,
    now: now.toISOString(),
  });
  input.ledger.prospects.set(prospect.prospect_id, prospect);
  input.ledger.recordFunnel({
    type: prospect.status === "QUALIFIED" ? "prospect_qualified" : prospect.status === "DISQUALIFIED" ? "prospect_disqualified" : "prospect_discovered",
    at: now.toISOString(),
    prospect_id: prospect.prospect_id,
    agent_id: input.message.agent_id,
    evidence_ids: prospect.evidence.map((item) => item.evidence_id),
    detail: prospect.disqualify_reasons.join(",") || prospect.source,
  });
  input.ledger.recordAudit({
    at: now.toISOString(),
    action: "DISCOVER_PROSPECT",
    code: "RECORDED",
    reasons: prospect.disqualify_reasons,
    agent_id: input.message.agent_id,
    attestation_id: input.message.attestation_id,
    message_id: input.message.message_id,
    prospect_id: prospect.prospect_id,
    capability: "DISCOVER_PROSPECT",
    policy_version: input.message.policy_version,
  });
  return { ok: true, code: "RECORDED", reasons: prospect.disqualify_reasons, prospect };
}

export async function executeCreateOpportunity(input: {
  message: SignedAgentMessage<CreateOpportunityPayload>;
  registry: AgentIdentityResolver;
  replay: AgentReplayStore;
  ledger: AcquisitionLedger;
  policy: OutboundPolicy;
  campaign: OutboundCampaign;
  now?: Date;
}): Promise<{ ok: boolean; code: "RECORDED" | OutboundDenial; reasons: string[] }> {
  const now = input.now ?? new Date();
  const verified = await verifyAgentMessage(input.message, {
    resolver: input.registry,
    replayStore: input.replay,
    now,
  });
  if (!verified.valid) {
    const code: OutboundDenial = verified.reasons.includes("CAPABILITY_NOT_GRANTED")
      ? "CAPABILITY_MISSING"
      : "IDENTITY_INVALID";
    input.ledger.recordAudit({
      at: now.toISOString(),
      action: "CREATE_OPPORTUNITY",
      code,
      reasons: verified.reasons,
      agent_id: input.message.agent_id,
      message_id: input.message.message_id,
    });
    return { ok: false, code, reasons: verified.reasons };
  }
  if (!input.message.capabilities.includes("CREATE_OPPORTUNITY") || !input.policy.allowed_capabilities.includes("CREATE_OPPORTUNITY")) {
    return { ok: false, code: "CAPABILITY_MISSING", reasons: ["CREATE_OPPORTUNITY"] };
  }
  const payload = input.message.payload;
  if (input.message.intent !== "CREATE_OPPORTUNITY" || payload?.action !== "CREATE_OPPORTUNITY") {
    return { ok: false, code: "BINDING_MISMATCH", reasons: ["action_mismatch"] };
  }
  const prospect = input.ledger.prospects.get(payload.prospect_id);
  if (!prospect) return { ok: false, code: "ATTRIBUTION_MISSING", reasons: ["prospect_not_found"] };
  if (prospect.status !== "QUALIFIED" || !prospect.recommended_offer) {
    return { ok: false, code: "POLICY_DENIED", reasons: ["prospect_not_qualified"] };
  }
  if (!sameIdSet(payload.evidence_ids, prospect.evidence.map((item) => item.evidence_id))) {
    return { ok: false, code: "BINDING_MISMATCH", reasons: ["evidence_mismatch"] };
  }
  if (payload.campaign_id !== input.campaign.campaign_id || payload.attribution !== input.campaign.attribution) {
    return { ok: false, code: "BINDING_MISMATCH", reasons: ["campaign_mismatch"] };
  }
  if (!isCommercialOutboundOffer(payload.offer_id) || !input.policy.public_offers.includes(payload.offer_id)) {
    return { ok: false, code: "OFFER_NOT_PUBLIC", reasons: ["offer_not_public"] };
  }
  if (payload.offer_id !== prospect.recommended_offer || payload.recommended_agent !== prospect.recommended_agent) {
    return { ok: false, code: "BINDING_MISMATCH", reasons: ["assignment_mismatch"] };
  }
  const contact = prospect.contact_route;
  const eligible = contact
    ? assessRecipient(contact.email, contact.source, { allowRoleInbox: input.campaign.allow_role_inbox }).status === "allow"
    : false;
  const at = now.toISOString();
  input.ledger.opportunities.set(payload.opportunity_id, {
    opportunity_id: payload.opportunity_id,
    prospect_id: prospect.prospect_id,
    evidence_ids: prospect.evidence.map((item) => item.evidence_id),
    fit_score: prospect.fit_score,
    vertical: prospect.vertical,
    offer_id: payload.offer_id as CommercialOutboundOffer,
    recommended_agent: payload.recommended_agent,
    policy_version: input.policy.policy_version,
    campaign_id: input.campaign.campaign_id,
    attribution: input.campaign.attribution,
    next_action: eligible ? "SEND_OUTBOUND" : "HOLD",
    status: eligible ? "OPEN" : "HOLD",
    created_by: input.message.agent_id,
    created_at: at,
    updated_at: at,
    payment: null,
  });
  input.ledger.recordFunnel({
    type: "opportunity_created",
    at,
    prospect_id: prospect.prospect_id,
    opportunity_id: payload.opportunity_id,
    agent_id: input.message.agent_id,
    campaign_id: input.campaign.campaign_id,
    offer_id: payload.offer_id,
    evidence_ids: prospect.evidence.map((item) => item.evidence_id),
    detail: eligible ? "next:SEND_OUTBOUND" : "next:HOLD",
  });
  input.ledger.recordAudit({
    at,
    action: "CREATE_OPPORTUNITY",
    code: "RECORDED",
    reasons: [],
    agent_id: input.message.agent_id,
    attestation_id: input.message.attestation_id,
    message_id: input.message.message_id,
    prospect_id: prospect.prospect_id,
    opportunity_id: payload.opportunity_id,
    campaign_id: input.campaign.campaign_id,
    capability: "CREATE_OPPORTUNITY",
    policy_version: input.policy.policy_version,
  });
  return { ok: true, code: "RECORDED", reasons: [] };
}

export interface InboundResult {
  ok: boolean;
  code: "RECORDED" | "UNKNOWN_CONVERSATION" | "MALFORMED_EVENT" | "OPTED_OUT" | "BOUNCED";
  status?: string;
  reasons: string[];
}

/**
 * Email replies are not agent-signed. Context is verified by conversation id.
 * `reply_verified` stays false: this path does not invent DKIM.
 */
export function applyInbound(
  ledger: AcquisitionLedger,
  event: {
    conversation_id: string;
    kind: "reply" | "opt_out" | "bounce" | "malformed" | "delivered" | "engaged";
    body?: string;
    at: string;
    transport_confirmed?: boolean;
  },
): InboundResult {
  if (event.kind === "malformed" || (event.kind === "engaged" && event.transport_confirmed !== true)) {
    return { ok: false, code: "MALFORMED_EVENT", reasons: ["malformed_event"] };
  }
  const conversation = ledger.conversations.get(event.conversation_id);
  if (!conversation) return { ok: false, code: "UNKNOWN_CONVERSATION", reasons: ["unknown_conversation"] };
  if (event.kind === "delivered") {
    ledger.setOpportunityStatus(conversation.opportunity_id, "DELIVERED", event.at);
    return { ok: true, code: "RECORDED", status: "DELIVERED", reasons: [] };
  }
  const body = event.body ?? "";
  const optOut = event.kind === "opt_out" || /\b(unsubscribe|opt-?out|stop)\b/i.test(body);
  if (optOut) {
    ledger.suppress(conversation.recipient, "opt_out", event.at);
    conversation.status = "OPTED_OUT";
    conversation.updated_at = event.at;
    ledger.setOpportunityStatus(conversation.opportunity_id, "OPTED_OUT", event.at);
    ledger.recordFunnel({
      type: "opted_out",
      at: event.at,
      prospect_id: conversation.prospect_id,
      opportunity_id: conversation.opportunity_id,
      agent_id: conversation.agent_id,
      campaign_id: conversation.campaign_id,
      detail: "suppression:recipient",
    });
    return { ok: true, code: "OPTED_OUT", status: "OPTED_OUT", reasons: ["opt_out"] };
  }
  if (event.kind === "bounce") {
    ledger.suppress(conversation.recipient, "bounce", event.at);
    conversation.status = "BOUNCED";
    conversation.updated_at = event.at;
    ledger.setOpportunityStatus(conversation.opportunity_id, "BOUNCED", event.at);
    ledger.recordFunnel({
      type: "bounced",
      at: event.at,
      prospect_id: conversation.prospect_id,
      opportunity_id: conversation.opportunity_id,
      agent_id: conversation.agent_id,
      campaign_id: conversation.campaign_id,
    });
    return { ok: true, code: "BOUNCED", status: "BOUNCED", reasons: ["bounce"] };
  }
  const notInterested = /\b(not interested|no thanks)\b/i.test(body);
  const interested = !notInterested && /\b(interested|yes|checkout)\b/i.test(body);
  const status = notInterested ? "NOT_INTERESTED" : interested ? "INTERESTED" : "REPLIED";
  conversation.status = status;
  conversation.updated_at = event.at;
  ledger.setOpportunityStatus(conversation.opportunity_id, status, event.at);
  ledger.recordFunnel({
    type: notInterested ? "inbound_not_interested" : interested ? "inbound_interested" : "inbound_replied",
    at: event.at,
    prospect_id: conversation.prospect_id,
    opportunity_id: conversation.opportunity_id,
    agent_id: conversation.agent_id,
    campaign_id: conversation.campaign_id,
    detail: "reply_verified:false,context_verified:true",
  });
  return { ok: true, code: "RECORDED", status, reasons: [] };
}

export function markUnresponsive(
  ledger: AcquisitionLedger,
  conversationId: string,
  at: string,
): InboundResult {
  const conversation = ledger.conversations.get(conversationId);
  if (!conversation) return { ok: false, code: "UNKNOWN_CONVERSATION", reasons: ["unknown_conversation"] };
  if (conversation.status !== "DELIVERED" && conversation.status !== "CONTACTED") {
    return { ok: false, code: "MALFORMED_EVENT", reasons: ["already_progressed"] };
  }
  const sent = ledger.sends.find((row) => row.message_id === conversation.message_id);
  if (!sent) return { ok: false, code: "MALFORMED_EVENT", reasons: ["send_missing"] };
  const elapsed = Date.parse(at) - Date.parse(sent.at);
  if (!Number.isFinite(elapsed) || elapsed < 7 * 24 * 60 * 60 * 1000) {
    return { ok: false, code: "MALFORMED_EVENT", reasons: ["horizon_not_reached"] };
  }
  conversation.status = "UNRESPONSIVE";
  conversation.updated_at = at;
  ledger.setOpportunityStatus(conversation.opportunity_id, "UNRESPONSIVE", at);
  ledger.recordFunnel({
    type: "unresponsive",
    at,
    prospect_id: conversation.prospect_id,
    opportunity_id: conversation.opportunity_id,
    agent_id: conversation.agent_id,
    campaign_id: conversation.campaign_id,
  });
  return { ok: true, code: "RECORDED", status: "UNRESPONSIVE", reasons: [] };
}

export interface CheckoutIntent {
  ok: boolean;
  code: "RECORDED" | "REFUSED";
  url?: string;
  reasons: string[];
}

/** Records the catalogue confirm URL. It does not open a Stripe session. */
export function recordCheckoutIntent(
  ledger: AcquisitionLedger,
  opportunityId: string,
  at: string,
): CheckoutIntent {
  const opportunity = ledger.opportunities.get(opportunityId);
  if (!opportunity) return { ok: false, code: "REFUSED", reasons: ["opportunity_not_found"] };
  if (
    opportunity.status === "OPTED_OUT"
    || opportunity.status === "BOUNCED"
    || opportunity.status === "NOT_INTERESTED"
    || opportunity.status === "PAID"
  ) {
    return { ok: false, code: "REFUSED", reasons: ["opportunity_closed"] };
  }
  const url = checkoutIntentUrl(opportunity.offer_id, opportunity.campaign_id);
  const recorded = ledger.recordFunnel({
    type: "checkout_started",
    at,
    prospect_id: opportunity.prospect_id,
    opportunity_id: opportunity.opportunity_id,
    agent_id: opportunity.recommended_agent,
    campaign_id: opportunity.campaign_id,
    offer_id: opportunity.offer_id,
    evidence_ids: opportunity.evidence_ids,
    detail: url,
  });
  if (recorded) ledger.setOpportunityStatus(opportunity.opportunity_id, "CHECKOUT_STARTED", at);
  return { ok: true, code: "RECORDED", url, reasons: recorded ? [] : ["duplicate_checkout_intent"] };
}

export interface PaymentObservation {
  accepted: boolean;
  code: "PAYMENT_OBSERVED" | "NOT_PROVIDER_PAYMENT" | "DUPLICATE";
  entitlement_granted: false;
  cash_recognized: false;
  reasons: string[];
}

/**
 * A fixture or an incomplete provider shape does not become PAID.
 * A complete provider shape records an observation only. This function never
 * grants an entitlement and never calls provisionPurchase.
 */
export function observePayment(
  ledger: AcquisitionLedger,
  input: {
    opportunity_id: string;
    source: "fixture" | "provider";
    livemode?: boolean;
    amount_cents?: number;
    session_id?: string;
    at: string;
  },
): PaymentObservation {
  const refused: PaymentObservation = {
    accepted: false,
    code: "NOT_PROVIDER_PAYMENT",
    entitlement_granted: false,
    cash_recognized: false,
    reasons: ["not_provider_payment"],
  };
  const opportunity = ledger.opportunities.get(input.opportunity_id);
  if (!opportunity) return { ...refused, reasons: ["opportunity_not_found"] };
  const providerShaped = input.source === "provider"
    && input.livemode === true
    && typeof input.amount_cents === "number"
    && input.amount_cents > 0
    && typeof input.session_id === "string"
    && input.session_id.startsWith("cs_");
  if (!providerShaped) {
    ledger.recordFunnel({
      type: "payment_refused",
      at: input.at,
      opportunity_id: input.opportunity_id,
      prospect_id: opportunity.prospect_id,
      campaign_id: opportunity.campaign_id,
      agent_id: opportunity.recommended_agent,
      detail: "entitlement_granted:false",
    });
    return refused;
  }
  const recorded = ledger.recordFunnel({
    type: "payment_observed",
    at: input.at,
    opportunity_id: input.opportunity_id,
    prospect_id: opportunity.prospect_id,
    campaign_id: opportunity.campaign_id,
    offer_id: opportunity.offer_id,
    agent_id: opportunity.recommended_agent,
    session_id: input.session_id,
    detail: "entitlement_granted:false,cash_recognized:false",
  });
  if (!recorded) {
    return {
      accepted: false,
      code: "DUPLICATE",
      entitlement_granted: false,
      cash_recognized: false,
      reasons: ["duplicate_payment_observation"],
    };
  }
  opportunity.payment = {
    livemode: true,
    amount_cents: input.amount_cents!,
    session_id: input.session_id!,
    entitlement_granted: false,
    cash_recognized: false,
  };
  opportunity.status = "PAID";
  opportunity.updated_at = input.at;
  return {
    accepted: true,
    code: "PAYMENT_OBSERVED",
    entitlement_granted: false,
    cash_recognized: false,
    reasons: [],
  };
}

/** Provisioning, activation, retention, and expansion stay on the Stripe webhook path. */
export function advanceToFulfillment(
  _status: "PROVISIONED" | "ACTIVATED" | "RETAINED" | "EXPANDED" | "FIRST_VALUE",
): { ok: false; code: "ENTITLEMENT_NOT_GRANTED" } {
  return { ok: false, code: "ENTITLEMENT_NOT_GRANTED" };
}
