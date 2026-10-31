import type { AgentCapability, AgentVerificationFailureReason } from "./agent-types";
import type { VerificationSource } from "../../../server/outreach/recipient-rules";

/** Policy version for this outbound gate. Attestations must carry the same string. */
export const OUTBOUND_POLICY_VERSION = "outbound-2026.10";

/**
 * Purchase offers an outbound campaign may name. This list is a subset of
 * PUBLIC_PLAN_IDS and excludes `free`. Farm and Theater are not here.
 * The test locks the subset. Do not add a private plan.
 */
export const COMMERCIAL_OUTBOUND_OFFERS = [
  "qron_launch",
  "starter",
  "creator",
  "dpp_readiness",
  "strainchain_passport",
  "musa_claim_file",
  "musa_audit_bundle",
] as const;

export type CommercialOutboundOffer = (typeof COMMERCIAL_OUTBOUND_OFFERS)[number];

export function isCommercialOutboundOffer(id: string): id is CommercialOutboundOffer {
  return (COMMERCIAL_OUTBOUND_OFFERS as readonly string[]).includes(id);
}

export const OUTBOUND_DENIALS = [
  "IDENTITY_INVALID",
  "CAPABILITY_MISSING",
  "POLICY_DENIED",
  "RECIPIENT_INELIGIBLE",
  "CAMPAIGN_UNAUTHORIZED",
  "OFFER_NOT_PUBLIC",
  "SUPPRESSED",
  "RATE_LIMIT",
  "DUPLICATE_CONTACT",
  "KILL_SWITCH",
  "PRODUCTION_SEND_DISABLED",
  "REPLAY",
  "ATTRIBUTION_MISSING",
  "BINDING_MISMATCH",
  "TRANSPORT_REFUSED",
] as const;

export type OutboundDenial = (typeof OUTBOUND_DENIALS)[number];

export type OutboundTransportKind = "test" | "email";

export interface OutboundPolicy {
  policy_version: string;
  /** Live email stays off until a human sets this and a sender is configured. */
  production_send: boolean;
  kill_switch: boolean;
  /** Capabilities this policy version still permits. Identity grants are not enough. */
  allowed_capabilities: AgentCapability[];
  public_offers: CommercialOutboundOffer[];
  max_sends_per_agent: number;
  max_sends_per_campaign: number;
  max_sends_per_recipient: number;
  cooldown_ms: number;
}

export function defaultOutboundPolicy(): OutboundPolicy {
  return {
    policy_version: OUTBOUND_POLICY_VERSION,
    production_send: false,
    kill_switch: false,
    allowed_capabilities: [
      "DISCOVER_PROSPECT",
      "READ_EVIDENCE",
      "SCORE_PROSPECT",
      "CREATE_OPPORTUNITY",
      "DRAFT_OUTBOUND",
      "SEND_OUTBOUND",
      "READ_INBOUND",
      "MANAGE_CONVERSATION",
      "PROPOSE_OFFER",
      "VERIFY_ATTESTATION",
      "CREATE_AUDIT_RECORD",
    ],
    public_offers: ["dpp_readiness"],
    max_sends_per_agent: 5,
    max_sends_per_campaign: 20,
    max_sends_per_recipient: 1,
    cooldown_ms: 7 * 24 * 60 * 60 * 1000,
  };
}

export interface OutboundCampaign {
  campaign_id: string;
  offer_id: CommercialOutboundOffer;
  policy_version: string;
  authorized: boolean;
  /** Required only for the email transport. Test transport does not send. */
  human_send_approved: boolean;
  paused: boolean;
  allow_role_inbox: boolean;
  attribution: string;
}

export function defaultOutboundCampaign(): OutboundCampaign {
  return {
    campaign_id: "camp:dpp-readiness-2026-10",
    offer_id: "dpp_readiness",
    policy_version: OUTBOUND_POLICY_VERSION,
    authorized: true,
    human_send_approved: false,
    paused: false,
    allow_role_inbox: false,
    attribution: "scout:public-evidence",
  };
}

export type EvidenceKind =
  | "dpp_requirement"
  | "battery_passport"
  | "procurement"
  | "authenticity"
  | "provenance"
  | "product_launch"
  | "partnership"
  | "regulatory_change"
  | "supply_chain"
  | "pharma_traceability"
  | "public_vendor_request";

