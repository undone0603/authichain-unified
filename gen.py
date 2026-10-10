import os, subprocess

os.makedirs('src/lib/attestation/__tests__', exist_ok=True)
os.makedirs('src/lib/policy', exist_ok=True)

files = {}

files['src/lib/attestation/types.ts'] = """export type AttestationStatus = 'ISSUED' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUPERSEDED';

export type RevocationReason = 
  | 'KEY_COMPROMISE' 
  | 'SUPERSEDED' 
  | 'CESSATION_OF_OPERATION' 
  | 'PRIVILEGE_WITHDRAWN' 
  | 'UNSPECIFIED';

export interface AttestationHeader {
  alg: 'Ed25519' | 'ES256' | 'HS256';
  typ: 'AuthiChain-Attestation/v1';
  kid?: string;
}

export interface AttestationPayload {
  id: string;
  issuer: string;
  subject: string;
  schemaVersion: string;
  claims: Record<string, any>;
  issuedAt: string;
  expiresAt?: string;
  nonce?: string;
}

export interface SignedAttestation {
  header: AttestationHeader;
  payload: AttestationPayload;
  signature: string;
  publicKey: string;
}

export interface VerificationResult {
  valid: boolean;
  status: AttestationStatus;
  reason?: string;
  attestation?: SignedAttestation;
  verifiedAt: string;
}
"""

files['src/lib/attestation/crypto.ts'] = """import crypto from 'node:crypto';

export function canonicalizeRFC8785(data: unknown): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map((item) => canonicalizeRFC8785(item)).join(',') + ']';
  }

  const obj = data as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      entries.push(JSON.stringify(key) + ':' + canonicalizeRFC8785(obj[key]));
    }
  }

  return '{' + entries.join(',') + '}';
}

export function canonicalToBytes(data: unknown): Uint8Array {
  const canonicalString = canonicalizeRFC8785(data);
  return new TextEncoder().encode(canonicalString);
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

export function signCanonicalData(data: unknown, privateKeyPem: string): string {
  const canonicalBytes = canonicalToBytes(data);
  const signatureBuffer = crypto.sign(null, canonicalBytes, privateKeyPem);
  return signatureBuffer.toString('base64');
}

export function verifyCanonicalSignature(
  data: unknown,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const canonicalBytes = canonicalToBytes(data);
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    return crypto.verify(null, canonicalBytes, publicKeyPem, signatureBuffer);
  } catch (err) {
    return false;
  }
}
"""

files['src/lib/attestation/lifecycle.ts'] = """import { AttestationStatus, RevocationReason } from './types';

export interface AttestationStatusEvent {
  id: string;
  attestation_id: string;
  status: AttestationStatus;
  reason?: RevocationReason | string;
  superseded_by?: string;
  created_at: string;
  created_by: string;
  metadata?: Record<string, any>;
}

export const VALID_TRANSITIONS: Record<AttestationStatus, AttestationStatus[]> = {
  ISSUED: ['ACTIVE', 'REVOKED', 'EXPIRED'],
  ACTIVE: ['REVOKED', 'EXPIRED', 'SUPERSEDED'],
  REVOKED: [],
  EXPIRED: [],
  SUPERSEDED: []
};

export function isValidStatusTransition(
  currentStatus: AttestationStatus,
  nextStatus: AttestationStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function createStatusEvent(
  attestationId: string,
  status: AttestationStatus,
  createdBy: string,
  options?: {
    reason?: RevocationReason | string;
    supersededBy?: string;
    metadata?: Record<string, any>;
  }
): AttestationStatusEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    attestation_id: attestationId,
    status,
    reason: options?.reason,
    superseded_by: options?.supersededBy,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    metadata: options?.metadata
  };
}
"""

