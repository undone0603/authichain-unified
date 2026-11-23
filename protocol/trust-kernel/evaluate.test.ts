import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";

const positiveCrypto = {
  signatureValid: true,
  issuerTrusted: true,
  identityValid: true,
  statusActive: true,
};

describe("Trust Kernel issuer fail-closed", () => {
  it("returns verified only when the issuer check completed as trusted", () => {
    const r = evaluate({
      objectFound: true,
      crypto: positiveCrypto,
    });
    expect(r.decision).toBe("verified");
    expect(r.vector.issuer).toBe("verified");
  });

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
    expect(r.vector.issuer).toBe("unknown");
    expect(r.reasons).toContain("issuer_check_missing");
  });

  it("never yields a pass when the issuer check is skipped", () => {
    const r = evaluate({
      objectFound: true,
      crypto: {
        ...positiveCrypto,
        issuerCheck: "skipped",
      },
    });
    expect(r.decision).not.toBe("verified");
    expect(r.decision).toBe("invalid");
    expect(r.reasons).toContain("issuer_check_skipped");
  });

  it("never yields a pass when the issuer check errored", () => {
    const r = evaluate({
      objectFound: true,
      crypto: {
        ...positiveCrypto,
        issuerCheck: "error",
      },
    });
    expect(r.decision).not.toBe("verified");
    expect(r.decision).toBe("invalid");
    expect(r.reasons).toContain("issuer_check_error");
  });

  it("never yields a pass when issuerError is set", () => {
    const r = evaluate({
      objectFound: true,
      crypto: {
        ...positiveCrypto,
        issuerError: "jwks_unavailable",
      },
    });
    expect(r.decision).not.toBe("verified");
    expect(r.decision).toBe("invalid");
    expect(r.reasons).toContain("issuer_check_error");
  });

  it("treats an explicitly untrusted issuer as invalid", () => {
    const r = evaluate({
      objectFound: true,
      crypto: { ...positiveCrypto, issuerTrusted: false },
    });
    expect(r.decision).toBe("invalid");
    expect(r.reasons).toContain("issuer_untrusted");
  });
});
