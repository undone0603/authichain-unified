import { describe, expect, it } from "vitest";
import {
  AGENT_CAPABILITIES,
  type AgentCapability,
  type AgentIdentityAttestation,
  type AgentIdentityResolver,
  type AgentMessageVerificationResult,
} from "./agent-types";
import {
  canonicalizeAgentIdentityAttestation,
  canonicalizeAgentMessage,
  type SignedAgentMessage,
} from "./agent-message";
import { MemoryAgentReplayStore } from "./agent-store";
import { verifyAgentMessage } from "./agent-verifier";
import {
  ECONOMIC_ACTION_PROTOCOL,
  isEconomicAction,
  type EconomicAction,
  type EconomicAuditPayload,
} from "./economic-action";
import {
  signEconomicAuditRecord,
  verifyEconomicAuditRecord,
} from "./crypto-message";
import {
  authorizeEconomicAction,
  type EconomicPolicy,
} from "./policy-engine";

const NOW = new Date("2026-10-09T10:00:00.000Z");
const ACTION_CREATED = "2026-10-09T09:59:00.000Z";
const ACTION_EXPIRES = "2026-10-09T10:03:00.000Z";

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function keys() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  return {
    pair,
    publicJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  };
}

async function sign(value: string, privateKey: CryptoKey): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(value),
  );
  return b64(new Uint8Array(signature));
}

interface Fixture {
  action: EconomicAction;
  message: SignedAgentMessage<EconomicAction>;
  verification: AgentMessageVerificationResult;
  policy: EconomicPolicy;
  agentPrivateKey: CryptoKey;
  issuerPrivateKey: CryptoKey;
  issuerPublicKey: CryptoKey;
}

async function createFixture(options: {
  capabilities?: AgentCapability[];
  actionOverrides?: Partial<EconomicAction>;
  policyOverrides?: Partial<EconomicPolicy>;
} = {}): Promise<Fixture> {
  const agentKeys = await keys();
  const issuerKeys = await keys();
  const caps: AgentCapability[] = options.capabilities ?? ["PROPOSE_ECONOMIC_ACTION", "TRANSFER_VALUE"];

  const attestationBase: Omit<AgentIdentityAttestation, "signature"> = {
    agent_id: "agent:treasury:worker-01",
    organization_id: "org:authichain:core",
    role: "treasury_agent",
    version: "1.0.0",
    capabilities: [...AGENT_CAPABILITIES],
    public_key: agentKeys.publicJwk,
    policy_version: "economic-policy-1",
    issued_at: "2026-10-09T09:00:00.000Z",
    effective_at: "2026-10-09T09:00:00.000Z",
    expires_at: "2026-10-10T09:00:00.000Z",
    issuer_id: "issuer:authichain:root",
    attestation_id: "att:treasury:0001",
  };
  const attestation: AgentIdentityAttestation = {
    ...attestationBase,
    signature: await sign(
      canonicalizeAgentIdentityAttestation(attestationBase),
      issuerKeys.pair.privateKey,
    ),
  };

  const action: EconomicAction = Object.assign({
    protocol: ECONOMIC_ACTION_PROTOCOL,
    action_id: "act:treasury:0001",
    idempotency_key: "idem:treasury:0001",
    operation: "TRANSFER",
    agent_id: attestation.agent_id,
    organization_id: attestation.organization_id,
    attestation_id: attestation.attestation_id,
    policy_version: attestation.policy_version,
    asset_id: "USDC",
    amount_minor_units: "2500000",
    source_account_id: "acct:operating",
    destination_account_id: "acct:vendor-01",
    evidence_ids: ["evidence:invoice-1001"],
    created_at: ACTION_CREATED,
    expires_at: ACTION_EXPIRES,
  } satisfies EconomicAction, options.actionOverrides ?? {});

  const unsigned: Omit<SignedAgentMessage<EconomicAction>, "signature"> = {
    protocol: "authichain-agent/1",
    message_id: action.idempotency_key,
    agent_id: action.agent_id,
    organization_id: action.organization_id,
    attestation_id: action.attestation_id,
    role: attestation.role,
    version: attestation.version,
    capabilities: caps,
    policy_version: action.policy_version,
    issued_at: action.created_at,
    expires_at: action.expires_at,
    intent: "economic_action_request",
    evidence_ids: action.evidence_ids,
    payload: action,
  };
  const message: SignedAgentMessage<EconomicAction> = {
    ...unsigned,
    signature: await sign(
      canonicalizeAgentMessage(unsigned),
      agentKeys.pair.privateKey,
    ),
  };

  const resolver: AgentIdentityResolver = {
    resolve: async () => attestation,
    isRevoked: async () => false,
    getIssuerPublicKey: async () => issuerKeys.publicJwk,
    isIssuerRevoked: async () => false,
  };

  const verification = await verifyAgentMessage(
    message,
    {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: NOW,
    },
  );

  const policy: EconomicPolicy = {
    policy_version: "economic-policy-1",
    organization_id: attestation.organization_id,
    enabled: true,
    allowed_operations: ["TRANSFER", "DEDUCT"],
    allowed_asset_ids: ["USDC"],
    max_single_action_minor_units: "100000000",
    max_action_lifetime_seconds: 600,
    require_evidence: true,
    max_evidence_ids: 4,
    ...options.policyOverrides,
  };

  return {
    action,
    message,
    verification,
    policy,
    agentPrivateKey: agentKeys.pair.privateKey,
    issuerPrivateKey: issuerKeys.pair.privateKey,
    issuerPublicKey: issuerKeys.pair.publicKey,
  };
}

