import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractAccessToken,
  generateCreditPacks,
  generateHealthBody,
  handleGeneratePost,
  proxyQronImageGen,
} from "./generate-api";

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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
    expect(body.auth).toBe(false);
    expect(body.packs.length).toBeGreaterThan(0);
  });

  it("reports whether a Supabase session can be resolved", () => {
    const body = generateHealthBody(undefined, { authConfigured: true });
    expect(body.auth).toBe(true);
  });
});

describe("handleGeneratePost", () => {
  const generateImage = vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,abc",
  });
  const checkCredit = vi.fn().mockResolvedValue({ ok: true, remaining: 10 });
  const deductCredit = vi.fn().mockResolvedValue({ ok: true, remaining: 9 });

  beforeEach(() => {
    vi.clearAllMocks();
    generateImage.mockResolvedValue({
      imageUrl: "data:image/png;base64,abc",
    });
    checkCredit.mockResolvedValue({ ok: true, remaining: 10 });
    deductCredit.mockResolvedValue({ ok: true, remaining: 9 });
  });

  it("returns 401 JSON with credit packs when unauthenticated", async () => {
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(401);
    expect(result.body.message).toMatch(/Authentication required/i);
    expect(Array.isArray(result.body.packs)).toBe(true);
    expect(generateImage).not.toHaveBeenCalled();
    expect(checkCredit).not.toHaveBeenCalled();
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("returns 400 when the destination URL is missing", async () => {
    const result = await handleGeneratePost({
      body: { prompt: "neon" },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(400);
    expect(String(result.body.message)).toMatch(/URL/i);
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("returns 403 without generating when credits are exhausted", async () => {
    checkCredit.mockResolvedValueOnce({
      ok: false,
      error: "Generation limit reached",
    });
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("LIMIT_REACHED");
    expect(generateImage).not.toHaveBeenCalled();
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("does not deduct a credit when image generation fails", async () => {
    generateImage.mockRejectedValueOnce(new Error("engine down"));
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(502);
    expect(checkCredit).toHaveBeenCalledWith("user_1");
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("deducts a credit only after the generated image returns", async () => {
    const result = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
        mode: "static",
      },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
    });
    expect(result.status).toBe(200);
    expect((result.body.qron as { imageUrl: string }).imageUrl).toContain(
      "data:image/png"
    );
    expect(result.body.remaining_credits).toBe(9);
    expect(checkCredit).toHaveBeenCalledWith("user_1");
    expect(deductCredit).toHaveBeenCalledWith("user_1");
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "https://example.com/sku",
        prompt: "gold vault",
      })
    );
    expect(generateImage.mock.invocationCallOrder[0]).toBeLessThan(
      deductCredit.mock.invocationCallOrder[0]
    );
  });
});

describe("extractAccessToken", () => {
  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEifQ.sig";

  it("reads a Bearer header first", () => {
    const request = new Request("https://authichain.com/api/generate", {
      headers: {
        authorization: `Bearer ${jwt}`,
        cookie: "sb-abc123-auth-token=ignored",
      },
    });
    expect(extractAccessToken(request)).toBe(jwt);
  });

  it("reads a live @supabase/ssr base64- cookie", () => {
    const session = JSON.stringify({
      access_token: jwt,
      refresh_token: "rt",
      token_type: "bearer",
    });
    const cookie = `sb-abcdefghijklmnopqrst-auth-token=base64-${toBase64Url(session)}`;
    const request = new Request("https://authichain.com/api/generate", {
      headers: { cookie },
    });
    expect(extractAccessToken(request)).toBe(jwt);
  });

  it("reassembles chunked sb-*-auth-token.N cookies", () => {
    const session = JSON.stringify({
      access_token: jwt,
      refresh_token: "rt",
      token_type: "bearer",
    });
    const encoded = `base64-${toBase64Url(session)}`;
    const mid = Math.ceil(encoded.length / 2);
    const cookie = [
      `sb-abcdefghijklmnopqrst-auth-token.0=${encodeURIComponent(encoded.slice(0, mid))}`,
      `sb-abcdefghijklmnopqrst-auth-token.1=${encodeURIComponent(encoded.slice(mid))}`,
    ].join("; ");
    const request = new Request("https://authichain.com/api/generate", {
      headers: { cookie },
    });
    expect(extractAccessToken(request)).toBe(jwt);
  });
});

describe("proxyQronImageGen", () => {
  it("does not force gold_vault when the caller omitted a style", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: { data_url: "data:image/png;base64,abc" },
      }),
    });
    await proxyQronImageGen({
      targetUrl: "https://example.com",
      prompt: "neon drift",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      workerUrl: "https://qron-image-gen.example.workers.dev",
    });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.style).toBeUndefined();
    expect(body.prompt).toContain("neon drift");
  });
});
