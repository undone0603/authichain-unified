import { describe, expect, it } from "vitest";
import { runSmokeGate, smokeSteps } from "../production-smoke-gate";

describe("production smoke gate", () => {
  it("covers the money + verification path", () => {
    const ids = smokeSteps().map(s => s.id);
    expect(ids).toEqual([
      "origin",
      "verification",
      "jwks",
      "issuer",
      "attestation",
      "object_lookup",
      "checkout_surface",
      "checkout_api",
      "provisioning",
      "crm_status",
    ]);
  });

  it("does not POST to Stripe or write events", () => {
    for (const step of smokeSteps()) {
      expect(step.url.startsWith("https://authichain.com")).toBe(true);
    }
  });

  it("fails the gate when JWKS has no keys", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      const status =
        path === "/api/v1/verify"
          ? url.includes("serial=")
            ? 404
            : 400
          : path === "/api/checkout"
            ? 405
            : path === "/api/v1/attestations/verify"
              ? 405
              : 200;
      const keys = path.includes("jwks") ? [] : undefined;
      return {
        status,
        clone() {
          return this;
        },
        async json() {
          return keys ? { keys } : { ok: true };
        },
      } as Response;
    };
    const report = await runSmokeGate("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(false);
    expect(report.failed.some(f => f.id === "jwks")).toBe(true);
  });

  it("passes when every step returns an accepted status", async () => {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      const status =
        path === "/api/v1/verify"
          ? url.includes("serial=")
            ? 404
            : 400
          : path === "/api/checkout"
            ? 405
            : path === "/api/v1/attestations/verify"
              ? 405
              : 200;
      return {
        status,
        clone() {
          return this;
        },
        async json() {
          return path.includes("jwks")
            ? { keys: [{ kid: "k1" }] }
            : { ok: true };
        },
      } as Response;
    };
    const report = await runSmokeGate("https://authichain.com", fetchImpl);
    expect(report.ok).toBe(true);
  });
});