describe("Economic control-plane adversarial gate", () => {
  it("allows only a verified proposal to proceed to reservation, never execution", async () => {
    const fixture = await createFixture();
    expect(fixture.verification.valid).toBe(true);

    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      fixture.policy,
      NOW,
    );

    expect(decision.decision).toBe("ELIGIBLE_FOR_RESERVATION");
    expect(decision.reason_codes).toEqual([]);
    expect(decision.requires_reservation).toBe(true);
    expect(decision.execution_permitted).toBe(false);
    expect(decision.action_digest).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(decision.message_digest).toBe(fixture.verification.message_digest);
  });

  it("fails closed for an unverified message", async () => {
    const fixture = await createFixture();
    const decision = await authorizeEconomicAction(
      fixture.message,
      { ...fixture.verification, valid: false, reasons: ["SIGNATURE_INVALID"] },
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MESSAGE_NOT_VERIFIED");
    expect(decision.execution_permitted).toBe(false);
  });

  it("rejects unexpected fields on the verifier result", async () => {
    const fixture = await createFixture();
    const extended = { ...fixture.verification, trusted_by_admin: true };
    const decision = await authorizeEconomicAction(
      fixture.message,
      extended,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MESSAGE_NOT_VERIFIED");
  });

  it("rejects post-verification payload mutation (TOCTOU)", async () => {
    const fixture = await createFixture();
    const mutated = {
      ...fixture.message,
      payload: { ...fixture.action, amount_minor_units: "999999999" },
    };
    const decision = await authorizeEconomicAction(
      mutated,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MESSAGE_NOT_VERIFIED");
  });

  it("rejects signature-string mutation after verification", async () => {
    const fixture = await createFixture();
    const first = fixture.message.signature.startsWith("A") ? "B" : "A";
    const mutated = { ...fixture.message, signature: first + fixture.message.signature.slice(1) };
    const decision = await authorizeEconomicAction(
      mutated,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MESSAGE_NOT_VERIFIED");
  });

  it("rejects unrecognized message envelope fields instead of ignoring them", async () => {
    const fixture = await createFixture();
    const extended = { ...fixture.message, bypass_policy: true };
    const decision = await authorizeEconomicAction(
      extended,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MESSAGE_ACTION_BINDING_MISMATCH");
  });

  it("rejects unknown policy fields instead of silently ignoring them", async () => {
    const fixture = await createFixture();
    const extendedPolicy = { ...fixture.policy, hidden_admin_override: true };
    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      extendedPolicy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("MALFORMED_POLICY");
  });

  it("requires the operation-specific capability as well as proposal capability", async () => {
    const fixture = await createFixture({ capabilities: ["PROPOSE_ECONOMIC_ACTION"] });
    expect(fixture.verification.valid).toBe(true);
    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("denies amounts above the policy's per-action ceiling", async () => {
    const fixture = await createFixture({
      actionOverrides: { amount_minor_units: "100000001" },
    });
    expect(fixture.verification.valid).toBe(true);
    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.decision).toBe("DENY");
    expect(decision.reason_codes).toContain("AMOUNT_EXCEEDS_MAXIMUM");
  });

  it("denies disallowed assets and stale policy versions", async () => {
    const fixture = await createFixture({
      actionOverrides: { asset_id: "UNKNOWN-ASSET" },
    });
    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    expect(decision.reason_codes).toContain("ASSET_NOT_ALLOWED");

    const stalePolicy = { ...fixture.policy, policy_version: "economic-policy-2" };
    const stale = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      stalePolicy,
      NOW,
    );
    expect(stale.reason_codes).toContain("POLICY_VERSION_MISMATCH");
  });

  it("requires evidence, distinct transfer accounts, and canonical integer amounts", async () => {
    const noEvidence = await createFixture({ actionOverrides: { evidence_ids: [] } });
    const evidenceDecision = await authorizeEconomicAction(
      noEvidence.message,
      noEvidence.verification,
      noEvidence.policy,
      NOW,
    );
    expect(evidenceDecision.reason_codes).toContain("EVIDENCE_REQUIRED");

    const actionWithSameAccounts = {
      ...noEvidence.action,
      evidence_ids: ["evidence:invoice-1001"],
      source_account_id: "acct:same",
      destination_account_id: "acct:same",
    };
    expect(isEconomicAction(actionWithSameAccounts)).toBe(false);

    expect(isEconomicAction({ ...noEvidence.action, amount_minor_units: "1.5" })).toBe(false);
    expect(isEconomicAction({ ...noEvidence.action, amount_minor_units: "01" })).toBe(false);
    expect(isEconomicAction({ ...noEvidence.action, unreviewed: true })).toBe(false);
  });

  it("refuses expired and overlong proposals", async () => {
    const expired = await createFixture({
      actionOverrides: {
        created_at: "2026-10-09T09:50:00.000Z",
        expires_at: "2026-10-09T09:59:00.000Z",
      },
    });
    const expiredDecision = await authorizeEconomicAction(
      expired.message,
      expired.verification,
      expired.policy,
      NOW,
    );
    expect(expiredDecision.reason_codes).toContain("ACTION_EXPIRED");

    const longTtl = await createFixture({
      actionOverrides: {
        expires_at: "2026-10-09T12:00:00.000Z",
      },
    });
    const longDecision = await authorizeEconomicAction(
      longTtl.message,
      longTtl.verification,
      longTtl.policy,
      NOW,
    );
    expect(longDecision.reason_codes).toContain("ACTION_TTL_EXCEEDED");
  });

  it("signs audit decisions and detects payload tampering", async () => {
    const fixture = await createFixture();
    const decision = await authorizeEconomicAction(
      fixture.message,
      fixture.verification,
      fixture.policy,
      NOW,
    );
    const payload: EconomicAuditPayload = {
      protocol: "authichain-economic-audit-payload/1",
      audit_id: "audit:0001",
      decision_id: decision.decision_id,
      action_id: fixture.action.action_id,
      action_digest: decision.action_digest!,
      agent_id: fixture.action.agent_id,
      organization_id: fixture.action.organization_id,
      policy_version: fixture.action.policy_version,
      decision: decision.decision,
      reason_codes: decision.reason_codes,
      decided_at: decision.decided_at,
      reservation_state: "NOT_RESERVED",
      execution_state: "NOT_EXECUTED",
    };
    const record = await signEconomicAuditRecord(
      payload,
      "audit-key:root",
      fixture.issuerPrivateKey,
      payload.decided_at,
    );

    expect(await verifyEconomicAuditRecord(record, fixture.issuerPublicKey)).toBe(true);
    expect(
      await verifyEconomicAuditRecord(
        { ...record, payload: { ...record.payload, execution_state: "EXECUTED" } },
        fixture.issuerPublicKey,
      ),
    ).toBe(false);
  });
});
