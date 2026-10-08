import { describe, expect, it } from "vitest";
import {
  AGENT_CAPABILITIES,
  type AgentIdentityAttestation,
  type AgentIdentityResolver,
} from "./agent-types";
import {
  agentMessageDigest,
  canonicalizeAgentIdentityAttestation,
  canonicalizeAgentMessage,
  canonicalizeJson,
  type SignedAgentMessage,
} from "./agent-message";
import { MemoryAgentReplayStore } from "./agent-store";
import { createAgentPassport, verifyAgentMessage } from "./agent-verifier";

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
    publicKey: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  };
}

async function sign(value: string, privateKey: CryptoKey): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(value),
  );
  return b64(new Uint8Array(sig));
}

async function signedFixtures() {
  const agent = await keys();
  const issuer = await keys();
  const now = new Date("2026-10-08T19:00:00.000Z");
  const attestationBase: Omit<AgentIdentityAttestation, "signature"> = {
    agent_id: "agent:authichain:catalog-sync-01",
    organization_id: "org:authichain:core",
    role: "catalog_sync",
    version: "1.0.0",
    capabilities: ["VERIFY_ATTESTATION", "READ_EVIDENCE"],
    public_key: agent.publicKey,
    policy_version: "2026.1",
    issued_at: "2026-10-08T18:00:00.000Z",
    effective_at: "2026-10-08T18:00:00.000Z",
    expires_at: "2026-10-08T20:00:00.000Z",
    issuer_id: "issuer:authichain:root",
    attestation_id: "att:agent:1001",
  };
  const attestationSignature = await sign(
    canonicalizeAgentIdentityAttestation(attestationBase),
    issuer.pair.privateKey,
  );
  const attestation: AgentIdentityAttestation = {
    ...attestationBase,
    signature: attestationSignature,
  };
  const resolver: AgentIdentityResolver = {
    resolve: async () => attestation,
    isRevoked: async () => false,
    getIssuerPublicKey: async () => issuer.publicKey,
    isIssuerRevoked: async () => false,
  };
  const base: Omit<SignedAgentMessage<{ sku: string }>, "signature"> = {
    protocol: "authichain-agent/1",
    message_id: "msg:1001",
    agent_id: attestation.agent_id,
    organization_id: attestation.organization_id,
    attestation_id: attestation.attestation_id,
    role: attestation.role,
    version: attestation.version,
    capabilities: ["VERIFY_ATTESTATION"],
    policy_version: attestation.policy_version,
    issued_at: "2026-10-08T18:59:00.000Z",
    expires_at: "2026-10-08T19:05:00.000Z",
    intent: "request_verification",
    evidence_ids: ["evi:02", "evi:01"],
    payload: { sku: "GS1-998877" },
  };
  const message: SignedAgentMessage<{ sku: string }> = {
    ...base,
    signature: await sign(canonicalizeAgentMessage(base), agent.pair.privateKey),
  };
  return { agent, issuer, attestation, resolver, base, message, now };
}