files['src/lib/attestation/repository.ts'] = """import { SignedAttestation, AttestationStatus } from './types';
import { AttestationStatusEvent, createStatusEvent, isValidStatusTransition } from './lifecycle';

export class AttestationRepository {
  private attestations: Map<string, SignedAttestation> = new Map();
  private statusEvents: Map<string, AttestationStatusEvent[]> = new Map();

  async saveAttestation(
    attestation: SignedAttestation,
    createdBy: string
  ): Promise<void> {
    const id = attestation.payload.id;
    this.attestations.set(id, attestation);

    const initialEvent = createStatusEvent(id, 'ISSUED', createdBy);
    const events = this.statusEvents.get(id) || [];
    events.push(initialEvent);
    this.statusEvents.set(id, events);
  }

  async getAttestation(id: string): Promise<SignedAttestation | null> {
    return this.attestations.get(id) || null;
  }

  async transitionStatus(
    attestationId: string,
    nextStatus: AttestationStatus,
    createdBy: string,
    options?: {
      reason?: string;
      supersededBy?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AttestationStatusEvent> {
    const currentStatus = await this.getLatestStatus(attestationId);
    if (!currentStatus) {
      throw new Error(`Attestation not found: ${attestationId}`);
    }

    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${nextStatus} for attestation ${attestationId}`
      );
    }

    const event = createStatusEvent(attestationId, nextStatus, createdBy, options);
    const events = this.statusEvents.get(attestationId) || [];
    events.push(event);
    this.statusEvents.set(attestationId, events);

    return event;
  }

  async getLatestStatus(attestationId: string): Promise<AttestationStatus | null> {
    const events = this.statusEvents.get(attestationId);
    if (!events || events.length === 0) return null;

    const attestation = this.attestations.get(attestationId);
    const latestEvent = events[events.length - 1];

    if (
      attestation?.payload.expiresAt &&
      new Date(attestation.payload.expiresAt) <= new Date() &&
      latestEvent.status !== 'REVOKED' &&
      latestEvent.status !== 'SUPERSEDED'
    ) {
      return 'EXPIRED';
    }

    return latestEvent.status;
  }

  async getStatusEvents(attestationId: string): Promise<AttestationStatusEvent[]> {
    return this.statusEvents.get(attestationId) || [];
  }
}
"""

files['src/lib/attestation/agent-types.ts'] = """export type AgentRole = 'VERIFIER' | 'ISSUER' | 'WORKER' | 'ORCHESTRATOR' | 'SYSTEM';

export interface AgentCapability {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  role: AgentRole;
  publicKey: string;
  capabilities: AgentCapability[];
  createdAt: string;
}

export interface AgentMessage {
  messageId: string;
  agentId: string;
  recipientId?: string;
  action: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface SignedAgentMessage {
  message: AgentMessage;
  signature: string;
  publicKey: string;
}
"""

files['src/lib/attestation/service.ts'] = """import { SignedAttestation, AttestationPayload, VerificationResult } from './types';
import { signCanonicalData, verifyCanonicalSignature } from './crypto';
import { AttestationRepository } from './repository';
import { SignedAgentMessage } from './agent-types';

export class AttestationService {
  constructor(private repo: AttestationRepository) {}

  async createAndIssueAttestation(
    payload: AttestationPayload,
    privateKeyPem: string,
    publicKeyPem: string,
    issuerId: string
  ): Promise<SignedAttestation> {
    const dataToSign = {
      header: {
        alg: 'Ed25519',
        typ: 'AuthiChain-Attestation/v1'
      },
      payload
    };

    const signature = signCanonicalData(dataToSign, privateKeyPem);

    const isPreIssuanceValid = verifyCanonicalSignature(
      dataToSign,
      signature,
      publicKeyPem
    );

    if (!isPreIssuanceValid) {
      throw new Error('Pre-issuance signature verification failed.');
    }

    const attestation: SignedAttestation = {
      header: {
        alg: 'Ed25519',
        typ: 'AuthiChain-Attestation/v1'
      },
      payload,
      signature,
      publicKey: publicKeyPem
    };

    await this.repo.saveAttestation(attestation, issuerId);
    await this.repo.transitionStatus(payload.id, 'ACTIVE', issuerId);

    return attestation;
  }

  async verifyAttestation(id: string): Promise<VerificationResult> {
    const verifiedAt = new Date().toISOString();
    const attestation = await this.repo.getAttestation(id);

    if (!attestation) {
      return {
        valid: false,
        status: 'REVOKED',
        reason: 'Attestation not found',
        verifiedAt
      };
    }

    const status = await this.repo.getLatestStatus(id);

    if (status !== 'ACTIVE' && status !== 'ISSUED') {
      return {
        valid: false,
        status: status || 'REVOKED',
        reason: `Attestation is ${status}`,
        attestation,
        verifiedAt
      };
    }

    const dataToVerify = {
      header: attestation.header,
      payload: attestation.payload
    };

    const signatureValid = verifyCanonicalSignature(
      dataToVerify,
      attestation.signature,
      attestation.publicKey
    );

    if (!signatureValid) {
      return {
        valid: false,
        status: 'REVOKED',
        reason: 'Signature verification failed',
        attestation,
        verifiedAt
      };
    }

    return {
      valid: true,
      status: status || 'ACTIVE',
      attestation,
      verifiedAt
    };
  }

  verifyAgentMessage(signedMessage: SignedAgentMessage): boolean {
    const { message, signature, publicKey } = signedMessage;
    return verifyCanonicalSignature(message, signature, publicKey);
  }
}
"""

