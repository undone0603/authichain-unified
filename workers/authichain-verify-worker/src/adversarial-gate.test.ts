import { describe, expect, it } from "vitest";
import {
  ECONOMIC_ACTION_PROTOCOL,
  parseEconomicAction,
  type EconomicAction,
} from "./economic-action";
import {
  canonicalizeControlPlaneMessage,
  verifyControlPlaneMessage,
  type SignedControlPlaneMessage,
} from "./crypto-message";
import {
  evaluateEconomicAction,
  type EconomicPolicyContext,
} from "./policy-engine";

const NOW = new Date("2026-10-09T12:01:00.000Z");
const ACTION_BASE: EconomicAction = {
  protocol: ECONOMIC_ACTION_PROTOCOL,
  action_id: "action:transfer-1001",
  idempotency_key: "idem:transfer-1001",
  action_type: "TRANSFER",
  agent_id: "agent:catalog-sync-01",
  organization_id: "org:authichain-core",
  attestation_id: "att:agent-1001",
  policy_version: "policy:2026-10-09",
  budget_id: "budget:org-core-qron",
  asset_id: "asset:QRON",
  amount_minor: 25,
  source_account_id: "acct:treasury",
  destination_account_id: "acct:merchant-1",
  evidence_ids: ["evidence:invoice-1001"],
  created_at: "2026-10-09T12:00:00.000Z",
  expires_at: "2026-10-09T12:04:00.000Z",
};

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signedFixture(
  actionOverrides: Partial<EconomicAction> = {},
  messageOverrides: Partial<Omit<SignedControlPlaneMessage, "signature" | "action">> = {},
) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey));
  const action: EconomicAction = { ...ACTION_BASE, ...actionOverrides };
  const unsigned = {
    protocol: "authichain-control-plane/1",
    message_id: "msg:control-1001",
    agent_id: action.agent_id,
    organization_id: action.organization_id,
    attestation_id: action.attestation_id,
    policy_version: action.policy_version,
    issued_at: action.created_at,
    expires_at: "2026-10-09T12:05:00.000Z",
    ...messageOverrides,
    action,
  };
  const signatureBytes = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    keyPair.privateKey,
    new TextEncoder().encode(canonicalizeControlPlaneMessage(unsigned)),
  );
  const message = { ...unsigned, signature: b64(new Uint8Array(signatureBytes)) };
  const verified = await verifyControlPlaneMessage(message, publicKey, { now: NOW });
  return { message, publicKey, verified, action };
}

function policyContext(action: EconomicAction = ACTION_BASE): EconomicPolicyContext {
  return {
    decision_id: "decision:1001",
    now: NOW,
    identity: {
      agent_id: action.agent_id,
      organization_id: action.organization_id,
      attestation_id: action.attestation_id,
      role: "catalog_sync",
      policy_version: action.policy_version,
      capabilities: ["PROPOSE_TRANSFER"],
      status: "ACTIVE",
      issuer_revoked: false,
      attestation_revoked: false,
    },
    policy: {
      policy_version: action.policy_version,
      organization_id: action.organization_id,
      enabled: true,
      allowed_action_types: ["TRANSFER"],
      allowed_asset_ids: ["asset:QRON"],
      max_amount_minor_by_action: { TRANSFER: 100 },
      max_action_lifetime_seconds: 300,
      evidence_required_for: ["TRANSFER"],
      allowed_agent_ids: [action.agent_id],
      allowed_roles: ["catalog_sync"],
      allowed_organization_ids: [action.organization_id],
    },
    budget: {
      budget_id: action.budget_id,
      organization_id: action.organization_id,
      asset_id: action.asset_id,
      status: "ACTIVE",
      revision: "revision:17",
      limit_minor: 500,
      committed_minor: 100,
      reserved_minor: 100,
    },
    evidence: [{
      evidence_id: "evidence:invoice-1001",
      organization_id: action.organization_id,
      verified: true,
      digest: "0123456789abcdef0123456789abcdef",
    }],
    idempotency_lookup: "NEW",
  };
}