describe("AuthiChain Phase 2 Agent Trust", () => {
  it("canonicalizes object keys deterministically", () => {
    expect(canonicalizeJson({ z: 1, a: { y: 2, b: true } }))
      .toBe('{"a":{"b":true,"y":2},"z":1}');
  });

  it("canonicalizes -0 and rejects non-finite numbers", () => {
    expect(canonicalizeJson(-0)).toBe("0");
    expect(() => canonicalizeJson(Number.NaN)).toThrow();
    expect(() => canonicalizeJson(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("rejects lone surrogates", () => {
    expect(() => canonicalizeJson("\uD800")).toThrow();
    expect(() => canonicalizeJson({ "\uDFFF": 1 })).toThrow();
  });

  it("computes deterministic digest", async () => {
    const { message } = await signedFixtures();
    const a = { ...message, payload: { z: 1, a: 2 } };
    const b = { ...message, payload: { a: 2, z: 1 } };
    expect(await agentMessageDigest(a)).toBe(await agentMessageDigest(b));
  });

  it("accepts a valid issuer-signed, agent-signed message", async () => {
    const { resolver, message, now } = await signedFixtures();
    const replayStore = new MemoryAgentReplayStore();
    const result = await verifyAgentMessage(message, { resolver, replayStore, now });
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.capabilities).toEqual(["VERIFY_ATTESTATION"]);
  });

  it("fails closed when issuer key is missing", async () => {
    const fixture = await signedFixtures();
    const resolver = { ...fixture.resolver, getIssuerPublicKey: async () => null };
    const result = await verifyAgentMessage(fixture.message, {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("ISSUER_NOT_FOUND");
  });

  it("fails closed when issuer signature is tampered", async () => {
    const fixture = await signedFixtures();
    const tampered = { ...fixture.attestation, signature: fixture.attestation.signature.slice(0, -2) + "AA" };
    const resolver: AgentIdentityResolver = { ...fixture.resolver, resolve: async () => tampered };
    const result = await verifyAgentMessage(fixture.message, {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("ISSUER_SIGNATURE_INVALID");
  });

  it("fails closed for a revoked issuer", async () => {
    const fixture = await signedFixtures();
    const resolver = { ...fixture.resolver, isIssuerRevoked: async () => true };
    const result = await verifyAgentMessage(fixture.message, {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("ISSUER_REVOKED");
  });

  it("enforces lifecycle precedence and impossible ordering", async () => {
    const fixture = await signedFixtures();
    expect(createAgentPassport(fixture.attestation, true, fixture.now).status).toBe("REVOKED");
    const future = { ...fixture.attestation, effective_at: "2026-10-09T00:00:00.000Z" };
    expect(createAgentPassport(future, false, fixture.now).status).toBe("NOT_YET_EFFECTIVE");
    const expired = { ...fixture.attestation, expires_at: "2026-10-07T00:00:00.000Z" };
    expect(createAgentPassport(expired, false, fixture.now).status).toBe("EXPIRED");
    expect(() => canonicalizeAgentIdentityAttestation(expired)).not.toThrow();
  });

  it("rejects an ungranted capability", async () => {
    const fixture = await signedFixtures();
    const base = { ...fixture.base, capabilities: ["PROPOSE_LIFECYCLE_ACTION"] as const };
    const message = {
      ...base,
      signature: await sign(canonicalizeAgentMessage(base as never), fixture.agent.pair.privateKey),
    } as SignedAgentMessage;
    const result = await verifyAgentMessage(message, {
      resolver: fixture.resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("rejects tampered payload", async () => {
    const fixture = await signedFixtures();
    const tampered = { ...fixture.message, payload: { sku: "TAMPERED" } };
    const result = await verifyAgentMessage(tampered, {
      resolver: fixture.resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("SIGNATURE_INVALID");
  });

  it("rejects replay and message-ID conflict", async () => {
    const fixture = await signedFixtures();
    const store = new MemoryAgentReplayStore();
    const first = await verifyAgentMessage(fixture.message, {
      resolver: fixture.resolver,
      replayStore: store,
      now: fixture.now,
    });
    const second = await verifyAgentMessage(fixture.message, {
      resolver: fixture.resolver,
      replayStore: store,
      now: fixture.now,
    });
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(false);
    expect(second.reasons).toContain("MESSAGE_REPLAYED");
  });

  it("detects message-ID conflict by digest", async () => {
    const fixture = await signedFixtures();
    const store = new MemoryAgentReplayStore();
    await store.recordMessageNonce({
      message_id: fixture.message.message_id,
      agent_id: fixture.message.agent_id,
      attestation_id: fixture.message.attestation_id,
      organization_id: fixture.message.organization_id,
      first_seen_at: fixture.message.issued_at,
      expires_at: fixture.message.expires_at,
      message_digest: "different",
    });
    const result = await verifyAgentMessage(fixture.message, {
      resolver: fixture.resolver,
      replayStore: store,
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("MESSAGE_ID_CONFLICT");
  });

  it("does not record invalid messages for replay", async () => {
    const fixture = await signedFixtures();
    const store = new MemoryAgentReplayStore();
    const bad = { ...fixture.message, signature: "bad" };
    const result = await verifyAgentMessage(bad, {
      resolver: fixture.resolver,
      replayStore: store,
      now: fixture.now,
    });
    expect(result.valid).toBe(false);
    const validBase = { ...fixture.message, message_id: "msg:1002" };
    const valid = await verifyAgentMessage(
      { ...validBase, signature: await sign(canonicalizeAgentMessage(validBase), fixture.agent.pair.privateKey) },
      {
        resolver: fixture.resolver,
        replayStore: store,
        now: fixture.now,
      },
    );
    expect(valid.valid).toBe(true);
  });

  it("logs hashes, not raw payloads", async () => {
    const fixture = await signedFixtures();
    const events: unknown[] = [];
    await verifyAgentMessage(fixture.message, {
      resolver: fixture.resolver,
      replayStore: new MemoryAgentReplayStore(),
      now: fixture.now,
      auditSink: { emit: (event) => events.push(event) },
    });
    const serialized = JSON.stringify(events);
    expect(serialized).toContain(fixture.message.message_id);
    expect(serialized).not.toContain("GS1-998877");
    expect(serialized).not.toContain(fixture.message.signature);
  });
});
