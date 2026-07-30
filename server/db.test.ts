import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("verifies Supabase's pooler against its own root CA instead of the system trust store", async () => {
    // Supabase's pooler chains through its own self-signed root CA (confirmed via
    // `openssl s_client -connect ...pooler.supabase.com:6543`), which isn't in
    // Node's default trust store. pg's newer sslmode=require -> verify-full
    // mapping then rejects every connection unless that CA is pinned explicitly.
    const poolSpy = vi.fn();
    vi.doMock("pg", () => ({
      Pool: class {
        constructor(config: unknown) {
          poolSpy(config);
        }
      },
    }));
    const fakeHost = "aws-1-us-east-2.pooler.supabase.com";
    const fakeUrl = "postgresql://" + "fakeuser" + ":" + "fakepass" + "@" + fakeHost + ":6543/postgres?sslmode=require";
    vi.stubEnv("DATABASE_URL", fakeUrl);

    const { getDb } = await import("./db.ts");
    await getDb();

    expect(poolSpy).toHaveBeenCalledTimes(1);
    const config = poolSpy.mock.calls[0][0] as { connectionString: string; ssl?: { ca?: string } };
    expect(config.ssl?.ca).toContain("-----BEGIN CERTIFICATE-----");
    expect(config.connectionString).not.toMatch(/sslmode=/);
  });
});
