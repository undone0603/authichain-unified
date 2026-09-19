import * as jose from "jose";

export async function generateJWKS(
  publicKeyPem?: string,
  privateKeyPem?: string
) {
  let publicKey: jose.CryptoKey;

  if (publicKeyPem) {
    publicKey = await jose.importSPKI(publicKeyPem, "EdDSA");
  } else if (privateKeyPem) {
    const privateKey = await jose.importPKCS8(privateKeyPem, "EdDSA");
    const privateJwk = await jose.exportJWK(privateKey);
    const { d: _private, ...publicJwk } = privateJwk as jose.JWK;
    publicKey = await jose.importJWK(publicJwk, "EdDSA");
  } else {
    throw new Error(
      "AuthiChain attestation key is not configured; set AUTHICHAIN_PUBLIC_KEY or AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64"
    );
  }

  const jwk = await jose.exportJWK(publicKey);

  // Ed25519 is production. ML-DSA-65 (FIPS 204) is reserved in the QFS-ready
  // profile (protocol/qfs) until a FIPS-validated implementation is wired here.
  return {
    keys: [
      {
        ...jwk,
        kid: process.env.AUTHICHAIN_ATTESTATION_KEY_ID || "authichain-core-01",
        use: "sig",
        alg: "EdDSA",
      },
    ],
  };
}
