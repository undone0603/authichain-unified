import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import tls from "node:tls";
import { getHyperdriveDb } from "./db";


describe("getHyperdriveDb", () => {
  it("builds a drizzle client from a Hyperdrive connection string", () => {
    const fakeEnv = {
      HYPERDRIVE: { connectionString: "postgres://fake:fake@localhost:5432/fake" },
    };
    const db = getHyperdriveDb(fakeEnv as any);
    expect(db).toBeDefined();
    // drizzle-orm/node-postgres clients expose $client (the underlying pg.Pool)
    expect((db as any).$client).toBeDefined();
  });
});

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("pg");
  });

  async function buildPoolConfig(databaseUrl: string) {
    const poolSpy = vi.fn();
    vi.doMock("pg", () => ({
      Pool: class {
        constructor(config: unknown) {
          poolSpy(config);
        }
      },
    }));
    vi.stubEnv("DATABASE_URL", databaseUrl);

    const { getDb } = await import("./db.ts");
    await getDb();

    expect(poolSpy).toHaveBeenCalledTimes(1);
    return poolSpy.mock.calls[0][0] as { connectionString: string; ssl?: { ca?: string[] } };
  }

  it("trusts Supabase's pooler CA in addition to the system trust store, not instead of it", async () => {
    // Supabase's pooler chains through its own self-signed root CA (confirmed via
    // `openssl s_client -connect ...pooler.supabase.com:6543`), which isn't in
    // Node's default trust store. pg's newer sslmode=require -> verify-full
    // mapping then rejects every connection unless that CA is pinned explicitly.
    //
    // This assertion was inverted on 2026-08-20. It previously required the
    // pooler CA to be the *only* trusted root — real pinning, and stronger in
    // principle. In practice no connection had ever verified against it: the
    // committed default is the Entrust 2006 public root, a placeholder that was
    // never swapped for the project's certificate, so the single-root config
    // could only ever fail closed. Replacing the trust store also converts an
    // ordinary publicly-rooted chain into SELF_SIGNED_CERT_IN_CHAIN, which is
    // an unhelpful way to fail. Concatenating keeps the pin usable via
    // SUPABASE_POOLER_CA while a public chain also verifies.
    const fakeHost = "aws-1-us-east-2.pooler.supabase.com";
    const fakeUrl = "postgresql://" + "fakeuser" + ":" + "fakepass" + "@" + fakeHost + ":6543/postgres?sslmode=require";

    const config = await buildPoolConfig(fakeUrl);

    const ca = config.ssl?.ca;
    expect(Array.isArray(ca)).toBe(true);
    expect(ca!.some(c => c.includes("-----BEGIN CERTIFICATE-----"))).toBe(true);
    // The system roots are present, so a publicly-rooted pooler chain verifies...
    expect(ca!.length).toBeGreaterThan(1);
    expect(ca).toEqual(expect.arrayContaining(tls.rootCertificates as unknown as string[]));
    // ...and the pinned certificate is still the last word, so a private root
    // supplied via SUPABASE_POOLER_CA verifies too.
    expect(ca![ca!.length - 1]).toContain("-----BEGIN CERTIFICATE-----");

    expect(config.connectionString).not.toMatch(/sslmode=/);
  });

  it("never disables certificate verification", async () => {
    // The connection carries the database password. A cert failure must stay a
    // failure — the remedy is SUPABASE_POOLER_CA, not rejectUnauthorized:false.
    const fakeUrl =
      "postgresql://" + "fakeuser" + ":" + "fakepass" + "@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require";

    const config = await buildPoolConfig(fakeUrl);

    expect((config.ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized).not.toBe(false);
  });

  it("preserves sibling query params (e.g. pgbouncer=true) when stripping sslmode", async () => {
    const fakeHost = "aws-1-us-east-2.pooler.supabase.com";
    const fakeUrl =
      "postgresql://" + "fakeuser" + ":" + "fakepass" + "@" + fakeHost + ":6543/postgres?sslmode=require&pgbouncer=true";

    const config = await buildPoolConfig(fakeUrl);

    expect(config.connectionString).not.toMatch(/sslmode=/);
    expect(config.connectionString).toMatch(/[?&]pgbouncer=true(&|$)/);
  });
});
