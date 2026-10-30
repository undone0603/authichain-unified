import { describe, expect, it, vi } from "vitest";
import { tryHandleCertificateRegistry } from "./certificate-registry";

const ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-public-test-key",
};

describe("tryHandleCertificateRegistry", () => {
  it("does not intercept unrelated routes", async () => {
    await expect(
      tryHandleCertificateRegistry(new Request("https://authichain.com/api/else"))
    ).resolves.toBeNull();
  });

  it("returns no-store 503 rather than a false empty registry when configuration is missing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates"),
      {},
      fetchImpl,
    );
    expect(res?.status).toBe(503);
    await expect(res?.json()).resolves.toEqual({ error: "registry_not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res?.headers.get("cache-control")).toContain("no-store");
  });

  it("reads auth_seals and returns registration status without claiming authenticity", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{
        id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
        product_id: "product-123",
        batch_id: "batch-2026-A",
        brand: "Example Brand",
        polygon_tx: null,
        created_at: "2026-10-01T12:00:00.000Z",
      }]), {
        status: 200,
        headers: { "content-range": "0-0/1" },
      })
    );
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates?brand=Example%20Brand&batch_id=batch-2026-A&limit=5"),
      ENV,
      fetchImpl,
    );

    expect(res?.status).toBe(200);
    const body = await res!.json() as {
      source: string;
      semantics: string;
      certificates: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.source).toBe("auth_seals");
    expect(body.semantics).toMatch(/not a signature or physical-authenticity verdict/);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(0);
    expect(body.certificates[0]).toMatchObject({
      cert_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      seal_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      product_id: "product-123",
      batch_id: "batch-2026-A",
      brand: "Example Brand",
      status: "registered",
    });
    expect(body.certificates[0]).not.toHaveProperty("verified", true);
    const [target, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toContain("/rest/v1/auth_seals?");
    expect(target).toContain("batch_id=eq.batch-2026-A");
    expect(init.headers).toMatchObject({
      apikey: ENV.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
    });
    expect(res?.headers.get("access-control-allow-origin")).toBe("*");
    expect(res?.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects the legacy valid filter because registration is not cryptographic verification", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates?valid=true"),
      ENV,
      fetchImpl,
    );
    expect(res?.status).toBe(400);
    await expect(res?.json()).resolves.toMatchObject({ error: "unsupported_filter" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("validates filter inputs rather than passing filter syntax through to PostgREST", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates?brand=ok%2Cvalid%3Dtrue"),
      ENV,
      fetchImpl,
    );
    expect(res?.status).toBe(400);
    await expect(res?.json()).resolves.toMatchObject({ error: "invalid_filter" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed on Supabase faults", async () => {
    const failedFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    const failed = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates"),
      ENV,
      failedFetch,
    );
    expect(failed?.status).toBe(503);
    await expect(failed?.json()).resolves.toEqual({ error: "registry_unavailable" });

    const httpFailure = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("error", { status: 401 })
    );
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/certificates"),
      ENV,
      httpFailure,
    );
    expect(res?.status).toBe(503);
  });

  it("returns a published signed attestation by exact asset ID without claiming physical authenticity", async () => {
    const record = {
      attestation_id: "urn:authichain:attestation:v01:SKU-123",
      seal_id: "5bd8f022-eab5-4bd0-9cf7-6f08fbc0384a",
      product_id: "SKU-123",
      batch_id: "LOT-2026-A",
      brand: "Example Brand",
      object_id: "SKU-123",
      product_class: "consumer-product",
      gtin: null,
      serial: "SERIAL-123",
      lot: "LOT-2026-A",
      issuer_id: "https://authichain.com",
      issuer_kid: "attest-api-kid",
      decision: "verified",
      payload: { version: "0.1", attestation_id: "urn:authichain:attestation:v01:SKU-123" },
      jws: "header.payload.signature",
      record_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      published_at: "2026-10-16T00:00:00.000Z",
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([record]), { status: 200 })
    );
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/attestations?assetId=SKU-123"),
      ENV,
      fetchImpl,
    );
    expect(res?.status).toBe(200);
    const body = await res!.json() as { source: string; semantics: string; record: Record<string, unknown> };
    expect(body.source).toBe("authichain_attestation_records");
    expect(body.semantics).toContain("not cryptographic verification");
    expect(body.record).toMatchObject({
      attestation_id: record.attestation_id,
      jws: record.jws,
      record_hash: record.record_hash,
      published_at: record.published_at,
    });
    expect(body.record).not.toHaveProperty("verified", true);
    const [target, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toContain("/rest/v1/authichain_attestation_records?");
    expect(target).toContain("published=eq.true");
    expect((init.headers as Record<string, string>).apikey).toBe(ENV.SUPABASE_ANON_KEY);
    expect(res?.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects ambiguous signed-record identifiers rather than choosing the first match", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { attestation_id: "attestation-1", seal_id: "seal-1", product_id: "shared" },
      { attestation_id: "attestation-2", seal_id: "seal-2", product_id: "shared" },
    ]), { status: 200 }));
    const res = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/attestations?assetId=shared"),
      ENV,
      fetchImpl,
    );
    expect(res?.status).toBe(409);
    await expect(res?.json()).resolves.toMatchObject({
      error: "ambiguous_identifier",
      source: "authichain_attestation_records",
      match_count: 2,
    });
  });

  it("requires assetId and fails closed when the published-record table is unavailable", async () => {
    const missing = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/attestations"),
      ENV,
      vi.fn<typeof fetch>(),
    );
    expect(missing?.status).toBe(400);
    await expect(missing?.json()).resolves.toEqual({ error: "assetId_required" });

    const unavailable = await tryHandleCertificateRegistry(
      new Request("https://authichain.com/api/authichain/attestations?assetId=SKU-123"),
      ENV,
      vi.fn<typeof fetch>().mockResolvedValue(new Response("no table", { status: 404 })),
    );
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toEqual({ error: "registry_unavailable" });
  });

  it("answers OPTIONS and HEAD without querying the database and rejects writes", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const base = "https://authichain.com/api/authichain/certificates";
    const options = await tryHandleCertificateRegistry(
      new Request(base, { method: "OPTIONS" }), ENV, fetchImpl
    );
    const head = await tryHandleCertificateRegistry(
      new Request(base, { method: "HEAD" }), ENV, fetchImpl
    );
    const post = await tryHandleCertificateRegistry(
      new Request(base, { method: "POST" }), ENV, fetchImpl
    );
    expect(options?.status).toBe(204);
    expect(head?.status).toBe(204);
    expect(post?.status).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
