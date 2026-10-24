import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimFreeSampleSlot,
  extractAccessToken,
  generateCreditPacks,
  generateHealthBody,
  handleGeneratePost,
  proxyQronImageGen,
} from "./generate-api";
import { qronObjectIdForDestination } from "./qron-presentation";
import { qronResolveUrl } from "./qron-resolve";

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("generateCreditPacks", () => {
  it("exposes Starter, Creator, then DPP (Launch unlisted)", () => {
    const packs = generateCreditPacks();
    const byId = Object.fromEntries(packs.map(p => [p.id, p]));
    expect(byId.starter.price).toBe(29);
    expect(byId.creator.price).toBe(99);
    expect(byId.dpp_readiness.price).toBe(299);
    expect(packs.map(p => p.id)).toEqual([
      "starter",
      "creator",
      "dpp_readiness",
    ]);
    expect(byId.qron_launch).toBeUndefined();
    expect(byId.qron_launch_annual).toBeUndefined();
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
    expect(body.presentation.schema).toBe("AuthiChain QRON Presentation v0");
    expect(body.presentation.verify.decision_contract).toBe(
      "AuthiChain Verification Decision v1"
    );
    expect(body.presentation.verify.jwks_url).toContain("protocol/jwks.json");
    expect(body.presentation.fallback).toBe("image_issued");
    expect(body.presentation.scan).toEqual({
      method: "GET",
      url_template: "https://authichain.com/qron/r/{object_id}",
      missing: "presentation_not_found",
    });
  });

  it("reports whether a Supabase session can be resolved", () => {
    const body = generateHealthBody(undefined, { authConfigured: true });
    expect(body.auth).toBe(true);
  });
});

