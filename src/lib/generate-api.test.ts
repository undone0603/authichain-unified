import { describe, expect, it, vi } from "vitest";
import {
  generateCreditPacks,
  generateHealthBody,
  handleGeneratePost,
} from "./generate-api";

describe("generateCreditPacks", () => {
  it("exposes the live $29/$99/$299 catalogue, not a legacy SKU", () => {
    const packs = generateCreditPacks();
    const byId = Object.fromEntries(packs.map(p => [p.id, p]));
    expect(byId.starter.price).toBe(29);
    expect(byId.creator.price).toBe(99);
    expect(byId.dpp_readiness.price).toBe(299);
    expect(packs.some(p => p.price === 49 && p.id === "starter")).toBe(false);
  });
});

describe("generateHealthBody", () => {
  it("reports the generation worker and POST method", () => {
    const body = generateHealthBody(
      "https://qron-image-gen.example.workers.dev"
    );
    expect(body.status).toBe("ok");
    expect(body.methods).toContain("POST");
    expect(body.worker).toBe("https://qron-image-gen.example.workers.dev");
    expect(body.packs.length).toBeGreaterThan(0);
  });
});

describe("handleGeneratePost", () => {
  const generateImage = vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,abc",
  });
  const deductCredit = vi.fn().mockResolvedValue({ ok: true, remaining: 9 });

  it("returns 401 JSON with credit packs when unauthenticated", async () => {
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(401);
    expect(result.body.message).toMatch(/Authentication required/i);
    expect(Array.isArray(result.body.packs)).toBe(true);
    expect(generateImage).not.toHaveBeenCalled();
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("returns 400 when the destination URL is missing", async () => {
    const result = await handleGeneratePost({
      body: { prompt: "neon" },
      userId: "user_1",
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(400);
    expect(String(result.body.message)).toMatch(/URL/i);
  });

  it("returns 403 without generating when credits are exhausted", async () => {
    deductCredit.mockResolvedValueOnce({
      ok: false,
      error: "Generation limit reached",
    });
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: "user_1",
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("LIMIT_REACHED");
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("deducts a credit and returns the generated image", async () => {
    const result = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
        mode: "static",
      },
      userId: "user_1",
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(200);
    expect((result.body.qron as { imageUrl: string }).imageUrl).toContain(
      "data:image/png"
    );
    expect(result.body.remaining_credits).toBe(9);
    expect(deductCredit).toHaveBeenCalledWith("user_1");
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "https://example.com/sku",
        prompt: "gold vault",
      })
    );
  });
});