export interface PublicEvidence {
  evidence_id: string;
  kind: EvidenceKind;
  source_url: string;
  summary: string;
  observed_at: string;
}

export interface ProspectContact {
  email: string;
  source: VerificationSource;
}

export interface Prospect {
  prospect_id: string;
  organization: string;
  domain: string;
  vertical: string;
  source: EvidenceKind | "none";
  source_url: string;
  evidence: PublicEvidence[];
  fit_score: number;
  intent_score: number;
  urgency_score: number;
  confidence: number;
  recommended_offer: CommercialOutboundOffer | null;
  recommended_agent: string;
  contact_route: ProspectContact | null;
  status: "DISCOVERED" | "QUALIFIED" | "DISQUALIFIED";
  disqualify_reasons: string[];
  created_at: string;
  updated_at: string;
  discovered_by: string;
}

export type OpportunityStatus =
  | "OPEN"
  | "HOLD"
  | "CONTACTED"
  | "DELIVERED"
  | "REPLIED"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "OPTED_OUT"
  | "BOUNCED"
  | "UNRESPONSIVE"
  | "CHECKOUT_STARTED"
  | "PAID"
  | "LOST";

export interface Opportunity {
  opportunity_id: string;
  prospect_id: string;
  evidence_ids: string[];
  fit_score: number;
  vertical: string;
  offer_id: CommercialOutboundOffer;
  recommended_agent: string;
  policy_version: string;
  campaign_id: string;
  attribution: string;
  next_action: "SEND_OUTBOUND" | "HOLD";
  status: OpportunityStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  payment: {
    livemode: boolean;
    amount_cents: number;
    session_id: string;
    entitlement_granted: false;
    cash_recognized: false;
  } | null;
}

export interface DiscoverProspectPayload {
  action: "DISCOVER_PROSPECT";
  prospect_id: string;
  organization: string;
  domain: string;
  evidence: PublicEvidence[];
  contact: ProspectContact | null;
  recommended_agent: string;
}

export interface CreateOpportunityPayload {
  action: "CREATE_OPPORTUNITY";
  prospect_id: string;
  opportunity_id: string;
  campaign_id: string;
  offer_id: string;
  recommended_agent: string;
  evidence_ids: string[];
  attribution: string;
}

export interface DraftOutboundPayload {
  action: "DRAFT_OUTBOUND";
  prospect_id: string;
  opportunity_id: string;
  campaign_id: string;
  content_hash: string;
  body: string;
}

export interface OutboundActionPayload {
  action: "SEND_OUTBOUND";
  prospect_id: string;
  opportunity_id: string;
  campaign_id: string;
  attribution: string;
  recipient: string;
  recipient_source: VerificationSource;
  content_hash: string;
  body: string;
}

export interface OutboundDecision {
  allow: boolean;
  code: "ALLOW" | OutboundDenial;
  reasons: string[];
  transport: OutboundTransportKind;
  production_send: boolean;
  human_send_approved: boolean;
  agent_id?: string;
  organization_id?: string;
  attestation_id?: string;
  message_id?: string;
  message_digest?: string;
  prospect_id?: string;
  opportunity_id?: string;
  campaign_id?: string;
  capability?: AgentCapability;
  policy_version?: string;
  verifier_reasons?: AgentVerificationFailureReason[];
}

export interface OutboundEnvelope {
  message_id: string;
  agent_id: string;
  organization_id: string;
  prospect_id: string;
  opportunity_id: string;
  campaign_id: string;
  action: "SEND_OUTBOUND";
  timestamp: string;
  policy_version: string;
  capability: "SEND_OUTBOUND";
  attribution: string;
  content_hash: string;
  signature: string;
  evidence_ids: string[];
}

export const HUMAN_AUTHORIZATION_BOUNDARIES = [
  "real_financial_charge",
  "contract",
  "legal_commitment",
  "refund",
  "purchase",
  "irreversible_destructive_action",
  "sensitive_personal_targeting",
  "production_email_without_human_send_approval",
] as const;

export function messageWindow(now: Date): { issued_at: string; expires_at: string } {
  return {
    issued_at: new Date(now.getTime() - 60_000).toISOString(),
    expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
  };
}

export function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((id, index) => id === b[index]);
}
