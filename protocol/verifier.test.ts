import { createHash, generateKeyPairSync, sign as edSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signingBytes, verifyRecord } from "./verifier.mjs";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buf: Buffer): string {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

function signedFalseDestination(): { record: Record<string, unknown>; anchor: Record<string, string> } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const did = "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const destination = "https://example.invalid/wrong-destination";
  const record: Record<string, unknown> = {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://authichain.com/protocol/v1"],
    type: ["VerifiableCredential", "ProvenanceRecord"],
    issuer: did,
    validFrom: "2026-01-01T00:00:00Z",
    credentialSubject: {
      id: destination,
      destination,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: "2026-01-01T00:00:00Z",
      verificationMethod: `${did}#${did.slice(8)}`,
      proofPurpose: "assertionMethod",
    },
  };
  const proof = record.proof as { proofValue?: string };
  proof.proofValue = "z" + base58Encode(edSign(null, signingBytes(record), privateKey));
  const anchor = {
    recordHash: "sha256:" + createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + "a".repeat(64),
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  return { record, anchor };
}

describe("signed false destination", () => {
  it("a signed false destination is not genuineness", () => {
    const { record, anchor } = signedFalseDestination();
    const result = verifyRecord(record, anchor, { now: "2026-06-01T00:00:00Z" });
    expect(result.verdict).toBe("verified");
    expect(result).not.toHaveProperty("genuine");
    const subject = record.credentialSubject as { destination: string };
    expect(subject.destination).toBe("https://example.invalid/wrong-destination");

    const pages = JSON.parse(
      readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "..", "content/seo/pages.json"), "utf8")
    );
    const page = pages.find(
      (entry: { slug: string }) => entry.slug === "qr-code-phishing-product-packaging-security"
    );
    const text = JSON.stringify(page);
    expect(text).toContain(
      "A signed record does not prove the destination is genuine, and it does not prove the physical item matches the record."
    );
  });
});
