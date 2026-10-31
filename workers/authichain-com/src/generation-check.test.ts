import assert from "node:assert/strict";
import { test } from "node:test";
import { issueGenerationSeal } from "../../../src/lib/generation-seal.ts";
import { tryHandleGeneration } from "./generation-check.ts";

async function issuer(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
}

test("GET /verify/generation is answered on the edge, not proxied", async () => {
  const response = await tryHandleGeneration(new Request("https://authichain.com/verify/generation/HarborMark04"));
  assert.ok(response);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /EDGE CHECK/);
  assert.equal(tryHandleGeneration(new Request("https://authichain.com/verify/live")), null);
});

test("POST checks the record with the key inside it", async () => {
  const pixels = crypto.getRandomValues(new Uint8Array(16));
  const imageSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const pair = await issuer();
  const seal = await issueGenerationSeal(
    {
      id: "HarborMark04",
      destinationUrl: "https://qron.space/generate",
      imageSha256,
      planId: "starter",
      issuedAt: "2026-10-28T20:00:00.000Z",
      caption: "Lot H-04.",
    },
    pair
  );
  const ok = await tryHandleGeneration(
    new Request("https://authichain.com/verify/generation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        record: seal.record,
        imageBase64: btoa(String.fromCharCode(...pixels)),
      }),
    })
  );
  assert.ok(ok);
  const matched = await ok.json();
  assert.equal(matched.verdict, "valid-unanchored");
  assert.ok(matched.reasons.includes("image_matches"));

  const flipped = new Uint8Array(pixels);
  flipped[0] ^= 1;
  const bad = await tryHandleGeneration(
    new Request("https://authichain.com/verify/generation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        record: seal.record,
        imageBase64: btoa(String.fromCharCode(...flipped)),
      }),
    })
  );
  assert.ok(bad);
  const mismatch = await bad.json();
  assert.equal(mismatch.verdict, "invalid");
  assert.ok(mismatch.reasons.includes("image_mismatch"));
});
