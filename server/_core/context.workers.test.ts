import { describe, it, expect, vi } from "vitest";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { createWorkersContext } from "./context.workers";

vi.mock("./sdk", () => ({
  sdk: { authenticateRequest: vi.fn().mockResolvedValue(null) },
}));

describe("createWorkersContext", () => {
  it("builds a context with db, user, and repos from a Fetch Request", async () => {
    const req = new Request("https://authichain.com/api/trpc/health");
    const env = { HYPERDRIVE: { connectionString: "postgres://fake/fake" } };
    const opts: FetchCreateContextFnOptions = { req, resHeaders: new Headers(), info: undefined };
    const ctx = await createWorkersContext(opts, env);
    expect(ctx.user).toBeNull();
    expect(ctx.missionsRepo).toBeDefined();
    expect(ctx.adminRepo).toBeDefined();
  });
});