files['src/lib/attestation/passport.ts'] = """import { AgentIdentity } from './agent-types';
import { signCanonicalData, verifyCanonicalSignature } from './crypto';

export interface AgentPassport {
  passportId: string;
  identity: AgentIdentity;
  attestationIds: string[];
  issuedAt: string;
  expiresAt: string;
  issuerSignature: string;
  issuerPublicKey: string;
}

export class PassportManager {
  static createPassport(
    identity: AgentIdentity,
    attestationIds: string[],
    expiresInMs: number,
    issuerPrivateKeyPem: string,
    issuerPublicKeyPem: string
  ): AgentPassport {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
    const passportId = `pass_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const unsignedData = {
      passportId,
      identity,
      attestationIds,
      issuedAt,
      expiresAt
    };

    const signature = signCanonicalData(unsignedData, issuerPrivateKeyPem);

    return {
      passportId,
      identity,
      attestationIds,
      issuedAt,
      expiresAt,
      issuerSignature: signature,
      issuerPublicKey: issuerPublicKeyPem
    };
  }

  static verifyPassport(passport: AgentPassport): boolean {
    if (new Date(passport.expiresAt) <= new Date()) {
      return false;
    }

    const dataToVerify = {
      passportId: passport.passportId,
      identity: passport.identity,
      attestationIds: passport.attestationIds,
      issuedAt: passport.issuedAt,
      expiresAt: passport.expiresAt
    };

    return verifyCanonicalSignature(
      dataToVerify,
      passport.issuerSignature,
      passport.issuerPublicKey
    );
  }

  static hasCapability(
    passport: AgentPassport,
    requiredAction: string,
    requiredResource: string
  ): boolean {
    if (!this.verifyPassport(passport)) {
      return false;
    }

    return passport.identity.capabilities.some(
      (cap) =>
        (cap.action === '*' || cap.action === requiredAction) &&
        (cap.resource === '*' || cap.resource === requiredResource)
    );
  }
}
"""

files['src/lib/policy/types.ts'] = """export type PolicyEffect = 'ALLOW' | 'DENY';

export interface PolicyCondition {
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'IN' | 'GREATER_THAN' | 'EXISTS';
  value: any;
}

export interface PolicyRule {
  id: string;
  description?: string;
  effect: PolicyEffect;
  roles?: string[];
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[];
}

export interface PolicyContext {
  agentId: string;
  role: string;
  action: string;
  resource: string;
  attestationStatus?: string;
  attributes?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  matchedRuleId?: string;
  reason: string;
  evaluatedAt: string;
}
"""

files['src/lib/policy/engine.ts'] = """import { PolicyRule, PolicyContext, PolicyEvaluationResult, PolicyCondition } from './types';

export class PolicyEngine {
  private rules: PolicyRule[] = [];

  constructor(initialRules: PolicyRule[] = []) {
    this.rules = initialRules;
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  evaluate(context: PolicyContext): PolicyEvaluationResult {
    const evaluatedAt = new Date().toISOString();

    for (const rule of this.rules) {
      if (this.matchesRule(rule, context)) {
        const allowed = rule.effect === 'ALLOW';
        return {
          allowed,
          matchedRuleId: rule.id,
          reason: allowed
            ? `Rule ${rule.id} allowed action '${context.action}' on '${context.resource}'`
            : `Rule ${rule.id} explicitly denied action '${context.action}' on '${context.resource}'`,
          evaluatedAt
        };
      }
    }

    return {
      allowed: false,
      reason: `Default deny: No matching policy rule for action '${context.action}' on '${context.resource}'`,
      evaluatedAt
    };
  }

  private matchesRule(rule: PolicyRule, context: PolicyContext): boolean {
    const actionMatches = rule.actions.includes('*') || rule.actions.includes(context.action);
    if (!actionMatches) return false;

    const resourceMatches = rule.resources.includes('*') || rule.resources.includes(context.resource);
    if (!resourceMatches) return false;

    if (rule.roles && rule.roles.length > 0) {
      if (!rule.roles.includes('*') && !rule.roles.includes(context.role)) {
        return false;
      }
    }

    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case 'EQUALS':
        return fieldValue === condition.value;
      case 'CONTAINS':
        return Array.isArray(fieldValue)
          ? fieldValue.includes(condition.value)
          : String(fieldValue).includes(String(condition.value));
      case 'IN':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'GREATER_THAN':
        return fieldValue > condition.value;
      case 'EXISTS':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  private getFieldValue(fieldPath: string, context: PolicyContext): any {
    const parts = fieldPath.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }
}
"""

