import { describe, expect, it } from "vitest";
import type { AgentAuditEvent, AgentCapability, AgentIdentityAttestation, AgentIdentityResolver } from "./agent-types";
import {
  canonicalizeAgentIdentityAttestation,
  canonicalizeAgentMessage,
  type SignedAgentMessage,
} from "./agent-message";
import { MemoryAgentReplayStore } from "./agent-store";
import { verifyAgentMessage } from "./agent-verifier";

/**
 * Being able to reach an endpoint is not authority to act there. Before this,
 * verifyAgentMessage only checked that the capabilities a message claimed were
 * granted; nothing tied them to the action, so a message presenting
 * READ_EVIDENCE was accepted by a caller about to revoke an attestation.
 */

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function keyPair() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { pair, publicKey: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)) };
}

async function sign(value: string, key: CryptoKey) {
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, key, new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}

const now = new Date("2026-10-15T12:00:00.000Z");

async function setup(granted: AgentCapability[]) {
  const agent = await keyPair();
  const issuer = await keyPair();
  const base: Omit<AgentIdentityAttestation, "signature"> = {
    agent_id: "agent:authichain:guardian-01",
    organization_id: "org:authichain:core",
    role: "guardian",
    version: "1.0.0",
    capabilities: granted,
    public_key: agent.publicKey,
    policy_version: "2026.1",
    issued_at: "2026-10-15T00:00:00.000Z",
    effective_at: "2026-10-15T00:00:00.000Z",
    expires_at: "2026-10-16T00:00:00.000Z",
    issuer_id: "issuer:authichain:root",
    attestation_id: "att:agent:guardian-01",
  };
  const attestation: AgentIdentityAttestation = {
    ...base,
    signature: await sign(canonicalizeAgentIdentityAttestation(base), issuer.pair.privateKey),
  };
  const resolver: AgentIdentityResolver = {
    resolve: async () => attestation,
    isRevoked: async () => false,
    getIssuerPublicKey: async () => issuer.publicKey,
    isIssuerRevoked: async () => false,
  };
  let n = 0;
  const message = async (presented: AgentCapability[], intent: string) => {
    const unsigned: Omit<SignedAgentMessage<{ attestation_id: string }>, "signature"> = {
      protocol: "authichain-agent/1",
      message_id: `msg:bind:${++n}`,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      role: attestation.role,
      version: attestation.version,
      capabilities: presented,
      policy_version: attestation.policy_version,
      issued_at: "2026-10-15T11:59:00.000Z",
      expires_at: "2026-10-15T12:05:00.000Z",
      intent,
      evidence_ids: ["evi:1"],
      payload: { attestation_id: "urn:authichain:attestation:v01:x" },
    };
    return {
      ...unsigned,
      signature: await sign(canonicalizeAgentMessage(unsigned), agent.pair.privateKey),
    } as SignedAgentMessage;
  };
  return { resolver, message };
}

describe("agent action requires a declared capability", () => {
  it("authorizes when the message presents the capability the action needs", async () => {
    const { resolver, message } = await setup(["READ_EVIDENCE", "PROPOSE_LIFECYCLE_ACTION"]);
    const result = await verifyAgentMessage(await message(["PROPOSE_LIFECYCLE_ACTION"], "propose_revocation"), {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now,
      requiredCapability: "PROPOSE_LIFECYCLE_ACTION",
      expectedIntent: "propose_revocation",
    });
    expect(result).toMatchObject({ valid: true, reasons: [], capabilities: ["PROPOSE_LIFECYCLE_ACTION"] });
  });

  it("refuses a valid message whose presented capability is not the one the action needs", async () => {
    const { resolver, message } = await setup(["READ_EVIDENCE", "PROPOSE_LIFECYCLE_ACTION"]);
    const result = await verifyAgentMessage(await message(["READ_EVIDENCE"], "propose_revocation"), {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now,
      requiredCapability: "PROPOSE_LIFECYCLE_ACTION",
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toEqual(["CAPABILITY_NOT_GRANTED"]);
  });

  it("refuses an action capability the attestation never granted, even if the message claims it", async () => {
    const { resolver, message } = await setup(["READ_EVIDENCE"]);
    const result = await verifyAgentMessage(await message(["PROPOSE_LIFECYCLE_ACTION"], "propose_revocation"), {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now,
      requiredCapability: "PROPOSE_LIFECYCLE_ACTION",
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("CAPABILITY_NOT_GRANTED");
  });

  it("fails closed when an authorizing caller does not say what the action requires", async () => {
    const { resolver, message } = await setup(["VERIFY_ATTESTATION"]);
    const events: AgentAuditEvent[] = [];
    const store = new MemoryAgentReplayStore();
    const msg = await message(["VERIFY_ATTESTATION"], "request_verification");
    const result = await verifyAgentMessage(msg, {
      resolver,
      replayStore: store,
      now,
      auditSink: { emit: e => void events.push(e) },
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toEqual(["CAPABILITY_REQUIREMENT_MISSING"]);
    expect(events.map(e => e.event_type)).toEqual(["CAPABILITY_DENIED"]);
    // A refused message is not used up: the same message still works once the
    // caller declares the requirement.
    const retry = await verifyAgentMessage(msg, { resolver, replayStore: store, now, requiredCapability: "VERIFY_ATTESTATION" });
    expect(retry.valid).toBe(true);
  });

  it("inspect mode (public pages) does not need a requirement and never uses the message up", async () => {
    const { resolver, message } = await setup(["PRESENT_ONE_OFFER"]);
    const result = await verifyAgentMessage(await message(["PRESENT_ONE_OFFER"], "present_one_draft"), {
      resolver,
      replayStore: {
        recordMessageNonce: async () => {
          throw new Error("inspect must not touch the replay store");
        },
        purgeExpiredNonces: async () => 0,
      },
      now,
      mode: "inspect",
    });
    expect(result.valid).toBe(true);
  });

  it("refuses a message signed for one action when presented to another (confused deputy)", async () => {
    const { resolver, message } = await setup(["PROPOSE_LIFECYCLE_ACTION"]);
    const result = await verifyAgentMessage(await message(["PROPOSE_LIFECYCLE_ACTION"], "propose_supersede"), {
      resolver,
      replayStore: new MemoryAgentReplayStore(),
      now,
      requiredCapability: "PROPOSE_LIFECYCLE_ACTION",
      expectedIntent: "propose_revocation",
    });
    expect(result.valid).toBe(false);
    expect(result.reasons).toEqual(["INTENT_MISMATCH"]);
  });
});
