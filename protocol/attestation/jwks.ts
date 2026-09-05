import * as jose from "jose";

export async function generateJWKS(publicKeyPem: string) {
  const publicKey = await jose.importSPKI(publicKeyPem, "EdDSA");
  const jwk = await jose.exportJWK(publicKey);

  // Standard JWK fields for Ed25519
  return {
    keys: [
      {
        ...jwk,
        kid: "authichain-core-01",
        use: "sig",
        alg: "EdDSA",
      },
    ],
  };
}