describe("claimFreeSampleSlot ordering (CFA-361)", () => {
  // In-memory fixed-window counters with the same semantics as RateLimiter.
  function counters(ipLimit: number, dailyLimit: number) {
    const st = { ip: 0, daily: 0, refunds: 0, calls: [] as string[] };
    const tick = () => new Promise(r => setTimeout(r, 0));
    return {
      st,
      l: {
        claimIp: async () => {
          st.calls.push("claimIp");
          await tick();
          if (st.ip >= ipLimit) return false;
          st.ip += 1;
          return true;
        },
        claimDaily: async () => {
          st.calls.push("claimDaily");
          await tick();
          if (st.daily >= dailyLimit) return false;
          st.daily += 1;
          return true;
        },
        refundIp: async () => {
          st.calls.push("refundIp");
          st.refunds += 1;
          if (st.ip > 0) st.ip -= 1;
          return true;
        },
      },
    };
  }

  it("claims the IP slot, then a daily slot", async () => {
    const { st, l } = counters(5, 100);
    expect(await claimFreeSampleSlot(l)).toEqual({ ok: true });
    expect(st.calls).toEqual(["claimIp", "claimDaily"]);
    expect(st).toMatchObject({ ip: 1, daily: 1 });
  });

  it("a visitor who used their samples never touches the daily counter", async () => {
    const { st, l } = counters(0, 100);
    expect(await claimFreeSampleSlot(l)).toEqual({ ok: false, reason: "used" });
    expect(st.calls).toEqual(["claimIp"]);
    expect(st.daily).toBe(0);
  });

  it("a parallel burst from one fresh IP takes at most 5 daily slots", async () => {
    const { st, l } = counters(5, 100);
    const results = await Promise.all(
      Array.from({ length: 50 }, () => claimFreeSampleSlot(l))
    );
    expect(results.filter(r => r.ok)).toHaveLength(5);
    expect(results.filter(r => r.reason === "used")).toHaveLength(45);
    expect(st.daily).toBe(5);
    expect(st.ip).toBe(5);
  });

  it("refunds the IP slot when the daily cap is hit", async () => {
    const { st, l } = counters(5, 0);
    expect(await claimFreeSampleSlot(l)).toEqual({
      ok: false,
      reason: "paused",
    });
    expect(st.calls).toEqual(["claimIp", "claimDaily", "refundIp"]);
    expect(st.ip).toBe(0);
  });

  it("refunds the IP slot and fails closed when the daily claim throws", async () => {
    const { st, l } = counters(5, 100);
    l.claimDaily = async () => {
      throw new Error("DO down");
    };
    await expect(claimFreeSampleSlot(l)).rejects.toThrow("DO down");
    expect(st.ip).toBe(0);
    expect(st.refunds).toBe(1);
  });

  it("still says paused if the refund itself fails", async () => {
    const { l } = counters(5, 0);
    l.refundIp = async () => {
      throw new Error("refund failed");
    };
    expect(await claimFreeSampleSlot(l)).toEqual({
      ok: false,
      reason: "paused",
    });
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
    const packs = result.body.packs as Array<{ id: string }>;
    expect(packs.map(p => p.id)).not.toContain("qron_launch");
    expect(packs.map(p => p.id)).toContain("starter");
    expect(generateImage).not.toHaveBeenCalled();
    expect(checkCredit).not.toHaveBeenCalled();
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("serves an anonymous free sample without touching account credits", async () => {
    const claimFreeSample = vi.fn().mockResolvedValue({ ok: true });
    const bindAttestation = vi.fn();
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
      bindAttestation,
      claimFreeSample,
    });
    expect(result.status).toBe(200);
    expect(result.body.free_sample).toBe(true);
    expect(claimFreeSample).toHaveBeenCalledTimes(1);
    expect(checkCredit).not.toHaveBeenCalled();
    expect(deductCredit).not.toHaveBeenCalled();
    expect(bindAttestation).not.toHaveBeenCalled();
    expect(generateImage.mock.calls[0][0].targetUrl).toBe(
      "https://example.com"
    );
    expect((result.body.qron as { resolveUrl: unknown }).resolveUrl).toBeNull();
    expect(result.body.presentation).toBeUndefined();
  });

  it("walls the anonymous caller once the free sample is used", async () => {
    const claimFreeSample = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "used" });
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
      claimFreeSample,
    });
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("FREE_SAMPLE_USED");
    expect(String(result.body.message)).toMatch(
      /^You.ve used your 5 free generations\. .*\$29, paid once\. No subscription, and pack credits have no expiry date\. Starting a monthly plan replaces unused pack credits\.$/
    );
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("fails closed when the free-sample limiter throws", async () => {
    const claimFreeSample = vi.fn().mockRejectedValue(new Error("DO down"));
    // fail closed as PAUSED, never "used up"
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
      claimFreeSample,
    });
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("FREE_SAMPLE_PAUSED");
    expect(String(result.body.message)).toMatch(
      /^Free samples are paused for today\./
    );
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("says paused, not used up, when the daily cap is hit", async () => {
    const claimFreeSample = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "paused" });
    const result = await handleGeneratePost({
      body: { targetUrl: "https://example.com", prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
      claimFreeSample,
    });
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("FREE_SAMPLE_PAUSED");
    expect(String(result.body.message)).not.toContain("used up");
  });

  it("does not spend a free sample on an invalid request", async () => {
    const claimFreeSample = vi.fn().mockResolvedValue({ ok: true });
    const result = await handleGeneratePost({
      body: { prompt: "neon" },
      userId: null,
      checkCredit,
      deductCredit,
      generateImage,
      claimFreeSample,
    });
    expect(result.status).toBe(400);
    expect(claimFreeSample).not.toHaveBeenCalled();
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
    const presentation = result.body.presentation as {
      schema: string;
      status: string;
      verify: { decision_contract: string };
      attestation: null;
      object_id: string;
    };
    expect(presentation.schema).toBe("AuthiChain QRON Presentation v0");
    expect(presentation.status).toBe("image_issued");
    expect(presentation.attestation).toBeNull();
    expect(presentation.verify.decision_contract).toBe(
      "AuthiChain Verification Decision v1"
    );
    expect((result.body.qron as { objectId: string }).objectId).toBe(
      presentation.object_id
    );
    expect(result.body.remaining_credits).toBe(9);
    expect(checkCredit).toHaveBeenCalledWith("user_1");
    expect(deductCredit).toHaveBeenCalledWith("user_1");
    const resolveUrl = qronResolveUrl(
      qronObjectIdForDestination("https://example.com/sku")
    );
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: resolveUrl,
        prompt: "gold vault",
      })
    );
    const qron = result.body.qron as {
      qrDataUrl: string;
      resolveUrl: string;
      destinationUrl: string;
    };
    expect(qron.destinationUrl).toBe("https://example.com/sku");
    expect(qron.resolveUrl).toBe(resolveUrl);
    expect(qron.qrDataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(
      (result.body.presentation as { resolve_url: string }).resolve_url
    ).toBe(resolveUrl);
    expect(generateImage.mock.invocationCallOrder[0]).toBeLessThan(
      deductCredit.mock.invocationCallOrder[0]
    );
  });

  it("binds attestation when bindAttestation returns jws/kid/jwks", async () => {
    const bindAttestation = vi.fn(async () => ({
      jws: "a.b.c",
      kid: "kid-test",
      jwks_url: "https://authichain.com/protocol/jwks.json",
    }));
    const result = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
      },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
      bindAttestation,
    });
    expect(result.status).toBe(200);
    const presentation = result.body.presentation as {
      status: string;
      attestation: { jws: string; kid: string; jwks_url: string };
    };
    expect(presentation.status).toBe("attestation_bound");
    expect(presentation.attestation.jws).toBe("a.b.c");
    expect(bindAttestation).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationUrl: "https://example.com/sku",
        objectId: qronObjectIdForDestination("https://example.com/sku"),
        userId: "user_1",
      })
    );
    const rememberPresentation = vi.fn(async () => undefined);
    const stored = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
      },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
      bindAttestation,
      rememberPresentation,
    });
    expect(stored.status).toBe(200);
    expect(rememberPresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        object_id: qronObjectIdForDestination("https://example.com/sku"),
        destination_url: "https://example.com/sku",
        jws: "a.b.c",
        kid: "kid-test",
        jwks_url: "https://authichain.com/protocol/jwks.json",
        resolve_url: qronResolveUrl(
          qronObjectIdForDestination("https://example.com/sku")
        ),
      })
    );
  });

  it("still returns the presentation when rememberPresentation throws", async () => {
    const result = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
      },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
      bindAttestation: async () => ({
        jws: "a.b.c",
        kid: "kid-test",
        jwks_url: "https://authichain.com/protocol/jwks.json",
      }),
      rememberPresentation: async () => {
        throw new Error("kv down");
      },
    });
    expect(result.status).toBe(200);
    expect((result.body.presentation as { status: string }).status).toBe(
      "attestation_bound"
    );
  });

  it("stays image_issued when bindAttestation throws", async () => {
    const result = await handleGeneratePost({
      body: {
        url: "https://example.com/sku",
        prompt: "gold vault",
      },
      userId: "user_1",
      checkCredit,
      deductCredit,
      generateImage,
      bindAttestation: async () => {
        throw new Error("signing down");
      },
    });
    expect(result.status).toBe(200);
    expect((result.body.presentation as { status: string }).status).toBe(
      "image_issued"
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
