import { beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimit = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

import { GET } from "./route";

const SEAL = "3f6c2a4e-8b1d-4c7a-9e2f-0a1b2c3d4e5f";

function get(id?: string) {
  const qs = id === undefined ? "" : `?id=${encodeURIComponent(id)}`;
  return GET(
    new Request(`https://authichain.com/api/verify-proxy${qs}`, {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  checkRateLimit.mockResolvedValue({ ok: true, remaining: 19 });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  createAdminClient.mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  });
});

describe("GET /api/verify-proxy", () => {
  it("refuses missing and non-UUID ids before any database or limiter call", async () => {
    for (const id of [undefined, "", "AC-DEMO-001", "demo", "1; drop table auth_seals"]) {
      const res = await get(id);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { verdict: string }).verdict).toBe("invalid_id");
    }
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("answers an unknown seal with an unsigned verdict and seal_not_found", async () => {
    const res = await get(SEAL);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.verdict).toBe("unsigned");
    expect(body.reasons).toContain("seal_not_found");
    expect(body.registered).toBe(false);
    expect(body.verified).toBe(false);
  });

  it("never reports verified and never leaks registry detail for a registered seal", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: SEAL,
        product_id: "sku-secret",
        batch_id: "batch-secret",
        brand: "brand-secret",
        created_at: "2026-01-01T00:00:00Z",
        qr_payload: "https://authichain.com/verify?seal=x&hash=y",
      },
      error: null,
    });
    const res = await get(SEAL);
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body.registered).toBe(true);
    expect(body.verified).toBe(false);
    expect(body.verdict).not.toBe("verified");
    for (const secret of ["sku-secret", "batch-secret", "brand-secret", "qr_payload"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("rate limits per client IP and returns 429 without querying the registry", async () => {
    checkRateLimit.mockResolvedValue({ ok: false, remaining: 0 });
    const res = await get(SEAL);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { verdict: string }).verdict).toBe("rate_limited");
    expect(checkRateLimit).toHaveBeenCalledWith("verify-proxy:203.0.113.9", 20, 1);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the registry is not configured or errors, never a false verdict", async () => {
    delete process.env.SUPABASE_URL;
    expect((await get(SEAL)).status).toBe(503);

    process.env.SUPABASE_URL = "https://example.supabase.co";
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await get(SEAL);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { verdict: string }).verdict).toBe("registry_unavailable");
  });
});
