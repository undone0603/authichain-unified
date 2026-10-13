import type { AgentIdentityAttestation, AgentIdentityResolver, AgentPassport } from "./agent-types";
import { normalizeCapabilities } from "./agent-types";
import {
  canonicalizeAgentIdentityAttestation,
  canonicalizeAgentMessage,
  type SignedAgentMessage,
} from "./agent-message";
import { createAgentPassport } from "./agent-verifier";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function generateP256(): Promise<{ privateKey: CryptoKey; publicKeyJwk: string }> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  return {
    privateKey: pair.privateKey,
    publicKeyJwk: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  };
}

/** Standard base64, matching the verifier's existing fixtures. */
export async function signCanonical(canonical: string, privateKey: CryptoKey): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(canonical),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export interface IssuedAgentIdentity {
  attestation: AgentIdentityAttestation;
  /** Held by the caller. MemoryAgentRegistry does not store private keys. */
  privateKey: CryptoKey;
  /**
   * Derived view. `status` is not inside the signed attestation: revocation
   * happens after issuance and must be able to change status without rewriting
   * the issuer signature.
   */
  passport: AgentPassport;
}

export async function issueAgentIdentity(input: {
  agentId: string;
  organizationId: string;
  role: string;
  version: string;
  capabilities: readonly string[];
  policyVersion: string;
  issuerId: string;
  attestationId: string;
  issuedAt: string;
  effectiveAt: string;
  expiresAt?: string;
  issuerPrivateKey: CryptoKey;
  now?: Date;
}): Promise<IssuedAgentIdentity> {
  const capabilities = normalizeCapabilities([...input.capabilities]);
  if (capabilities.length === 0) {
    throw new Error("Agent identity requires at least one capability");
  }
  const generated = await generateP256();
  const unsigned: Omit<AgentIdentityAttestation, "signature"> = {
    agent_id: input.agentId,
    organization_id: input.organizationId,
    role: input.role,
    version: input.version,
    capabilities,
    public_key: generated.publicKeyJwk,
    policy_version: input.policyVersion,
    issued_at: input.issuedAt,
    effective_at: input.effectiveAt,
    ...(input.expiresAt === undefined ? {} : { expires_at: input.expiresAt }),
    issuer_id: input.issuerId,
    attestation_id: input.attestationId,
  };
  const signature = await signCanonical(
    canonicalizeAgentIdentityAttestation(unsigned),
    input.issuerPrivateKey,
  );
  const attestation: AgentIdentityAttestation = { ...unsigned, signature };
  const now = input.now ?? new Date(input.effectiveAt);
  return {
    attestation,
    privateKey: generated.privateKey,
    passport: createAgentPassport(attestation, false, now),
  };
}

export async function signAgentMessage<T>(
  message: Omit<SignedAgentMessage<T>, "signature">,
  privateKey: CryptoKey,
): Promise<SignedAgentMessage<T>> {
  const signature = await signCanonical(canonicalizeAgentMessage(message), privateKey);
  return { ...message, signature };
}

/**
 * In-memory issuer and attestation registry. Implements the existing
 * AgentIdentityResolver. Private keys are never accepted here.
 */
export class MemoryAgentRegistry implements AgentIdentityResolver {
  private readonly issuers = new Map<string, { publicKey: string; revoked: boolean }>();
  private readonly attestations = new Map<string, AgentIdentityAttestation>();
  private readonly revoked = new Set<string>();

  registerIssuer(issuerId: string, publicKeyJwk: string): void {
    this.issuers.set(issuerId, { publicKey: publicKeyJwk, revoked: false });
  }

  revokeIssuer(issuerId: string): void {
    const existing = this.issuers.get(issuerId);
    if (existing) existing.revoked = true;
  }

  put(attestation: AgentIdentityAttestation): void {
    this.attestations.set(key(attestation.agent_id, attestation.attestation_id), attestation);
  }

  revoke(attestationId: string): void {
    this.revoked.add(attestationId);
  }

  async resolve(agentId: string, attestationId: string): Promise<AgentIdentityAttestation | null> {
    return this.attestations.get(key(agentId, attestationId)) ?? null;
  }

  async isRevoked(attestationId: string): Promise<boolean> {
    return this.revoked.has(attestationId);
  }

  async getIssuerPublicKey(issuerId: string): Promise<string | null> {
    return this.issuers.get(issuerId)?.publicKey ?? null;
  }

  async isIssuerRevoked(issuerId: string): Promise<boolean> {
    return this.issuers.get(issuerId)?.revoked ?? false;
  }
}

function key(agentId: string, attestationId: string): string {
  return `${agentId}\n${attestationId}`;
}
