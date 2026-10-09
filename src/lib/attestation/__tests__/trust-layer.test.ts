import { describe, it, expect, beforeEach } from "vitest";
import {
  generateKeyPair,
  signCanonicalData,
  verifyCanonicalSignature,
  canonicalizeRFC8785,
} from "../crypto";
import { AttestationRepository } from "../repository";
import { AttestationService } from "../service";
import { PassportManager } from "../passport";
import { PolicyEngine } from "../../policy/engine";
import { SignedAgentMessage, AgentIdentity } from "../agent-types";

describe("AuthiChain Trust, Attestation, and Agent Identity Layer", () => {
  let keyPair: { publicKey: string; privateKey: string };
  let repository: AttestationRepository;
  let service: AttestationService;

  beforeEach(() => {
    keyPair = generateKeyPair();
    repository = new AttestationRepository();
    service = new AttestationService(repository);
  });

  describe("RFC 8785 Canonical Byte Signing & Verification (Double-Hashing Resolution)", () => {
    it("produces deterministic RFC 8785 JCS canonical string regardless of key insertion order", () => {
      const objA = { z: 1, a: "test", m: { y: 2, b: 3 } };
      const objB = { a: "test", m: { b: 3, y: 2 }, z: 1 };

      const canonA = canonicalizeRFC8785(objA);
      const canonB = canonicalizeRFC8785(objB);

      expect(canonA).toBe(canonB);
      expect(canonA).toBe('{"a":"test","m":{"b":3,"y":2},"z":1}');
    });

    it("signs and verifies direct canonical bytes without double-hashing", () => {
      const payload = { id: "att_123", claim: "valid", timestamp: 1700000000 };
      const signature = signCanonicalData(payload, keyPair.privateKey);

      const isValid = verifyCanonicalSignature(
        payload,
        signature,
        keyPair.publicKey
      );
      expect(isValid).toBe(true);

      const isTamperedValid = verifyCanonicalSignature(
        { ...payload, claim: "tampered" },
        signature,
        keyPair.publicKey
      );
      expect(isTamperedValid).toBe(false);
    });
  });

  describe("Attestation Lifecycle & Supabase Schema Match", () => {
    it("issues attestation with pre-issuance signature verification", async () => {
      const payload = {
        id: "att_001",
        issuer: "did:authichain:issuer_1",
        subject: "did:authichain:agent_1",
        schemaVersion: "1.0.0",
        claims: { trustScore: 95 },
        issuedAt: new Date().toISOString(),
      };

      const signedAttestation = await service.createAndIssueAttestation(
        payload,
        keyPair.privateKey,
        keyPair.publicKey,
        "issuer_1"
      );

      expect(signedAttestation.payload.id).toBe("att_001");

      const verification = await service.verifyAttestation("att_001");
      expect(verification.valid).toBe(true);
      expect(verification.status).toBe("ACTIVE");
    });

    it("enforces status transition matrix matching attestation_status_events schema", async () => {
      const payload = {
        id: "att_002",
        issuer: "issuer_1",
        subject: "agent_1",
        schemaVersion: "1.0.0",
        claims: {},
        issuedAt: new Date().toISOString(),
      };

      await service.createAndIssueAttestation(
        payload,
        keyPair.privateKey,
        keyPair.publicKey,
        "issuer_1"
      );

      const revokeEvent = await repository.transitionStatus(
        "att_002",
        "REVOKED",
        "admin",
        {
          reason: "KEY_COMPROMISE",
        }
      );

      expect(revokeEvent.status).toBe("REVOKED");
      expect(revokeEvent.reason).toBe("KEY_COMPROMISE");

      const verification = await service.verifyAttestation("att_002");
      expect(verification.valid).toBe(false);
      expect(verification.status).toBe("REVOKED");

      await expect(
        repository.transitionStatus("att_002", "ACTIVE", "admin")
      ).rejects.toThrow(/Invalid status transition/);
    });

    it("supports supersession chaining in repository", async () => {
      const payload1 = {
        id: "att_old",
        issuer: "issuer_1",
        subject: "agent_1",
        schemaVersion: "1.0.0",
        claims: { v: 1 },
        issuedAt: new Date().toISOString(),
      };

      await service.createAndIssueAttestation(
        payload1,
        keyPair.privateKey,
        keyPair.publicKey,
        "issuer_1"
      );

      await repository.transitionStatus("att_old", "SUPERSEDED", "issuer_1", {
        reason: "SUPERSEDED",
        supersededBy: "att_new",
      });

      const latestStatus = await repository.getLatestStatus("att_old");
      expect(latestStatus).toBe("SUPERSEDED");

      const events = await repository.getStatusEvents("att_old");
      expect(events.length).toBe(3);
      expect(events[2].superseded_by).toBe("att_new");
    });
  });

  describe("Agent Identity & Message Verification", () => {
    it("verifies agent message using direct RFC 8785 byte signature verification", () => {
      const message = {
        messageId: "msg_001",
        agentId: "agent_99",
        action: "EXECUTE_WORKFLOW",
        payload: { target: "database" },
        timestamp: new Date().toISOString(),
      };

      const signature = signCanonicalData(message, keyPair.privateKey);

      const signedMessage: SignedAgentMessage = {
        message,
        signature,
        publicKey: keyPair.publicKey,
      };

      const isValid = service.verifyAgentMessage(signedMessage);
      expect(isValid).toBe(true);
    });
  });

  describe("Agent Passport Manager", () => {
    it("creates, verifies, and checks capabilities for AgentPassport", () => {
      const identity: AgentIdentity = {
        agentId: "agent_42",
        name: "Autonomous Worker",
        role: "WORKER",
        publicKey: keyPair.publicKey,
        capabilities: [
          { action: "READ", resource: "telemetry" },
          { action: "WRITE", resource: "logs" },
        ],
        createdAt: new Date().toISOString(),
      };

      const passport = PassportManager.createPassport(
        identity,
        ["att_001"],
        60000,
        keyPair.privateKey,
        keyPair.publicKey
      );

      const isValid = PassportManager.verifyPassport(passport);
      expect(isValid).toBe(true);

      const canReadTelemetry = PassportManager.hasCapability(
        passport,
        "READ",
        "telemetry"
      );
      expect(canReadTelemetry).toBe(true);

      const canDeleteDb = PassportManager.hasCapability(
        passport,
        "DELETE",
        "database"
      );
      expect(canDeleteDb).toBe(false);
    });
  });

  describe("Policy Engine Evaluation", () => {
    it("evaluates ALLOW and DENY rules correctly", () => {
      const engine = new PolicyEngine([
        {
          id: "rule_deny_revoked",
          effect: "DENY",
          actions: ["*"],
          resources: ["*"],
          conditions: [
            {
              field: "attestationStatus",
              operator: "EQUALS",
              value: "REVOKED",
            },
          ],
        },
        {
          id: "rule_allow_worker",
          effect: "ALLOW",
          roles: ["WORKER"],
          actions: ["READ", "WRITE"],
          resources: ["logs", "telemetry"],
        },
      ]);

      const allowedContext = {
        agentId: "agent_1",
        role: "WORKER",
        action: "READ",
        resource: "logs",
        attestationStatus: "ACTIVE",
      };

      const resultAllowed = engine.evaluate(allowedContext);
      expect(resultAllowed.allowed).toBe(true);

      const revokedContext = {
        agentId: "agent_1",
        role: "WORKER",
        action: "READ",
        resource: "logs",
        attestationStatus: "REVOKED",
      };

      const resultDenied = engine.evaluate(revokedContext);
      expect(resultDenied.allowed).toBe(false);
      expect(resultDenied.matchedRuleId).toBe("rule_deny_revoked");
    });
  });
});
