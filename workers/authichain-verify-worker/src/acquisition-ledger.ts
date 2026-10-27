import type {
  Opportunity,
  OpportunityStatus,
  OutboundDenial,
  Prospect,
} from "./outbound-types";

export interface AuditRow {
  at: string;
  action: string;
  code: "ALLOW" | OutboundDenial | "RECORDED" | "REFUSED";
  reasons: string[];
  agent_id?: string;
  organization_id?: string;
  attestation_id?: string;
  message_id?: string;
  message_digest?: string;
  prospect_id?: string;
  opportunity_id?: string;
  campaign_id?: string;
  capability?: string;
  policy_version?: string;
  recipient?: string;
}

export interface SendRow {
  at: string;
  message_id: string;
  agent_id: string;
  campaign_id: string;
  prospect_id: string;
  opportunity_id: string;
  recipient: string;
  content_hash: string;
}

export interface Conversation {
  conversation_id: string;
  message_id: string;
  prospect_id: string;
  opportunity_id: string;
  agent_id: string;
  campaign_id: string;
  recipient: string;
  status: OpportunityStatus;
  reply_verified: false;
  context_verified: boolean;
  updated_at: string;
}

export interface FunnelEvent {
  type: string;
  at: string;
  prospect_id?: string;
  opportunity_id?: string;
  agent_id?: string;
  campaign_id?: string;
  offer_id?: string;
  evidence_ids?: string[];
  message_id?: string;
  session_id?: string;
  detail?: string;
}

export interface DraftRecord {
  opportunity_id: string;
  content_hash: string;
  body: string;
  agent_id: string;
  at: string;
}

const FURTHER: ReadonlySet<OpportunityStatus> = new Set([
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "OPTED_OUT",
  "BOUNCED",
  "UNRESPONSIVE",
  "CHECKOUT_STARTED",
  "PAID",
  "LOST",
]);

/**
 * Tested store for outbound audit, suppression, and funnel events.
 * The D1 shape in schema/agent-outbound.sql is not applied remotely.
 */
export class AcquisitionLedger {
  readonly audits: AuditRow[] = [];
  readonly prospects = new Map<string, Prospect>();
  readonly opportunities = new Map<string, Opportunity>();
  readonly drafts = new Map<string, DraftRecord>();
  readonly sends: SendRow[] = [];
  readonly conversations = new Map<string, Conversation>();
  readonly funnel: FunnelEvent[] = [];
  private readonly suppressed = new Map<string, { reason: string; at: string }>();
  globalSuppression = false;
  emergencyStop = false;

  suppress(email: string, reason: string, at: string): void {
    this.suppressed.set(normalizeEmail(email), { reason, at });
  }

  isSuppressed(email: string): boolean {
    return this.globalSuppression || this.suppressed.has(normalizeEmail(email));
  }

  suppressionReason(email: string): string | null {
    if (this.globalSuppression) return "global_suppression";
    return this.suppressed.get(normalizeEmail(email))?.reason ?? null;
  }

  engageKillSwitch(at: string): void {
    this.emergencyStop = true;
    this.recordFunnel({ type: "kill_switch_engaged", at, detail: "emergency_stop" });
  }

  recordAudit(row: AuditRow): void {
    this.audits.push(row);
  }

  recordFunnel(event: FunnelEvent): boolean {
    const key = [
      event.type,
      event.opportunity_id ?? "",
      event.prospect_id ?? "",
      event.message_id ?? "",
      event.session_id ?? "",
    ].join("|");
    const exists = this.funnel.some((row) =>
      [
        row.type,
        row.opportunity_id ?? "",
        row.prospect_id ?? "",
        row.message_id ?? "",
        row.session_id ?? "",
      ].join("|") === key,
    );
    if (exists) return false;
    this.funnel.push(event);
    return true;
  }

  recordSend(row: SendRow): void {
    this.sends.push(row);
  }

  sendsForAgent(agentId: string): number {
    return this.sends.filter((row) => row.agent_id === agentId).length;
  }

  sendsForCampaign(campaignId: string): number {
    return this.sends.filter((row) => row.campaign_id === campaignId).length;
  }

  sendsForRecipient(recipient: string): SendRow[] {
    const email = normalizeEmail(recipient);
    return this.sends.filter((row) => row.recipient === email);
  }

