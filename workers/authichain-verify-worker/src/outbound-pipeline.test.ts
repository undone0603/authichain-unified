import { describe, expect, it } from "vitest";
import { PUBLIC_PLAN_IDS } from "../../../src/lib/plans";
import { publicCheckoutHref } from "../../../src/lib/billing/live-catalog";
import {
  AGENTZ_SALES_CAPABILITIES,
  GUARDIAN_CAPABILITIES,
  SCOUT_CAPABILITIES,
} from "./agent-types";
import { MemoryAgentReplayStore } from "./agent-store";
import { createAgentPassport } from "./agent-verifier";
import {
  generateP256,
  issueAgentIdentity,
  MemoryAgentRegistry,
  signAgentMessage,
  type IssuedAgentIdentity,
} from "./agent-issuer";
import { AcquisitionLedger, acquisitionReport } from "./acquisition-ledger";
import {
  authorizeOutbound,
  buildOutboundBody,
  checkoutIntentUrl,
  contentHash,
  decisionIsGated,
  DPP_OFFER_LINE,
  EmailTransport,
  performOutbound,
  TestOutboundTransport,
  authorizeDraft,
} from "./outbound-gate";
import {
  advanceToFulfillment,
  applyInbound,
  executeCreateOpportunity,
  executeDiscover,
  markUnresponsive,
  observePayment,
  qualifyProspect,
  recordCheckoutIntent,
} from "./scout";
import { runAgentZDogfood } from "./agent-dogfood";
import {
  COMMERCIAL_OUTBOUND_OFFERS,
  defaultOutboundCampaign,
  defaultOutboundPolicy,
  isCommercialOutboundOffer,
  messageWindow,
  OUTBOUND_POLICY_VERSION,
  type OutboundActionPayload,
  type OutboundCampaign,
  type OutboundPolicy,
} from "./outbound-types";
import type { SignedAgentMessage } from "./agent-message";

const NOW = new Date("2026-10-08T19:00:00.000Z");
const ORG = "org:authichain:core";
const ISSUER = "issuer:authichain:root";
const SCOUT_ID = "agent:authichain:scout-01";
const AGENTZ_ID = "agent:authichain:agentz-sales-01";
const EVIDENCE_ID = "evi:example-test:dpp-notice";
const PROSPECT_ID = "prospect:example.test:dpp-notice";
const OPPORTUNITY_ID = "opp:example.test:dpp-notice";

const EVIDENCE = {
  evidence_id: EVIDENCE_ID,
  kind: "dpp_requirement" as const,
  source_url: "https://example.test/notices/dpp-readiness",
  summary: "Example Battery Works published a DPP readiness notice for its battery line.",
  observed_at: "2026-10-01T00:00:00.000Z",
};

async function issue(
  registry: MemoryAgentRegistry,
  issuerKey: CryptoKey,
  agentId: string,
  role: string,
  capabilities: readonly string[],
  attestationId: string,
  window?: { issuedAt?: string; effectiveAt?: string; expiresAt?: string },
): Promise<IssuedAgentIdentity> {
  const issued = await issueAgentIdentity({
    agentId,
    organizationId: ORG,
    role,
    version: "1.0.0",
    capabilities,
    policyVersion: OUTBOUND_POLICY_VERSION,
    issuerId: ISSUER,
    attestationId,
    issuedAt: window?.issuedAt ?? "2026-10-08T18:00:00.000Z",
    effectiveAt: window?.effectiveAt ?? "2026-10-08T18:00:00.000Z",
    expiresAt: window?.expiresAt ?? "2026-10-09T19:00:00.000Z",
    issuerPrivateKey: issuerKey,
    now: NOW,
  });
  registry.put(issued.attestation);
  return issued;
}

async function signed<T>(
  issued: IssuedAgentIdentity,
  messageId: string,
  intent: string,
  capabilities: IssuedAgentIdentity["attestation"]["capabilities"],
  evidenceIds: string[],
  payload: T,
): Promise<SignedAgentMessage<T>> {
  return signAgentMessage({
    protocol: "authichain-agent/1",
    message_id: messageId,
    agent_id: issued.attestation.agent_id,
    organization_id: issued.attestation.organization_id,
    attestation_id: issued.attestation.attestation_id,
    role: issued.attestation.role,
    version: issued.attestation.version,
    capabilities,
    policy_version: issued.attestation.policy_version,
    ...messageWindow(NOW),
    intent,
    evidence_ids: evidenceIds,
    payload,
  }, issued.privateKey);
}

