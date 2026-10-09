import { AgentIdentity } from "./agent-types";
import { signCanonicalData, verifyCanonicalSignature } from "./crypto";

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
      expiresAt,
    };

    const signature = signCanonicalData(unsignedData, issuerPrivateKeyPem);

    return {
      passportId,
      identity,
      attestationIds,
      issuedAt,
      expiresAt,
      issuerSignature: signature,
      issuerPublicKey: issuerPublicKeyPem,
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
      expiresAt: passport.expiresAt,
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
      cap =>
        (cap.action === "*" || cap.action === requiredAction) &&
        (cap.resource === "*" || cap.resource === requiredResource)
    );
  }
}