files['src/lib/attestation/__tests__/trust-layer.test.ts'] = """import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, signCanonicalData, verifyCanonicalSignature, canonicalizeRFC8785 } from '../crypto';
import { AttestationRepository } from '../repository';
import { AttestationService } from '../service';
import { PassportManager } from '../passport';
import { PolicyEngine } from '../../policy/engine';
import { SignedAgentMessage, AgentIdentity } from '../agent-types';

describe('AuthiChain Trust, Attestation, and Agent Identity Layer', () => {
  let keyPair: { publicKey: string; privateKey: string };
  let repository: AttestationRepository;
  let service: AttestationService;

  beforeEach(() => {
    keyPair = generateKeyPair();
    repository = new AttestationRepository();
    service = new AttestationService(repository);
  });

  describe('RFC 8785 Canonical Byte Signing & Verification (Double-Hashing Resolution)', () => {
    it('produces deterministic RFC 8785 JCS canonical string regardless of key insertion order', () => {
      const objA = { z: 1, a: 'test', m: { y: 2, b: 3 } };
      const objB = { a: 'test', m: { b: 3, y: 2 }, z: 1 };

      const canonA = canonicalizeRFC8785(objA);
      const canonB = canonicalizeRFC8785(objB);

      expect(canonA).toBe(canonB);
      expect(canonA).toBe('{"a":"test","m":{"b":3,"y":2},"z":1}');
    });

    it('signs and verifies direct canonical bytes without double-hashing', () => {
      const payload = { id: 'att_123', claim: 'valid', timestamp: 1700000000 };
      const signature = signCanonicalData(payload, keyPair.privateKey);

      const isValid = verifyCanonicalSignature(payload, signature, keyPair.publicKey);
      expect(isValid).toBe(true);

      const isTamperedValid = verifyCanonicalSignature(
        { ...payload, claim: 'tampered' },
        signature,
        keyPair.publicKey
      );
      expect(isTamperedValid).toBe(false);
    });
  });

  describe('Attestation Lifecycle & Supabase Schema Match', () => {
    it('issues attestation with pre-issuance signature verification', async () => {
      const payload = {
        id: 'att_001',
        issuer: 'did:authichain:issuer_1',
        subject: 'did:authichain:agent_1',
        schemaVersion: '1.0.0',
        claims: { trustScore: 95 },
        issuedAt: new Date().toISOString()
      };

      const signedAttestation = await service.createAndIssueAttestation(
        payload,
        keyPair.privateKey,
        keyPair.publicKey,
        'issuer_1'
      );

      expect(signedAttestation.payload.id).toBe('att_001');

      const verification = await service.verifyAttestation('att_001');
      expect(verification.valid).toBe(true);
      expect(verification.status).toBe('ACTIVE');
    });

    it('enforces status transition matrix matching attestation_status_events schema', async () => {
      const payload = {
        id: 'att_002',
        issuer: 'issuer_1',
        subject: 'agent_1',
        schemaVersion: '1.0.0',
        claims: {},
        issuedAt: new Date().toISOString()
      };

      await service.createAndIssueAttestation(payload, keyPair.privateKey, keyPair.publicKey, 'issuer_1');

      const revokeEvent = await repository.transitionStatus('att_002', 'REVOKED', 'admin', {
        reason: 'KEY_COMPROMISE'
      });

      expect(revokeEvent.status).toBe('REVOKED');
      expect(revokeEvent.reason).toBe('KEY_COMPROMISE');

      const verification = await service.verifyAttestation('att_002');
      expect(verification.valid).toBe(false);
      expect(verification.status).toBe('REVOKED');

      await expect(
        repository.transitionStatus('att_002', 'ACTIVE', 'admin')
      ).rejects.toThrow(/Invalid status transition/);
    });

    it('supports supersession chaining in repository', async () => {
      const payload1 = {
        id: 'att_old',
        issuer: 'issuer_1',
        subject: 'agent_1',
        schemaVersion: '1.0.0',
        claims: { v: 1 },
        issuedAt: new Date().toISOString()
      };

      await service.createAndIssueAttestation(payload1, keyPair.privateKey, keyPair.publicKey, 'issuer_1');

      await repository.transitionStatus('att_old', 'SUPERSEDED', 'issuer_1', {
        reason: 'SUPERSEDED',
        supersededBy: 'att_new'
      });

      const latestStatus = await repository.getLatestStatus('att_old');
      expect(latestStatus).toBe('SUPERSEDED');

      const events = await repository.getStatusEvents('att_old');
      expect(events.length).toBe(3);
      expect(events[2].superseded_by).toBe('att_new');
    });
  });

  describe('Agent Identity & Message Verification', () => {
    it('verifies agent message using direct RFC 8785 byte signature verification', () => {
      const message = {
        messageId: 'msg_001',
        agentId: 'agent_99',
        action: 'EXECUTE_WORKFLOW',
        payload: { target: 'database' },
        timestamp: new Date().toISOString()
      };

      const signature = signCanonicalData(message, keyPair.privateKey);

      const signedMessage: SignedAgentMessage = {
        message,
        signature,
        publicKey: keyPair.publicKey
      };

      const isValid = service.verifyAgentMessage(signedMessage);
      expect(isValid).toBe(true);
    });
  });

  describe('Agent Passport Manager', () => {
    it('creates, verifies, and checks capabilities for AgentPassport', () => {
      const identity: AgentIdentity = {
        agentId: 'agent_42',
        name: 'Autonomous Worker',
        role: 'WORKER',
        publicKey: keyPair.publicKey,
        capabilities: [
          { action: 'READ', resource: 'telemetry' },
          { action: 'WRITE', resource: 'logs' }
        ],
        createdAt: new Date().toISOString()
      };

      const passport = PassportManager.createPassport(
        identity,
        ['att_001'],
        60000,
        keyPair.privateKey,
        keyPair.publicKey
      );

      const isValid = PassportManager.verifyPassport(passport);
      expect(isValid).toBe(true);

      const canReadTelemetry = PassportManager.hasCapability(passport, 'READ', 'telemetry');
      expect(canReadTelemetry).toBe(true);

      const canDeleteDb = PassportManager.hasCapability(passport, 'DELETE', 'database');
      expect(canDeleteDb).toBe(false);
    });
  });

  describe('Policy Engine Evaluation', () => {
    it('evaluates ALLOW and DENY rules correctly', () => {
      const engine = new PolicyEngine([
        {
          id: 'rule_deny_revoked',
          effect: 'DENY',
          actions: ['*'],
          resources: ['*'],
          conditions: [
            { field: 'attestationStatus', operator: 'EQUALS', value: 'REVOKED' }
          ]
        },
        {
          id: 'rule_allow_worker',
          effect: 'ALLOW',
          roles: ['WORKER'],
          actions: ['READ', 'WRITE'],
          resources: ['logs', 'telemetry']
        }
      ]);

      const allowedContext = {
        agentId: 'agent_1',
        role: 'WORKER',
        action: 'READ',
        resource: 'logs',
        attestationStatus: 'ACTIVE'
      };

      const resultAllowed = engine.evaluate(allowedContext);
      expect(resultAllowed.allowed).toBe(true);

      const revokedContext = {
        agentId: 'agent_1',
        role: 'WORKER',
        action: 'READ',
        resource: 'logs',
        attestationStatus: 'REVOKED'
      };

      const resultDenied = engine.evaluate(revokedContext);
      expect(resultDenied.allowed).toBe(false);
      expect(resultDenied.matchedRuleId).toBe('rule_deny_revoked');
    });
  });
});
"""

for path, code in files.items():
    with open(path, 'w') as f:
        f.write(code.strip() + '\n')
    print('CREATED:', path)

