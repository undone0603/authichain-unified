import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attestSeal } from "./seal-attestation";

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../protocol/conformance/fixtures/valid-anchored-polygon.json",
      import.meta.url
    ),
    "utf8"
  )
) as { record: Record<string, unknown>; anchor: Record<string, unknown> };

describe("attestSeal", () => {
  it("does not verify a registry row that has no Ed25519 proof", () => {
    const result = attestSeal({
      id: "AC-ROW-ONLY",
      product_id: "p",
      brand: "desk",
      qr_payload: "https://authichain.com/verify?id=AC-ROW-ONLY",
    });
    expect(result.verified).toBe(false);
    expect(result.verdict).toBe("unsigned");
    expect(result.reasons).toContain("no_ed25519_proof");
  });

  it("does not verify a missing seal", () => {
    expect(attestSeal(null)).toEqual({
      verified: false,
      verdict: "unsigned",
      reasons: ["seal_not_found"],
    });
  });

  it("verifies only when the protocol verifier returns verified", () => {
    const result = attestSeal({
      id: "SERIAL123",
      record: fixture.record,
      anchor: fixture.anchor,
    });
    expect(result.verdict).toBe("verified");
    expect(result.verified).toBe(true);
  });

  it("keeps a valid signature without an anchor unverified", () => {
    const result = attestSeal({
      qr_payload: JSON.stringify({ record: fixture.record }),
    });
    expect(result.verdict).toBe("valid-unanchored");
    expect(result.verified).toBe(false);
  });
});
