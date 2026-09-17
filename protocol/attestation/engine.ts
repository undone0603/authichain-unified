import * as jose from "jose";
import { Attestation, Identity, Evidence } from "./types";

export class AttestationEngine {
  private readonly privateKeyPem?: string;
  private readonly publicKeyPem?: string;

  constructor(privateKeyPem?: string, publicKeyPem?: string) {
    this.privateKeyPem = privateKeyPem;
    this.publicKeyPem = publicKeyPem;
  }

  private async getPrivateKey(): Promise<jose.CryptoKey> {
    const privateKeyPem =
      this.privateKeyPem ||
      (process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64
        ? Buffer.from(
            process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64,
            "base64"
          ).toString("utf8")
        : process.env.AUTHICHAIN_PRIVATE_KEY);

    if (!privateKeyPem) {
      throw new Error(
        "AuthiChain attestation private key is not configured; set AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64"
      );
    }

    return jose.importPKCS8(privateKeyPem, "EdDSA");
  }

  private async getPublicKey(): Promise<jose.CryptoKey> {
    const publicKeyPem = this.publicKeyPem || process.env.AUTHICHAIN_PUBLIC_KEY;
    if (publicKeyPem) return jose.importSPKI(publicKeyPem, "EdDSA");

    const privateKey = await this.getPrivateKey();
    return jose.exportJWK(await jose.exportSPKI(privateKey).catch(() => {
      throw new Error("Unable to derive AuthiChain public key from private key");
    }) as never) as never;
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

    const privateKey = await this.getPrivateKey();
    const signedJwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "EdDSA", kid: "authichain-core-01" })
      .setIssuedAt()
      .setIssuer("Authichain-Core")
      .setSubject(objectId)
      .sign(privateKey);

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
      const publicKeyPem = this.publicKeyPem || process.env.AUTHICHAIN_PUBLIC_KEY;
      const publicKey = publicKeyPem
        ? await jose.importSPKI(publicKeyPem, "EdDSA")
        : await jose.importJWK(
            await jose.exportJWK(
              await jose.exportJWK(await this.getPrivateKey()).then((jwk) => {
                const { d: _private, ...publicJwk } = jwk as jose.JWK;
                return publicJwk;
              })
            ),
            "EdDSA"
          );
      const { payload } = await jose.jwtVerify(jwt, publicKey, {
        issuer: "Authichain-Core",
      });
      return { verified: true, payload };
    } catch (e: any) {
      return { verified: false, error: e.message };
    }
  }
}
