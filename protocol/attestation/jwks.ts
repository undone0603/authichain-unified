import * as jose from "jose";

export async function generateJWKS(publicKeyPem: string) {
  const publicKey = await jose.importSPKI(publicKeyPem, "EdDSA");
  const jwk = await jose.exportJWK(publicKey);

  // Ed25519 is production. ML-DSA-65 (FIPS 204) is reserved in the QFS-ready
  // profile (protocol/qfs) until a FIPS-validated implementation is wired here.
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