  duplicateContact(campaignId: string, recipient: string): boolean {
    const email = normalizeEmail(recipient);
    return this.sends.some((row) => row.campaign_id === campaignId && row.recipient === email);
  }

  setOpportunityStatus(opportunityId: string, status: OpportunityStatus, at: string): void {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) return;
    if (status === "DELIVERED" && FURTHER.has(opportunity.status)) return;
    if (status === "CONTACTED" && opportunity.status !== "OPEN" && opportunity.status !== "HOLD") return;
    opportunity.status = status;
    opportunity.updated_at = at;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AcquisitionReport {
  prospects_discovered: number;
  prospects_qualified: number;
  evidence_ids: string[];
  authorized: number;
  denied: number;
  denied_by_code: Record<string, number>;
  replies: number;
  interested: number;
  not_interested: number;
  opted_out: number;
  bounced: number;
  lost: number;
  opportunities: number;
  checkout_started: number;
  paid_observations: number;
  entitlements_granted: number;
  provisioned: number;
  activated: number;
  first_value: number;
  retained: number;
  expanded: number;
  external_deliveries: number;
  test_captures: number;
  unresponsive: number;
  by_agent: Record<string, { authorized: number; interested: number }>;
  by_campaign: Record<string, { authorized: number; checkout_started: number }>;
}

/** Counts only ledger events. It does not infer revenue or engagement. */
export function acquisitionReport(ledger: AcquisitionLedger): AcquisitionReport {
  const deniedByCode: Record<string, number> = {};
  let authorized = 0;
  let denied = 0;
  for (const row of ledger.audits) {
    if (row.action !== "SEND_OUTBOUND") continue;
    if (row.code === "ALLOW") authorized += 1;
    else {
      denied += 1;
      deniedByCode[row.code] = (deniedByCode[row.code] ?? 0) + 1;
    }
  }
  const evidence = new Set<string>();
  let qualified = 0;
  for (const prospect of ledger.prospects.values()) {
    if (prospect.status === "QUALIFIED") qualified += 1;
    for (const item of prospect.evidence) evidence.add(item.evidence_id);
  }
  const count = (type: string) => ledger.funnel.filter((event) => event.type === type).length;
  const interested = count("inbound_interested");
  const notInterested = count("inbound_not_interested");
  const byAgent: AcquisitionReport["by_agent"] = {};
  for (const row of ledger.audits) {
    if (row.action !== "SEND_OUTBOUND" || row.code !== "ALLOW" || !row.agent_id) continue;
    const bucket = byAgent[row.agent_id] ?? { authorized: 0, interested: 0 };
    bucket.authorized += 1;
    byAgent[row.agent_id] = bucket;
  }
  for (const event of ledger.funnel) {
    if (event.type !== "inbound_interested" || !event.agent_id) continue;
    const bucket = byAgent[event.agent_id] ?? { authorized: 0, interested: 0 };
    bucket.interested += 1;
    byAgent[event.agent_id] = bucket;
  }
  const byCampaign: AcquisitionReport["by_campaign"] = {};
  for (const row of ledger.sends) {
    const bucket = byCampaign[row.campaign_id] ?? { authorized: 0, checkout_started: 0 };
    bucket.authorized += 1;
    byCampaign[row.campaign_id] = bucket;
  }
  for (const event of ledger.funnel) {
    if (event.type !== "checkout_started" || !event.campaign_id) continue;
    const bucket = byCampaign[event.campaign_id] ?? { authorized: 0, checkout_started: 0 };
    bucket.checkout_started += 1;
    byCampaign[event.campaign_id] = bucket;
  }
  return {
    prospects_discovered: ledger.prospects.size,
    prospects_qualified: qualified,
    evidence_ids: [...evidence].sort(),
    authorized,
    denied,
    denied_by_code: deniedByCode,
    replies: count("inbound_replied") + interested + notInterested,
    interested,
    not_interested: notInterested,
    opted_out: count("opted_out"),
    bounced: count("bounced"),
    lost: notInterested,
    opportunities: ledger.opportunities.size,
    checkout_started: count("checkout_started"),
    paid_observations: count("payment_observed"),
    entitlements_granted: 0,
    provisioned: 0,
    activated: 0,
    first_value: 0,
    retained: 0,
    expanded: 0,
    external_deliveries: count("external_delivery"),
    test_captures: count("test_transport_captured"),
    unresponsive: count("unresponsive"),
    by_agent: byAgent,
    by_campaign: byCampaign,
  };
}