describe("economic action domain contracts", () => {
  it("rejects extra fields instead of silently excluding them from a signature", () => {
    expect(() => parseEconomicAction({
      ...ACTION_BASE,
      admin_override: true,
    })).toThrow(/Unknown economic action field/);
  });

  it.each([0, -1, 1.25, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe amount_minor values (%s)",
    (amount) => {
      expect(() => parseEconomicAction({ ...ACTION_BASE, amount_minor: amount })).toThrow();
    },
  );

  it("rejects duplicate evidence IDs and impossible account bindings", () => {
    expect(() => parseEconomicAction({
      ...ACTION_BASE,
      evidence_ids: ["evidence:invoice-1001", "evidence:invoice-1001"],
    })).toThrow(/duplicates/);
    expect(() => parseEconomicAction({
      ...ACTION_BASE,
      destination_account_id: "acct:treasury",
    })).toThrow(/must differ/);
  });

  it("requires action-specific account fields", () => {
    expect(() => parseEconomicAction({
      ...ACTION_BASE,
      action_type: "MINT",
      source_account_id: undefined,
    })).toThrow(/MINT requires only a destination account/);
  });

  it("normalizes evidence order deterministically", () => {
    const first = parseEconomicAction({
      ...ACTION_BASE,
      evidence_ids: ["evidence:b", "evidence:a"],
    });
    const second = parseEconomicAction({
      ...ACTION_BASE,
      evidence_ids: ["evidence:a", "evidence:b"],
    });
    expect(first.evidence_ids).toEqual(second.evidence_ids);
  });
});

describe("signed economic control-plane envelope", () => {
  it("verifies a correctly signed action with identity and policy bindings", async () => {
    const fixture = await signedFixture();
    expect(fixture.verified.valid).toBe(true);
    expect(fixture.verified.reasons).toEqual([]);
    expect(fixture.verified.action?.action_id).toBe(ACTION_BASE.action_id);
  });

  it("rejects tampering with amount after signature creation", async () => {
    const fixture = await signedFixture();
    const tampered = {
      ...fixture.message,
      action: { ...fixture.message.action, amount_minor: 99 },
    };
    const result = await verifyControlPlaneMessage(tampered, fixture.publicKey, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("SIGNATURE_INVALID");
  });

  it("rejects unsigned and unknown top-level fields", async () => {
    const fixture = await signedFixture();
    const { signature: _signature, ...unsigned } = fixture.message;
    expect((await verifyControlPlaneMessage(unsigned, fixture.publicKey, { now: NOW })).valid).toBe(false);
    const tampered = { ...fixture.message, unchecked_override: true };
    const result = await verifyControlPlaneMessage(tampered, fixture.publicKey, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("MALFORMED_MESSAGE");
  });

  it("rejects an action whose identity does not match the signed envelope", async () => {
    const fixture = await signedFixture();
    const tampered = {
      ...fixture.message,
      action: { ...fixture.message.action, organization_id: "org:other" },
    };
    const result = await verifyControlPlaneMessage(tampered, fixture.publicKey, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("MALFORMED_MESSAGE");
  });

  it("rejects expired and future-dated messages", async () => {
    const fixture = await signedFixture();
    const expired = await verifyControlPlaneMessage(fixture.message, fixture.publicKey, {
      now: new Date("2026-10-09T12:06:00.000Z"),
      clockSkewSeconds: 0,
    });
    expect(expired.reasons).toContain("MESSAGE_EXPIRED");
    const future = await verifyControlPlaneMessage(fixture.message, fixture.publicKey, {
      now: new Date("2026-10-09T11:59:00.000Z"),
      clockSkewSeconds: 0,
    });
    expect(future.reasons).toContain("MESSAGE_FUTURE_DATED");
  });

  it("rejects signatures verified against the wrong public key", async () => {
    const fixture = await signedFixture();
    const wrongPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const wrongKey = JSON.stringify(await crypto.subtle.exportKey("jwk", wrongPair.publicKey));
    const result = await verifyControlPlaneMessage(fixture.message, wrongKey, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("SIGNATURE_INVALID");
  });
});

describe("adversarial authorization gate", () => {
  it("never returns execution approval; a passing policy result only requests atomic reservation", async () => {
    const fixture = await signedFixture();
    const result = evaluateEconomicAction(fixture.verified, policyContext(fixture.action));
    expect(result.decision).toBe("RESERVATION_REQUIRED");
    expect(result.execution_status).toBe("NOT_EXECUTED");
    expect(result.reservation?.status).toBe("PROPOSED_NOT_RESERVED");
    expect(result.reservation?.expected_budget_revision).toBe("revision:17");
  });

  it("denies unverified signatures", async () => {
    const fixture = await signedFixture();
    const invalid = await verifyControlPlaneMessage(
      { ...fixture.message, signature: "invalid" },
      fixture.publicKey,
      { now: NOW },
    );
    const result = evaluateEconomicAction(invalid, policyContext(fixture.action));
    expect(result.decision).toBe("DENY");
    expect(result.reason_codes).toContain("MESSAGE_NOT_VERIFIED");
  });

  it("denies an agent without the exact proposal capability", async () => {
    const fixture = await signedFixture();
    const context = policyContext(fixture.action);
    context.identity.capabilities = ["READ_EVIDENCE"];
    const result = evaluateEconomicAction(fixture.verified, context);
    expect(result.decision).toBe("DENY");
    expect(result.reason_codes).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("denies revoked issuer or attestation states", async () => {
    const fixture = await signedFixture();
    const issuerRevoked = policyContext(fixture.action);
    issuerRevoked.identity.issuer_revoked = true;
    const issuerResult = evaluateEconomicAction(fixture.verified, issuerRevoked);
    expect(issuerResult.reason_codes).toContain("ISSUER_REVOKED");

    const attestationRevoked = policyContext(fixture.action);
    attestationRevoked.identity.attestation_revoked = true;
    const attestationResult = evaluateEconomicAction(fixture.verified, attestationRevoked);
    expect(attestationResult.reason_codes).toContain("ATTESTATION_REVOKED");
  });

  it("denies policy-version, action-type, asset, and amount-limit mismatches", async () => {
    const fixture = await signedFixture();
    const wrongVersion = policyContext(fixture.action);
    wrongVersion.policy.policy_version = "policy:old";
    expect(evaluateEconomicAction(fixture.verified, wrongVersion).reason_codes)
      .toContain("POLICY_VERSION_MISMATCH");

    const wrongAction = policyContext(fixture.action);
    wrongAction.policy.allowed_action_types = ["MINT"];
    expect(evaluateEconomicAction(fixture.verified, wrongAction).reason_codes)
      .toContain("ACTION_TYPE_NOT_ALLOWED");

    const wrongAsset = policyContext(fixture.action);
    wrongAsset.policy.allowed_asset_ids = ["asset:OTHER"];
    expect(evaluateEconomicAction(fixture.verified, wrongAsset).reason_codes)
      .toContain("ASSET_NOT_ALLOWED");

    const overLimit = await signedFixture({ amount_minor: 101 });
    expect(evaluateEconomicAction(overLimit.verified, policyContext(overLimit.action)).reason_codes)
      .toContain("AMOUNT_LIMIT_EXCEEDED");
  });

  it("accounts for existing reservations before proposing a new reservation", async () => {
    const fixture = await signedFixture();
    const exactBoundary = policyContext(fixture.action);
    exactBoundary.budget.reserved_minor = 375;
    const accepted = evaluateEconomicAction(fixture.verified, exactBoundary);
    expect(accepted.decision).toBe("RESERVATION_REQUIRED");

    const overBoundary = policyContext(fixture.action);
    overBoundary.budget.reserved_minor = 376;
    const denied = evaluateEconomicAction(fixture.verified, overBoundary);
    expect(denied.decision).toBe("DENY");
    expect(denied.reason_codes).toContain("INSUFFICIENT_BUDGET");
  });

  it("fails closed when evidence is missing, unverified, or cross-organization", async () => {
    const fixture = await signedFixture();
    const missing = policyContext(fixture.action);
    missing.evidence = [];
    expect(evaluateEconomicAction(fixture.verified, missing).reason_codes)
      .toContain("EVIDENCE_NOT_VERIFIED");

    const unverified = policyContext(fixture.action);
    unverified.evidence[0].verified = false;
    expect(evaluateEconomicAction(fixture.verified, unverified).reason_codes)
      .toContain("EVIDENCE_NOT_VERIFIED");

    const foreign = policyContext(fixture.action);
    foreign.evidence[0].organization_id = "org:foreign";
    expect(evaluateEconomicAction(fixture.verified, foreign).reason_codes)
      .toContain("EVIDENCE_NOT_VERIFIED");
  });

  it("blocks duplicate, conflicting, and unavailable idempotency lookups", async () => {
    const fixture = await signedFixture();
    const same = policyContext(fixture.action);
    same.idempotency_lookup = "SAME_ACTION";
    expect(evaluateEconomicAction(fixture.verified, same).reason_codes)
      .toContain("ACTION_ALREADY_RESERVED");

    const conflict = policyContext(fixture.action);
    conflict.idempotency_lookup = "CONFLICT";
    expect(evaluateEconomicAction(fixture.verified, conflict).reason_codes)
      .toContain("IDEMPOTENCY_CONFLICT");

    const unavailable = policyContext(fixture.action);
    unavailable.idempotency_lookup = "UNAVAILABLE";
    expect(evaluateEconomicAction(fixture.verified, unavailable).reason_codes)
      .toContain("RESERVATION_STORE_UNAVAILABLE");
  });

  it("denies malformed budget snapshots and suspended budgets", async () => {
    const fixture = await signedFixture();
    const invalid = policyContext(fixture.action);
    invalid.budget.reserved_minor = Number.NaN;
    expect(evaluateEconomicAction(fixture.verified, invalid).reason_codes)
      .toContain("BUDGET_SNAPSHOT_INVALID");

    const suspended = policyContext(fixture.action);
    suspended.budget.status = "SUSPENDED";
    expect(evaluateEconomicAction(fixture.verified, suspended).reason_codes)
      .toContain("BUDGET_NOT_ACTIVE");
  });

  it("denies when the reservation backend cannot be consulted", async () => {
    const fixture = await signedFixture();
    const context = policyContext(fixture.action);
    context.idempotency_lookup = "UNAVAILABLE";
    const result = evaluateEconomicAction(fixture.verified, context);
    expect(result.decision).toBe("DENY");
    expect(result.execution_status).toBe("NOT_EXECUTED");
    expect(result.reservation).toBeUndefined();
  });
});
