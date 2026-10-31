import { describe, expect, it, vi, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { publicProcedure, router, TRPC_GENERIC_INTERNAL_MESSAGE, trpcErrorFormatter } from "./trpc";

const testRouter = router({
  boom: publicProcedure.query(() => {
    throw new Error("connect ECONNREFUSED db.internal:5432 password=hunter2");
  }),
  missing: publicProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "No record found" });
  }),
});

async function call(path: string) {
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`https://app.authichain.com/api/trpc/${path}`),
    router: testRouter,
    createContext: () => ({ user: null, req: {}, res: {} }) as any,
  });
  return { status: res.status, text: await res.text() };
}

describe("tRPC error responses outside development", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("an internal error returns a generic message and no stack", async () => {
    const { status, text } = await call("boom");
    expect(status).toBe(500);
    expect(text).toContain(TRPC_GENERIC_INTERNAL_MESSAGE);
    expect(text).not.toContain("stack");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toMatch(/at .*\.ts:\d+/);
  });

  it("an intentional TRPCError keeps its message but drops the stack", async () => {
    const { status, text } = await call("missing");
    expect(status).toBe(404);
    expect(text).toContain("No record found");
    expect(text).not.toContain("stack");
  });

  it("strips the stack when NODE_ENV is unset (Workers) or production", () => {
    const shape = { message: "x", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, stack: "Error: x\n at a.ts:1" } };
    for (const env of ["", "production"]) {
      vi.stubEnv("NODE_ENV", env);
      const out = trpcErrorFormatter({ shape, error: { code: "INTERNAL_SERVER_ERROR" } });
      expect(out.data).not.toHaveProperty("stack");
      expect(out.message).toBe(TRPC_GENERIC_INTERNAL_MESSAGE);
    }
  });

  it("keeps the full shape in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const shape = { message: "x", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, stack: "s" } };
    expect(trpcErrorFormatter({ shape, error: { code: "INTERNAL_SERVER_ERROR" } })).toBe(shape);
  });
});