async function prepared() {
  const issuer = await generateP256();
  const registry = new MemoryAgentRegistry();
  registry.registerIssuer(ISSUER, issuer.publicKeyJwk);
  const scout = await issue(registry, issuer.privateKey, SCOUT_ID, "scout", SCOUT_CAPABILITIES, "att:scout");
  const agentz = await issue(registry, issuer.privateKey, AGENTZ_ID, "sales", AGENTZ_SALES_CAPABILITIES, "att:agentz");
  const ledger = new AcquisitionLedger();
  const replay = new MemoryAgentReplayStore();
  const policy = defaultOutboundPolicy();
  const campaign = defaultOutboundCampaign();
  const discover = await signed(scout, "msg:discover", "DISCOVER_PROSPECT", ["DISCOVER_PROSPECT", "READ_EVIDENCE", "SCORE_PROSPECT"], [EVIDENCE_ID], {
    action: "DISCOVER_PROSPECT" as const,
    prospect_id: PROSPECT_ID,
    organization: "Example Battery Works",
    domain: "example.test",
    evidence: [EVIDENCE],
    contact: { email: "standards@example.test", source: "published_contact" as const },
    recommended_agent: AGENTZ_ID,
  });
  const discovered = await executeDiscover({ message: discover, registry, replay, ledger, policy, now: NOW });
  const assign = await signed(scout, "msg:assign", "CREATE_OPPORTUNITY", ["CREATE_OPPORTUNITY"], [EVIDENCE_ID], {
    action: "CREATE_OPPORTUNITY" as const,
    prospect_id: PROSPECT_ID,
    opportunity_id: OPPORTUNITY_ID,
    campaign_id: campaign.campaign_id,
    offer_id: "dpp_readiness",
    recommended_agent: AGENTZ_ID,
    evidence_ids: [EVIDENCE_ID],
    attribution: campaign.attribution,
  });
  const assigned = await executeCreateOpportunity({ message: assign, registry, replay, ledger, policy, campaign, now: NOW });
  const body = buildOutboundBody({
    agentId: agentz.attestation.agent_id,
    organizationId: agentz.attestation.organization_id,
    role: agentz.attestation.role,
    attestationId: agentz.attestation.attestation_id,
    offerLine: DPP_OFFER_LINE,
    checkoutUrl: checkoutIntentUrl(campaign.offer_id, campaign.campaign_id),
  });
  const hash = await contentHash(body);
  const draft = await signed(agentz, "msg:draft", "DRAFT_OUTBOUND", ["DRAFT_OUTBOUND"], [EVIDENCE_ID], {
    action: "DRAFT_OUTBOUND" as const,
    prospect_id: PROSPECT_ID,
    opportunity_id: OPPORTUNITY_ID,
    campaign_id: campaign.campaign_id,
    content_hash: hash,
    body,
  });
  const drafted = await authorizeDraft({ message: draft, registry, replay, ledger, policy, now: NOW });
  async function sendMessage(messageId: string, patch: Partial<OutboundActionPayload> = {}) {
    const payload: OutboundActionPayload = {
      action: "SEND_OUTBOUND",
      prospect_id: PROSPECT_ID,
      opportunity_id: OPPORTUNITY_ID,
      campaign_id: campaign.campaign_id,
      attribution: campaign.attribution,
      recipient: "standards@example.test",
      recipient_source: "published_contact",
      content_hash: hash,
      body,
      ...patch,
    };
    return signed(agentz, messageId, "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], payload);
  }
  return {
    issuer, registry, scout, agentz, ledger, replay, policy, campaign, discovered, assigned, drafted, body, hash, sendMessage,
  };
}

function gate(ctx: Awaited<ReturnType<typeof prepared>>, message: SignedAgentMessage<OutboundActionPayload>, patch?: {
  policy?: OutboundPolicy;
  campaign?: OutboundCampaign | null;
  transport?: "test" | "email";
}) {
  return authorizeOutbound({
    message,
    registry: ctx.registry,
    replay: ctx.replay,
    ledger: ctx.ledger,
    policy: patch?.policy ?? ctx.policy,
    campaign: patch && "campaign" in patch ? patch.campaign! : ctx.campaign,
    transport: patch?.transport ?? "test",
    now: NOW,
  });
}

describe("verifiable outbound", () => {
  it("keeps commercial offers inside the public catalogue", () => {
    for (const id of COMMERCIAL_OUTBOUND_OFFERS) expect(PUBLIC_PLAN_IDS).toContain(id);
    expect(COMMERCIAL_OUTBOUND_OFFERS).not.toContain("free");
    expect(isCommercialOutboundOffer("strainchain_farm")).toBe(false);
    expect(isCommercialOutboundOffer("theater_1")).toBe(false);
    expect(isCommercialOutboundOffer("studio")).toBe(false);
  });

  it("issues a passport and does not treat a bare name as identity", async () => {
    const issuer = await generateP256();
    const registry = new MemoryAgentRegistry();
    registry.registerIssuer(ISSUER, issuer.publicKeyJwk);
    const agent = await issue(registry, issuer.privateKey, AGENTZ_ID, "sales", AGENTZ_SALES_CAPABILITIES, "att:agentz");
    expect(agent.passport.status).toBe("ACTIVE");
    expect(agent.attestation.public_key).toContain("P-256");
    expect(agent.attestation.signature.length).toBeGreaterThan(20);
    expect("privateKey" in agent.attestation).toBe(false);
    expect(createAgentPassport(agent.attestation, true, NOW).status).toBe("REVOKED");
    await expect(issueAgentIdentity({
      agentId: "agent:empty",
      organizationId: ORG,
      role: "sales",
      version: "1.0.0",
      capabilities: [],
      policyVersion: OUTBOUND_POLICY_VERSION,
      issuerId: ISSUER,
      attestationId: "att:empty",
      issuedAt: "2026-10-08T18:00:00.000Z",
      effectiveAt: "2026-10-08T18:00:00.000Z",
      issuerPrivateKey: issuer.privateKey,
    })).rejects.toThrow(/capability/i);
    const unnamed = await gate(await prepared(), {
      protocol: "authichain-agent/1",
      message_id: "msg:name-only",
      agent_id: "AgentZ",
      organization_id: ORG,
      attestation_id: "att:missing",
      role: "sales",
      version: "1.0.0",
      capabilities: ["SEND_OUTBOUND"],
      policy_version: OUTBOUND_POLICY_VERSION,
      issued_at: "2026-10-08T18:59:00.000Z",
      expires_at: "2026-10-08T19:10:00.000Z",
      intent: "SEND_OUTBOUND",
      evidence_ids: [EVIDENCE_ID],
      payload: {
        action: "SEND_OUTBOUND",
        prospect_id: PROSPECT_ID,
        opportunity_id: OPPORTUNITY_ID,
        campaign_id: "camp:dpp-readiness-2026-10",
        attribution: "scout:public-evidence",
        recipient: "standards@example.test",
        recipient_source: "published_contact",
        content_hash: "none",
        body: "none",
      },
      signature: "AAAA",
    });
    expect(unnamed.allow).toBe(false);
    expect(unnamed.code).toBe("IDENTITY_INVALID");
    expect(unnamed.reasons).toContain("AGENT_NOT_FOUND");
  });

  it("denies a send that has not passed the gate, including a forged allow", async () => {
    const transport = new TestOutboundTransport();
    const email = new EmailTransport(async () => {
      throw new Error("sender must not be called");
    });
    const forged = {
      allow: true,
      code: "ALLOW" as const,
      reasons: [],
      transport: "test" as const,
      production_send: true,
      human_send_approved: true,
    };
    expect(decisionIsGated(forged)).toBe(false);
    const message = { agent_id: "AgentZ", signature: "nope", payload: { recipient: "a@b.test", body: "x", campaign_id: "c", prospect_id: "p" } } as SignedAgentMessage<OutboundActionPayload>;
    expect(transport.deliver(forged, message).code).toBe("TRANSPORT_REFUSED");
    expect(transport.captured).toHaveLength(0);
    await expect(email.deliver({ ...forged, transport: "email" }, message)).resolves.toMatchObject({ code: "TRANSPORT_REFUSED" });
  });

  it("prepares a qualified opportunity and allows one test send", async () => {
    const ctx = await prepared();
    expect(ctx.discovered.prospect?.status).toBe("QUALIFIED");
    expect(ctx.discovered.prospect?.fit_score).toBeGreaterThanOrEqual(40);
    expect(ctx.discovered.prospect?.source_url).toBe(EVIDENCE.source_url);
    expect(ctx.assigned.ok).toBe(true);
    expect(ctx.ledger.opportunities.get(OPPORTUNITY_ID)?.next_action).toBe("SEND_OUTBOUND");
    expect(ctx.drafted.ok).toBe(true);
    const message = await ctx.sendMessage("msg:send-1");
    const testTransport = new TestOutboundTransport();
    const sent = await performOutbound({
      message, registry: ctx.registry, replay: ctx.replay, ledger: ctx.ledger,
      policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW, testTransport,
    });
    expect(sent.decision.code).toBe("ALLOW");
    expect(sent.decision.capability).toBe("SEND_OUTBOUND");
    expect(sent.result.external).toBe(false);
    expect(testTransport.captured[0]?.recipient).toBe("standards@example.test");
    expect(testTransport.captured[0]?.signature).toBe(message.signature);
    expect(testTransport.captured[0]?.authorization.code).toBe("ALLOW");
    expect(ctx.ledger.conversations.get("conv:msg:send-1")?.reply_verified).toBe(false);
  });

  it("denies identity failures with machine-readable codes", async () => {
    const ctx = await prepared();
    const expiredIssuer = await generateP256();
    const expiredRegistry = new MemoryAgentRegistry();
    expiredRegistry.registerIssuer(ISSUER, expiredIssuer.publicKeyJwk);
    const expired = await issue(expiredRegistry, expiredIssuer.privateKey, AGENTZ_ID, "sales", AGENTZ_SALES_CAPABILITIES, "att:expired", {
      issuedAt: "2026-10-08T12:00:00.000Z",
      effectiveAt: "2026-10-08T12:00:00.000Z",
      expiresAt: "2026-10-08T13:00:00.000Z",
    });
    const future = await issue(expiredRegistry, expiredIssuer.privateKey, "agent:authichain:future", "sales", AGENTZ_SALES_CAPABILITIES, "att:future", {
      effectiveAt: "2026-10-08T19:05:00.000Z",
      expiresAt: "2026-10-09T19:00:00.000Z",
    });
    const expiredMessage = await signed(expired, "msg:expired", "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], {
      action: "SEND_OUTBOUND" as const, prospect_id: PROSPECT_ID, opportunity_id: OPPORTUNITY_ID,
      campaign_id: ctx.campaign.campaign_id, attribution: ctx.campaign.attribution,
      recipient: "standards@example.test", recipient_source: "published_contact" as const,
      content_hash: ctx.hash, body: ctx.body,
    });
    const expiredDecision = await authorizeOutbound({
      message: expiredMessage, registry: expiredRegistry, replay: new MemoryAgentReplayStore(),
      ledger: ctx.ledger, policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
    });
    expect(expiredDecision.code).toBe("IDENTITY_INVALID");
    expect(expiredDecision.reasons).toContain("ATTESTATION_EXPIRED");
    const futureMessage = await signed(future, "msg:future", "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], expiredMessage.payload);
    const futureDecision = await authorizeOutbound({
      message: futureMessage, registry: expiredRegistry, replay: new MemoryAgentReplayStore(),
      ledger: new AcquisitionLedger(), policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
    });
    expect(futureDecision.reasons).toContain("ATTESTATION_NOT_YET_EFFECTIVE");

    ctx.registry.revoke(ctx.agentz.attestation.attestation_id);
    const revoked = await gate(ctx, await ctx.sendMessage("msg:revoked"));
    expect(revoked.code).toBe("IDENTITY_INVALID");
    expect(revoked.reasons).toContain("ATTESTATION_REVOKED");
  });

  it("denies a revoked issuer, an unknown issuer, and a bad signature", async () => {
    const ctx = await prepared();
    const unknown = new MemoryAgentRegistry();
    unknown.put(ctx.agentz.attestation);
    const unknownDecision = await authorizeOutbound({
      message: await ctx.sendMessage("msg:unknown-issuer"),
      registry: unknown, replay: new MemoryAgentReplayStore(), ledger: new AcquisitionLedger(),
      policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
    });
    expect(unknownDecision.reasons).toContain("ISSUER_NOT_FOUND");
    ctx.registry.revokeIssuer(ISSUER);
    const issuerRevoked = await gate(ctx, await ctx.sendMessage("msg:issuer-revoked"));
    expect(issuerRevoked.reasons).toContain("ISSUER_REVOKED");

    const fresh = await prepared();
    const message = await fresh.sendMessage("msg:bad-sig");
    message.signature = `${message.signature.slice(0, -2)}AA`;
    const bad = await gate(fresh, message);
    expect(bad.code).toBe("IDENTITY_INVALID");
    expect(bad.reasons).toContain("SIGNATURE_INVALID");
  });

  it("denies tamper, replay, and message-id collision", async () => {
    const ctx = await prepared();
    const original = await ctx.sendMessage("msg:once");
    const tampered = { ...original, payload: { ...original.payload, body: `${original.payload.body}\nchanged` } };
    const tamper = await gate(ctx, tampered);
    expect(tamper.reasons).toContain("SIGNATURE_INVALID");

    const collisionCtx = await prepared();
    const first = await collisionCtx.sendMessage("msg:same");
    const sent = await performOutbound({
      message: first, registry: collisionCtx.registry, replay: collisionCtx.replay, ledger: collisionCtx.ledger,
      policy: collisionCtx.policy, campaign: collisionCtx.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(sent.decision.code).toBe("ALLOW");
    const replay = await gate(collisionCtx, first);
    expect(replay.code).toBe("REPLAY");
    expect(replay.reasons).toContain("MESSAGE_REPLAYED");

    const otherBody = `${collisionCtx.body}\nsecond`;
    const other = await signed(collisionCtx.agentz, "msg:same", "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], {
      ...first.payload,
      body: otherBody,
      content_hash: await contentHash(otherBody),
    });
    const collision = await gate(collisionCtx, other);
    expect(collision.code).toBe("REPLAY");
    expect(collision.reasons).toContain("MESSAGE_ID_CONFLICT");
  });

  it("denies missing, incorrect, and policy-revoked capabilities", async () => {
    const ctx = await prepared();
    const scoutSend = await signed(ctx.scout, "msg:scout-send", "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], (await ctx.sendMessage("unused")).payload);
    const scoutDenied = await gate(ctx, scoutSend);
    expect(scoutDenied.code).toBe("CAPABILITY_MISSING");
    expect(scoutDenied.reasons).toContain("CAPABILITY_NOT_GRANTED");

    const wrong = await signed(ctx.agentz, "msg:wrong-cap", "SEND_OUTBOUND", ["PROPOSE_OFFER"], [EVIDENCE_ID], (await ctx.sendMessage("payload-only")).payload);
    const wrongDecision = await gate(ctx, wrong);
    expect(wrongDecision.code).toBe("CAPABILITY_MISSING");
    expect(wrongDecision.reasons).toContain("SEND_OUTBOUND");

    const policy = defaultOutboundPolicy();
    policy.allowed_capabilities = policy.allowed_capabilities.filter((cap) => cap !== "SEND_OUTBOUND");
    const revokedCap = await gate(ctx, await ctx.sendMessage("msg:policy-cap"), { policy });
    expect(revokedCap.code).toBe("POLICY_DENIED");
    expect(revokedCap.reasons).toContain("capability_revoked_by_policy");

    const purchase = await signed(ctx.agentz, "msg:purchase", "PURCHASE", ["SEND_OUTBOUND"], [EVIDENCE_ID], { action: "PURCHASE" });
    const purchaseDecision = await gate(ctx, purchase as unknown as SignedAgentMessage<OutboundActionPayload>);
    expect(purchaseDecision.code).toBe("POLICY_DENIED");
    expect(purchaseDecision.reasons[0]).toContain("action_not_permitted");
  });

  it("denies ineligible recipients, suppression, duplicates, and rate limits", async () => {
    const role = await prepared();
    const roleDecision = await gate(role, await role.sendMessage("msg:role", { recipient: "sales@example.test" }));
    expect(roleDecision.code).toBe("RECIPIENT_INELIGIBLE");
    expect(roleDecision.reasons).toContain("role_inbox");

    const scraped = await prepared();
    const scrapedDecision = await gate(scraped, await scraped.sendMessage("msg:scraped", { recipient_source: "scraped" }));
    expect(scrapedDecision.reasons).toContain("untrusted_source:scraped");

    const gov = await prepared();
    const govDecision = await gate(gov, await gov.sendMessage("msg:gov", { recipient: "person@example.gov" }));
    expect(govDecision.reasons).toContain("government_or_military_address");

    const suppressed = await prepared();
    suppressed.ledger.suppress("standards@example.test", "opt_out", NOW.toISOString());
    const suppressedDecision = await gate(suppressed, await suppressed.sendMessage("msg:suppressed"));
    expect(suppressedDecision.code).toBe("SUPPRESSED");

    const global = await prepared();
    global.ledger.globalSuppression = true;
    expect((await gate(global, await global.sendMessage("msg:global"))).code).toBe("SUPPRESSED");

    const duplicate = await prepared();
    const first = await performOutbound({
      message: await duplicate.sendMessage("msg:first"),
      registry: duplicate.registry, replay: duplicate.replay, ledger: duplicate.ledger,
      policy: duplicate.policy, campaign: duplicate.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(first.decision.code).toBe("ALLOW");
    const second = await gate(duplicate, await duplicate.sendMessage("msg:second"));
    expect(second.code).toBe("DUPLICATE_CONTACT");

    const limited = await prepared();
    limited.policy.max_sends_per_agent = 0;
    expect((await gate(limited, await limited.sendMessage("msg:agent-limit"))).reasons).toContain("agent_rate_limit");
    const campaignLimited = await prepared();
    campaignLimited.policy.max_sends_per_campaign = 0;
    expect((await gate(campaignLimited, await campaignLimited.sendMessage("msg:camp-limit"))).reasons).toContain("campaign_rate_limit");

    const cooldown = await prepared();
    cooldown.policy.max_sends_per_recipient = 5;
    cooldown.ledger.recordSend({
      at: NOW.toISOString(), message_id: "msg:prior", agent_id: "agent:other",
      campaign_id: "camp:other", prospect_id: "prospect:other", opportunity_id: "opp:other",
      recipient: "standards@example.test", content_hash: "prior",
    });
    const cooled = await gate(cooldown, await cooldown.sendMessage("msg:cooldown"));
    expect(cooled.code).toBe("RATE_LIMIT");
    expect(cooled.reasons).toContain("recipient_cooldown");
  });

  it("denies paused, unauthorized, and non-public campaigns, and the kill switch", async () => {
    const paused = await prepared();
    paused.campaign.paused = true;
    expect((await gate(paused, await paused.sendMessage("msg:paused"))).reasons).toContain("campaign_paused");

    const unauthorized = await prepared();
    unauthorized.campaign.authorized = false;
    expect((await gate(unauthorized, await unauthorized.sendMessage("msg:unauth"))).code).toBe("CAMPAIGN_UNAUTHORIZED");

    const privateOffer = await prepared();
    privateOffer.policy.public_offers = ["starter"];
    expect((await gate(privateOffer, await privateOffer.sendMessage("msg:offer"))).code).toBe("OFFER_NOT_PUBLIC");

    const killed = await prepared();
    killed.ledger.engageKillSwitch(NOW.toISOString());
    const kill = await gate(killed, await killed.sendMessage("msg:kill"));
    expect(kill.code).toBe("KILL_SWITCH");

    const email = await prepared();
    const blocked = await performOutbound({
      message: await email.sendMessage("msg:email"),
      registry: email.registry, replay: email.replay, ledger: email.ledger,
      policy: email.policy, campaign: email.campaign, transport: "email", now: NOW,
    });
    expect(blocked.decision.code).toBe("PRODUCTION_SEND_DISABLED");
    expect(blocked.result.delivered).toBe(false);
  });

  it("calls an email sender only when production flags and a sender exist", async () => {
    const ctx = await prepared();
    ctx.policy.production_send = true;
    ctx.campaign.human_send_approved = true;
    const seen: string[] = [];
    const emailTransport = new EmailTransport(async (request) => {
      seen.push(request.recipient);
    });
    const sent = await performOutbound({
      message: await ctx.sendMessage("msg:live-capable"),
      registry: ctx.registry, replay: ctx.replay, ledger: ctx.ledger,
      policy: ctx.policy, campaign: ctx.campaign, transport: "email", now: NOW, emailTransport,
    });
    expect(sent.decision.code).toBe("ALLOW");
    expect(sent.result.external).toBe(true);
    expect(seen).toEqual(["standards@example.test"]);
    expect(acquisitionReport(ctx.ledger).external_deliveries).toBe(1);

    const unconfigured = await prepared();
    unconfigured.policy.production_send = true;
    unconfigured.campaign.human_send_approved = true;
    const refused = await performOutbound({
      message: await unconfigured.sendMessage("msg:no-sender"),
      registry: unconfigured.registry, replay: unconfigured.replay, ledger: unconfigured.ledger,
      policy: unconfigured.policy, campaign: unconfigured.campaign, transport: "email", now: NOW,
    });
    expect(refused.decision.code).toBe("ALLOW");
    expect(refused.result.code).toBe("TRANSPORT_REFUSED");
    expect(refused.result.reason).toBe("sender_not_configured");
    expect(unconfigured.ledger.sends).toHaveLength(0);
  });

  it("rejects a content hash that does not match the signed body", async () => {
    const ctx = await prepared();
    const payload = (await ctx.sendMessage("msg:hash-base")).payload;
    const lied = await signed(ctx.agentz, "msg:hash", "SEND_OUTBOUND", ["SEND_OUTBOUND"], [EVIDENCE_ID], {
      ...payload,
      body: `${ctx.body}\naltered`,
    });
    const decision = await gate(ctx, lied);
    expect(decision.code).toBe("BINDING_MISMATCH");
    expect(decision.reasons).toContain("content_hash_mismatch");
  });

  it("disqualifies sensitive or weak evidence and blocks AgentZ from scouting", async () => {
    const sensitive = qualifyProspect({
      prospectId: "prospect:sensitive",
      organization: "Example",
      domain: "example.test",
      evidence: [{ ...EVIDENCE, summary: "Leaked social security number" }],
      contact: null,
      recommendedAgent: AGENTZ_ID,
      discoveredBy: SCOUT_ID,
      now: NOW.toISOString(),
    });
    expect(sensitive.status).toBe("DISQUALIFIED");
    expect(sensitive.disqualify_reasons).toContain("sensitive_personal_data");
    const weak = qualifyProspect({
      prospectId: "prospect:weak",
      organization: "Example",
      domain: "example.test",
      evidence: [{ ...EVIDENCE, evidence_id: "evi:partner", kind: "partnership", summary: "A public partnership note." }],
      contact: null,
      recommendedAgent: AGENTZ_ID,
      discoveredBy: SCOUT_ID,
      now: NOW.toISOString(),
    });
    expect(weak.status).toBe("DISCOVERED");
    expect(weak.recommended_offer).toBeNull();

    const ctx = await prepared();
    const agentDiscover = await signed(ctx.agentz, "msg:agentz-discover", "DISCOVER_PROSPECT", ["DISCOVER_PROSPECT"], [EVIDENCE_ID], {
      action: "DISCOVER_PROSPECT" as const,
      prospect_id: "prospect:other",
      organization: "Other",
      domain: "other.test",
      evidence: [EVIDENCE],
      contact: null,
      recommended_agent: AGENTZ_ID,
    });
    const denied = await executeDiscover({
      message: agentDiscover, registry: ctx.registry, replay: ctx.replay, ledger: new AcquisitionLedger(), policy: ctx.policy, now: NOW,
    });
    expect(denied.code).toBe("CAPABILITY_MISSING");
  });

  it("resolves inbound, propagates opt-out, and refuses unknown or engaged events", async () => {
    const ctx = await prepared();
    await performOutbound({
      message: await ctx.sendMessage("msg:inbound"),
      registry: ctx.registry, replay: ctx.replay, ledger: ctx.ledger,
      policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(applyInbound(ctx.ledger, { conversation_id: "conv:missing", kind: "reply", body: "hi", at: NOW.toISOString() }).code).toBe("UNKNOWN_CONVERSATION");
    expect(applyInbound(ctx.ledger, { conversation_id: "conv:msg:inbound", kind: "malformed", at: NOW.toISOString() }).code).toBe("MALFORMED_EVENT");
    expect(applyInbound(ctx.ledger, { conversation_id: "conv:msg:inbound", kind: "engaged", at: NOW.toISOString() }).code).toBe("MALFORMED_EVENT");
    const reply = applyInbound(ctx.ledger, {
      conversation_id: "conv:msg:inbound", kind: "reply", body: "Yes, interested", at: "2026-10-08T21:00:00.000Z",
    });
    expect(reply.status).toBe("INTERESTED");
    const tooSoon = markUnresponsive(ctx.ledger, "conv:msg:inbound", "2026-10-09T00:00:00.000Z");
    expect(tooSoon.reasons).toContain("already_progressed");

    const bounceCtx = await prepared();
    await performOutbound({
      message: await bounceCtx.sendMessage("msg:bounce"),
      registry: bounceCtx.registry, replay: bounceCtx.replay, ledger: bounceCtx.ledger,
      policy: bounceCtx.policy, campaign: bounceCtx.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(applyInbound(bounceCtx.ledger, { conversation_id: "conv:msg:bounce", kind: "bounce", at: NOW.toISOString() }).status).toBe("BOUNCED");
    expect(bounceCtx.ledger.isSuppressed("standards@example.test")).toBe(true);

    const opt = await prepared();
    await performOutbound({
      message: await opt.sendMessage("msg:opt"),
      registry: opt.registry, replay: opt.replay, ledger: opt.ledger,
      policy: opt.policy, campaign: opt.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(applyInbound(opt.ledger, {
      conversation_id: "conv:msg:opt", kind: "reply", body: "Please unsubscribe", at: NOW.toISOString(),
    }).status).toBe("OPTED_OUT");
    const follow = await gate(opt, await opt.sendMessage("msg:after-optout"));
    expect(follow.code).toBe("SUPPRESSED");
  });

  it("keeps checkout attribution and refuses fixture payments and fulfillment", async () => {
    const ctx = await prepared();
    await performOutbound({
      message: await ctx.sendMessage("msg:checkout"),
      registry: ctx.registry, replay: ctx.replay, ledger: ctx.ledger,
      policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    applyInbound(ctx.ledger, {
      conversation_id: "conv:msg:checkout", kind: "reply", body: "interested", at: "2026-10-08T21:00:00.000Z",
    });
    const checkout = recordCheckoutIntent(ctx.ledger, OPPORTUNITY_ID, "2026-10-08T21:05:00.000Z");
    const again = recordCheckoutIntent(ctx.ledger, OPPORTUNITY_ID, "2026-10-08T21:06:00.000Z");
    expect(checkout.url).toBe(
      `${publicCheckoutHref("dpp_readiness")}?utm_source=authichain&utm_medium=agent_outbound&utm_campaign=${encodeURIComponent(ctx.campaign.campaign_id)}&utm_content=dpp_readiness`,
    );
    expect(again.reasons).toContain("duplicate_checkout_intent");
    const fixture = observePayment(ctx.ledger, { opportunity_id: OPPORTUNITY_ID, source: "fixture", at: "2026-10-08T21:07:00.000Z" });
    expect(fixture.code).toBe("NOT_PROVIDER_PAYMENT");
    expect(fixture.entitlement_granted).toBe(false);
    expect(ctx.ledger.opportunities.get(OPPORTUNITY_ID)?.status).toBe("CHECKOUT_STARTED");
    const observed = observePayment(ctx.ledger, {
      opportunity_id: OPPORTUNITY_ID, source: "provider", livemode: true, amount_cents: 29900,
      session_id: "cs_observation_not_cash", at: "2026-10-08T21:08:00.000Z",
    });
    expect(observed.accepted).toBe(true);
    expect(observed.entitlement_granted).toBe(false);
    expect(observed.cash_recognized).toBe(false);
    expect(observePayment(ctx.ledger, {
      opportunity_id: OPPORTUNITY_ID, source: "provider", livemode: true, amount_cents: 29900,
      session_id: "cs_observation_not_cash", at: "2026-10-08T21:09:00.000Z",
    }).code).toBe("DUPLICATE");
    expect(advanceToFulfillment("PROVISIONED").code).toBe("ENTITLEMENT_NOT_GRANTED");
    expect(advanceToFulfillment("ACTIVATED").code).toBe("ENTITLEMENT_NOT_GRANTED");
    const report = acquisitionReport(ctx.ledger);
    expect(report.checkout_started).toBe(1);
    expect(report.paid_observations).toBe(1);
    expect(report.entitlements_granted).toBe(0);
    expect(report.provisioned).toBe(0);
    expect(report.activated).toBe(0);
    expect(report.first_value).toBe(0);
    const checkoutEvent = ctx.ledger.funnel.find((event) => event.type === "checkout_started");
    expect(checkoutEvent?.agent_id).toBe(AGENTZ_ID);
    expect(checkoutEvent?.offer_id).toBe("dpp_readiness");
    expect(checkoutEvent?.evidence_ids).toEqual([EVIDENCE_ID]);
  });

  it("runs the AgentZ dogfood path without external delivery or a grant", async () => {
    const trace = await runAgentZDogfood();
    expect(trace.selfVerified).toBe(true);
    expect(trace.guardianVerified).toBe(true);
    expect(trace.passportStatus).toBe("ACTIVE");
    expect(trace.prospect?.status).toBe("QUALIFIED");
    expect(trace.opportunity?.recommended_agent).toBe("agent:authichain:agentz-sales-01");
    expect(trace.decision.code).toBe("ALLOW");
    expect(trace.decision.production_send).toBe(false);
    expect(trace.capture?.delivered).toBe(true);
    expect(trace.capture?.external).toBe(false);
    expect(trace.capture?.signature.length).toBeGreaterThan(20);
    expect(trace.external).toBe(false);
    expect(trace.inboundStatus).toBe("INTERESTED");
    expect(trace.checkoutUrl).toContain("https://authichain.com/checkout/dpp_readiness");
    expect(trace.fixturePayment.code).toBe("NOT_PROVIDER_PAYMENT");
    expect(trace.providerPayment.entitlement_granted).toBe(false);
    expect(trace.fulfillment.code).toBe("ENTITLEMENT_NOT_GRANTED");
    expect(trace.report.authorized).toBe(1);
    expect(trace.report.external_deliveries).toBe(0);
    expect(trace.report.test_captures).toBe(1);
    expect(trace.report.entitlements_granted).toBe(0);
    expect(trace.report.by_agent[AGENTZ_ID]?.authorized).toBe(1);
    expect(trace.report.by_agent[AGENTZ_ID]?.interested).toBe(1);
    expect(GUARDIAN_CAPABILITIES).not.toContain("SEND_OUTBOUND");
    expect(SCOUT_CAPABILITIES).not.toContain("SEND_OUTBOUND");
    expect(AGENTZ_SALES_CAPABILITIES).not.toContain("DISCOVER_PROSPECT");
  });

  it("marks unresponsive only after the horizon with no reply", async () => {
    const ctx = await prepared();
    await performOutbound({
      message: await ctx.sendMessage("msg:quiet"),
      registry: ctx.registry, replay: ctx.replay, ledger: ctx.ledger,
      policy: ctx.policy, campaign: ctx.campaign, transport: "test", now: NOW,
      testTransport: new TestOutboundTransport(),
    });
    expect(markUnresponsive(ctx.ledger, "conv:msg:quiet", "2026-10-10T19:00:00.000Z").reasons).toContain("horizon_not_reached");
    expect(markUnresponsive(ctx.ledger, "conv:msg:quiet", "2026-10-15T20:00:00.000Z").status).toBe("UNRESPONSIVE");
    expect(acquisitionReport(ctx.ledger).unresponsive).toBe(1);
  });
});
