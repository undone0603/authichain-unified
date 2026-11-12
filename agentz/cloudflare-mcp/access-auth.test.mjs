import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verifyAccessChatAssertion } from "./access-auth.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const config = {
  AGENTZ_ACCESS_ISSUER: "https://sample.cloudflareaccess.com",
  AGENTZ_ACCESS_AUD: "secure-chat-aud",
  AGENTZ_ACCESS_OWNER_EMAIL: "owner@example.com"
};
const encode = v => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const pair = await webcrypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]
);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
jwk.kid = "key-1";
async function sign(payload, hdr = { alg: "RS256", kid: "key-1" }) {
  const message = encode(hdr) + "." + encode(payload);
  const signature = await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(message));
  return message + "." + Buffer.from(signature).toString("base64url");
}
const now = Math.floor(Date.now() / 1000);
const good = () => ({
  iss: config.AGENTZ_ACCESS_ISSUER, aud: [config.AGENTZ_ACCESS_AUD],
  email: config.AGENTZ_ACCESS_OWNER_EMAIL, sub: "owner-subject",
  iat: now, exp: now + 300
});
let reads = 0;
const fetchCerts = async url => {
  reads++;
  assert.equal(url, "https://sample.cloudflareaccess.com/cdn-cgi/access/certs");
  return { ok: true, json: async () => ({ keys: [jwk] }) };
};
test("accepts a correctly signed owner identity and audience", async () => {
  assert.equal(await verifyAccessChatAssertion(await sign(good()), config, fetchCerts), true);
});
test("rejects missing configuration and forged assertions", async () => {
  const token = await sign(good());
  assert.equal(await verifyAccessChatAssertion(token, {}, fetchCerts), false);
  assert.equal(await verifyAccessChatAssertion(token + "wrong", config, fetchCerts), false);
  assert.equal(await verifyAccessChatAssertion("bad", config, fetchCerts), false);
});
for (const [name, change] of [
  ["wrong audience", { aud: ["other-aud"] }],
  ["wrong issuer", { iss: "https://evil.example" }],
  ["wrong account", { email: "other@example.com" }],
  ["expired", { exp: now - 120 }],
  ["future", { nbf: now + 120 }],
  ["too long", { exp: now + 100000 }]
]) {
  test("rejects " + name, async () => {
    assert.equal(await verifyAccessChatAssertion(await sign({ ...good(), ...change }), config, fetchCerts), false);
  });
}
test("rejects untrusted algorithms and certificate origins", async () => {
  assert.equal(await verifyAccessChatAssertion(await sign(good(), { alg: "none", kid: "key-1" }), config, fetchCerts), false);
  assert.equal(await verifyAccessChatAssertion(await sign(good()), { ...config, AGENTZ_ACCESS_ISSUER: "https://example.com" }, fetchCerts), false);
});
test("rejects signing keys not included in trusted JWKS", async () => {
  assert.equal(await verifyAccessChatAssertion(await sign(good()), config, async () => ({ ok: true, json: async () => ({ keys: [] }) })), false);
});
test("rejects missing or poisoned certificate responses", async () => {
  assert.equal(await verifyAccessChatAssertion(await sign(good()), config, async () => { throw new Error("offline"); }), false);
});
