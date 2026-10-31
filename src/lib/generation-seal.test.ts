import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkGenerationSeal,
  issueGenerationSeal,
  type ProtocolRecord,
} from "./generation-seal.ts";
import { decodeRecord, encodeRecord } from "./generation-record-link.ts";

async function issuer(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
}

const base = {
  id: "HarborMark04",
  destinationUrl: "https://qron.space/generate",
  planId: "starter" as const,
  issuedAt: "2026-10-28T20:00:00.000Z",
};

test("omitting the caption keeps the previous subject shape", async () => {
  const pixels = crypto.getRandomValues(new Uint8Array(32));
  const imageSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const pair = await issuer();
  const seal = await issueGenerationSeal({ ...base, imageSha256 }, pair);
  assert.equal(seal.record.credentialSubject.caption, undefined);
  assert.equal(Object.hasOwn(seal.record.credentialSubject, "caption"), false);
  const verdict = await checkGenerationSeal(seal.record, pair.publicKey);
  assert.deepEqual(verdict.reasons, [
    "signature_valid",
    "no_anchor",
    "not_a_product_attestation",
  ]);
  assert.equal(verdict.verdict, "valid-unanchored");
});

test("a caption is signed, and the image is rehashed when bytes are presented", async () => {
  const pixels = crypto.getRandomValues(new Uint8Array(32));
  const imageSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const pair = await issuer();
  const seal = await issueGenerationSeal(
    { ...base, imageSha256, caption: "Gold ring on an ivory field." },
    pair
  );
  const matched = await checkGenerationSeal(seal.record, pair.publicKey, pixels);
  assert.equal(matched.verdict, "valid-unanchored");
  assert.ok(matched.reasons.includes("image_matches"));

  const flipped = new Uint8Array(pixels);
  flipped[0] ^= 1;
  const mismatch = await checkGenerationSeal(seal.record, pair.publicKey, flipped);
  assert.equal(mismatch.verdict, "invalid");
  assert.ok(mismatch.reasons.includes("signature_valid"));
  assert.ok(mismatch.reasons.includes("image_mismatch"));

  const altered: ProtocolRecord = structuredClone(seal.record);
  altered.credentialSubject.caption = "changed";
  const words = await checkGenerationSeal(altered, pair.publicKey, pixels);
  assert.equal(words.verdict, "invalid");
  assert.ok(words.reasons.includes("bad_signature"));
  assert.ok(words.reasons.includes("image_matches"));
});

test("the record survives a fragment round trip", async () => {
  const pixels = crypto.getRandomValues(new Uint8Array(8));
  const imageSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const pair = await issuer();
  const seal = await issueGenerationSeal(
    { ...base, imageSha256, caption: "Lot H-04." },
    pair
  );
  const back = await decodeRecord(await encodeRecord(seal.record));
  assert.ok(back);
  const verdict = await checkGenerationSeal(back, pair.publicKey, pixels);
  assert.equal(verdict.verdict, "valid-unanchored");
  assert.equal(back.credentialSubject.caption, "Lot H-04.");
});
