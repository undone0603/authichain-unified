import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";

describe("verify-worker Trust Kernel issuer fail-closed", () => {
  it("never yields a pass when the issuer check is missing", () => {
    const r = evaluate({
      objectFound: true,
      crypto: {
        signatureValid: true,
        identityValid: true,
        statusActive: true,
      },
    });
    expect(r.decision).not.toBe("verified");
    expect(r.decision).toBe("invalid");
    expect(r.reasons).toContain("issuer_check_missing");
  });
});
