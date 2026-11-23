import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetDb, mockGetWebhookSupabase } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGetWebhookSupabase: vi.fn(),
}));
vi.mock("../../../../db", () => ({ getDb: mockGetDb }));
vi.mock("../../stripe/webhook/supabase", () => ({
  getWebhookSupabase: mockGetWebhookSupabase,
}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
    }),
  },
}));

const ID = "1234567890123456789";
const OTHER = "2234567890123456789";
const DB_NAME = "postgres";
const REF = "abcdefghijklmnopqrst";
const SHA = "a".repeat(40);
const KEY = "secret-operator-".padEnd(40, "K");
const URL = "https://authichain.com/api/internal/runtime-db-attestation";

type Result = {
  status: number;
  body: {
    verified: boolean;
    error?: string;
    deployedVersion?: string;
    checkedAt?: string;
    connections?: Record<string, { verified: boolean; identity: string; path: string }>;
  };
  headers: Record<string, string>;
};

function request(token = KEY) {
  return new Request(URL, { headers: { authorization: `Bearer ${token}` } });
}

async function invoke(token = KEY): Promise<Result> {
  return (await GET(request(token))) as unknown as Result;
}

describe("protected dual-path runtime DB attestation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RUNTIME_ATTESTATION_KEY", KEY);
    vi.stubEnv("RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER", ID);
    vi.stubEnv("RUNTIME_EXPECTED_DATABASE_NAME", DB_NAME);
    vi.stubEnv("RUNTIME_EXPECTED_SUPABASE_PROJECT_REF", REF);
    vi.stubEnv("AUTHICHAIN_DEPLOYED_SHA", SHA);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${REF}.supabase.co`);
    mockGetDb.mockReturnValue({
      execute: vi.fn().mockResolvedValue([{ identity: { system_identifier: ID, database_name: DB_NAME } }]),
    });
    mockGetWebhookSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { system_identifier: ID, database_name: DB_NAME }, error: null }),
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("matches both live query results to the independent pin and redacts cluster ID/credentials", async () => {
    const result = await invoke();
    expect(result.status).toBe(200);
    expect(result.body.verified).toBe(true);
    expect(result.body.deployedVersion).toBe(SHA);
    expect(result.body.connections?.databaseUrl).toMatchObject({
      verified: true,
      path: "postgres-js:getDb",
    });
    expect(result.body.connections?.webhookSupabase).toMatchObject({
      verified: true,
      path: "stripe-webhook:supabase-js",
    });
    expect(result.body.connections?.databaseUrl.identity).toBe(
      result.body.connections?.webhookSupabase.identity,
    );
    expect(JSON.stringify(result.body)).not.toContain(ID);
    expect(JSON.stringify(result.body)).not.toContain(KEY);
    expect(JSON.stringify(result.body)).not.toContain("supabase.co");
    expect(result.headers["Cache-Control"]).toContain("no-store");
    expect(result.headers["Vary"]).toBe("Authorization");
    expect(result.body.checkedAt).toMatch(/^20\d\d-/);
  });

  it("refuses absent or invalid operator credentials before opening either connection", async () => {
    expect((await GET(new Request(URL)) as unknown as Result).status).toBe(401);
    expect((await invoke("wrong".repeat(10))).status).toBe(401);
    vi.stubEnv("RUNTIME_ATTESTATION_KEY", "");
    expect((await invoke()).status).toBe(401);
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockGetWebhookSupabase).not.toHaveBeenCalled();
  });

  it("rejects query-string authentication and refuses missing independent pins", async () => {
    const untrusted = await GET(new Request(`${URL}?key=${KEY}`)) as unknown as Result;
    expect(untrusted.status).toBe(401);
    vi.stubEnv("RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER", "");
    expect((await invoke()).status).toBe(503);
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockGetWebhookSupabase).not.toHaveBeenCalled();
  });

  it("refuses a different REST project URL before querying either connection", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://wrongprojectref1234.supabase.co");
    expect((await invoke()).status).toBe(503);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("fails closed on a wrong PostgreSQL target without echoing the identity", async () => {
    mockGetDb.mockReturnValue({ execute: vi.fn().mockResolvedValue([{ identity: { system_identifier: OTHER, database_name: DB_NAME } }]) });
    const result = await invoke();
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ verified: false, error: "attestation_unavailable" });
    expect(JSON.stringify(result.body)).not.toContain(OTHER);
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });

  it("fails closed on wrong Supabase RPC target or unavailable RPC", async () => {
    mockGetWebhookSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { system_identifier: OTHER, database_name: DB_NAME }, error: null }),
    });
    expect((await invoke()).status).toBe(503);
    mockGetWebhookSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "secret error" } }),
    });
    const failed = await invoke();
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed.body)).not.toContain("secret error");
  });

  it("rejects the same cluster ID paired with a different database name", async () => {
    mockGetWebhookSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { system_identifier: ID, database_name: "other" },
        error: null,
      }),
    });
    expect((await invoke()).status).toBe(503);
  });

  it("rejects an absent database-name pin before any query", async () => {
    vi.stubEnv("RUNTIME_EXPECTED_DATABASE_NAME", "");
    expect((await invoke()).status).toBe(503);
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockGetWebhookSupabase).not.toHaveBeenCalled();
  });

  it("fails closed when PostgreSQL query fails even if REST attestation succeeds", async () => {
    mockGetDb.mockReturnValue({ execute: vi.fn().mockRejectedValue(new Error("postgres://secret")) });
    const result = await invoke();
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain("postgres://");
  });

  it("does not pass when the deployed version is unknown", async () => {
    vi.stubEnv("AUTHICHAIN_DEPLOYED_SHA", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect((await invoke()).status).toBe(503);
    expect(mockGetDb).not.toHaveBeenCalled();
  });
});
