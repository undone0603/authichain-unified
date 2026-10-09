import {
  SignedAttestation,
  AttestationPayload,
  VerificationResult,
} from "./types";
import { signCanonicalData, verifyCanonicalSignature } from "./crypto";
import { AttestationRepository } from "./repository";
import { SignedAgentMessage } from "./agent-types";

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
        alg: "Ed25519",
        typ: "AuthiChain-Attestation/v1",
      },
      payload,
    };

    const signature = signCanonicalData(dataToSign, privateKeyPem);

    const isPreIssuanceValid = verifyCanonicalSignature(
      dataToSign,
      signature,
      publicKeyPem
    );

    if (!isPreIssuanceValid) {
      throw new Error("Pre-issuance signature verification failed.");
    }

    const attestation: SignedAttestation = {
      header: {
        alg: "Ed25519",
        typ: "AuthiChain-Attestation/v1",
      },
      payload,
      signature,
      publicKey: publicKeyPem,
    };

    await this.repo.saveAttestation(attestation, issuerId);
    await this.repo.transitionStatus(payload.id, "ACTIVE", issuerId);

    return attestation;
  }

  async verifyAttestation(id: string): Promise<VerificationResult> {
    const verifiedAt = new Date().toISOString();
    const attestation = await this.repo.getAttestation(id);

    if (!attestation) {
      return {
        valid: false,
        status: "REVOKED",
        reason: "Attestation not found",
        verifiedAt,
      };
    }

    const status = await this.repo.getLatestStatus(id);

    if (status !== "ACTIVE" && status !== "ISSUED") {
      return {
        valid: false,
        status: status || "REVOKED",
        reason: `Attestation is ${status}`,
        attestation,
        verifiedAt,
      };
    }

    const dataToVerify = {
      header: attestation.header,
      payload: attestation.payload,
    };

    const signatureValid = verifyCanonicalSignature(
      dataToVerify,
      attestation.signature,
      attestation.publicKey
    );

    if (!signatureValid) {
      return {
        valid: false,
        status: "REVOKED",
        reason: "Signature verification failed",
        attestation,
        verifiedAt,
      };
    }

    return {
      valid: true,
      status: status || "ACTIVE",
      attestation,
      verifiedAt,
    };
  }

  verifyAgentMessage(signedMessage: SignedAgentMessage): boolean {
    const { message, signature, publicKey } = signedMessage;
    return verifyCanonicalSignature(message, signature, publicKey);
  }
}
