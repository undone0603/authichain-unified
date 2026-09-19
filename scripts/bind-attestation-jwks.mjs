#!/usr/bin/env node
/**
 * Generate (or derive) the v0.1 Ed25519 attestation material used by
 * deploy-cloudflare.yml. Writes:
 *   /tmp/attest-pkcs8.b64  — base64(PKCS#8 PEM)
 *   /tmp/attest-pub.jwk    — {"kty":"OKP","crv":"Ed25519","x":"..."}
 *
 * Workers WebCrypto imports PKCS#8 as { name: "Ed25519" }, not "EdDSA".
 * Publishing the public JWK lets GET /protocol/jwks.json succeed even if
 * jose importPKCS8 is unavailable in the Worker runtime.
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey } from "node:crypto";
import { writeFileSync } from "node:fs";

const existing = process.env.EXISTING_KEY_B64 || "";
let pem;
let pub;

if (existing) {
  pem = Buffer.from(existing, "base64").toString("utf8");
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    const wrapped = existing.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? existing;
    pem = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
  }
  const key = createPrivateKey(pem);
  pub = createPublicKey(key).export({ format: "jwk" });
} else {
  const pair = generateKeyPairSync("ed25519");
  pem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  pub = pair.publicKey.export({ format: "jwk" });
}

if (typeof pem !== "string") pem = pem.toString();
if (!pub || pub.kty !== "OKP" || typeof pub.x !== "string") {
  console.error("public JWK missing OKP x");
  process.exit(1);
}

writeFileSync("/tmp/attest-pkcs8.b64", Buffer.from(pem).toString("base64"));
writeFileSync(
  "/tmp/attest-pub.jwk",
  JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x }),
);
console.log("public JWK ready crv=" + pub.crv);
