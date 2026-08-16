import { describe, it, expect } from "vitest";
import { logErrorDetail } from "./log-error-detail";

describe("logErrorDetail", () => {
  it("includes message, cause, and code from a driver-wrapped error", () => {
    const causeErr = new Error("self-signed certificate in certificate chain");
    (causeErr as any).code = "SELF_SIGNED_CERT_IN_CHAIN";
    const wrapped = new Error("Failed query: select 1");
    (wrapped as any).cause = causeErr;

    const detail = logErrorDetail(wrapped);

    expect(detail.message).toBe("Failed query: select 1");
    expect(detail.cause).toBe("self-signed certificate in certificate chain");
    expect(detail.causeCode).toBe("SELF_SIGNED_CERT_IN_CHAIN");
  });

  it("handles a plain error with no cause", () => {
    const detail = logErrorDetail(new Error("plain failure"));

    expect(detail.message).toBe("plain failure");
    expect(detail.cause).toBeUndefined();
    expect(detail.causeCode).toBeUndefined();
  });

  it("handles a non-Error thrown value", () => {
    const detail = logErrorDetail("just a string");

    expect(detail.message).toBe("just a string");
  });
});
