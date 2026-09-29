import { describe, expect, it } from "vitest";
import { parseSealRequest, registryAnswer } from "./agent-verify";

const SEAL = "3f6c2a4e-8b1d-4c7a-9e2f-0a1b2c3d4e5f";

describe("parseSealRequest", () => {
  it("accepts a seal UUID from sealId or seal_id", () => {
    expect(parseSealRequest({ sealId: SEAL })).toEqual({ ok: true, sealId: SEAL });
    expect(parseSealRequest({ seal_id: ` ${SEAL.toUpperCase()} ` })).toEqual({
      ok: true,
      sealId: SEAL.toUpperCase(),
    });
  });

  it("refuses a non-UUID with 400, not a registry outage", () => {
    const r = parseSealRequest({ sealId: "AC-DEMO-001" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("seal_id_not_uuid");
    expect(r.body.settled).toBe(false);
  });

  it("no longer treats productId or serial as a seal id", () => {
    for (const input of [{ productId: SEAL }, { serial: "874921" }]) {
      const r = parseSealRequest(input);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.body.error).toBe("seal_id_required");
      expect(r.body.detail).toMatch(/not registry keys/);
    }
  });

  it("requires a subject", () => {
    const r = parseSealRequest({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.error).toBe("seal_id_required");
  });
});

describe("registryAnswer", () => {
  it("reports a found row as registered, never as a signature verdict", () => {
    const a = registryAnswer({
      id: SEAL,
      product_id: "p1",
      batch_id: "b1",
      brand: "Acme",
      created_at: "2026-09-01T00:00:00Z",
    });
    expect(a.registered).toBe(true);
    expect(a.status).toBe("registered");
    expect(a.checks).toEqual({
      registry: "found",
      signature: "not_checked",
      revocation: "not_available",
    });
    expect("authenticityScore" in a).toBe(false);
    expect("verified" in a).toBe(false);
  });

  it("reports a missing row as not registered", () => {
    const a = registryAnswer(null);
    expect(a).toMatchObject({
      registered: false,
      status: "not_registered",
      details: {},
    });
    expect(a.checks.registry).toBe("not_found");
  });
});
