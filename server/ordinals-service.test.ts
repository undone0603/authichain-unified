import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInscriptionStatus } from "./ordinals-service";

describe("ordinals-service: getInscriptionStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validId = "6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a8b0802e7039f7i0";

  it("returns invalid status for malformed inscription ID", async () => {
    const res = await getInscriptionStatus("invalid-id-format");
    expect(res).toEqual({
      status: "invalid",
      error: "Invalid inscription ID format",
    });
  });

  it("returns confirmed when public ordinals indexer resolves", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url: any) => {
      if (String(url).includes("ordinals.com")) {
        return new Response(JSON.stringify({ id: validId, number: 12345 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const res = await getInscriptionStatus(validId);
    expect(res).toEqual({
      status: "confirmed",
      id: validId,
      number: 12345,
    });
  });

  it("returns pending when ordinals indexer returns 404 not yet confirmed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
      return new Response("Not found", { status: 404 });
    });

    const res = await getInscriptionStatus(validId);
    expect(res).toEqual({ status: "pending" });
  });

  it("returns deprecated status when Hiro returns 410 Gone and fallback fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("ordinals.com")) {
        throw new Error("Network error connecting to ordinals.com");
      }
      if (String(url).includes("api.hiro.so")) {
        return new Response("Gone", { status: 410 });
      }
      return new Response("Not found", { status: 404 });
    });

    const res = await getInscriptionStatus(validId);
    expect(res).toEqual({
      status: "deprecated",
      error: "Hiro Ordinals API v1 is sunset (410 Gone). Public indexer lookup did not resolve.",
    });
  });
});
