import * as jose from "jose";
import { Attestation, Identity, Evidence } from "./types";

export class AttestationEngine {
  private privateKey: ReturnType<typeof jose.importPKCS8>;
  private publicKey: ReturnType<typeof jose.importSPKI>;

  constructor(privateKeyPem: string, publicKeyPem: string) {
    this.privateKey = jose.importPKCS8(privateKeyPem, "EdDSA");
    this.publicKey = jose.importSPKI(publicKeyPem, "EdDSA");
  }

  async createAttestation(
    objectId: string,
    identity: Identity,
    evidence: Evidence[],
    decision: Attestation["decision"]
  ): Promise<Attestation> {
    const payload = {
      objectId,
      decision,
      issuer: "Authichain-Core",
      subject: identity,
      evidence,
      status: "active" as const,
      verifiedAt: new Date().toISOString(),
    };

    const signedJwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "EdDSA", kid: "authichain-core-01" })
      .setIssuedAt()
      .setIssuer("Authichain-Core")
      .setSubject(objectId)
      .sign(await this.privateKey);

    return {
      ...payload,
      signature: {
        alg: "EdDSA",
        kid: "authichain-core-01",
        value: signedJwt,
      },
    };
  }

  async verifyAttestation(
    jwt: string
  ): Promise<{ verified: boolean; payload?: any; error?: string }> {
    try {
      const { payload } = await jose.jwtVerify(jwt, await this.publicKey, {
        issuer: "Authichain-Core",
      });
      return { verified: true, payload };
    } catch (e: any) {
      return { verified: false, error: e.message };
    }
  }
}
