import { describe, it, expect, vi } from "vitest";
import { createWorkersContext } from "./context.workers";

vi.mock("./sdk", () => ({
  sdk: { authenticateRequest: vi.fn().mockResolvedValue(null) },
}));

describe("createWorkersContext", () => {
  it("builds a context with db, user, and repos from a Fetch Request", async () => {
    const req = new Request("https://authichain.com/api/trpc/health");
    const env = { HYPERDRIVE: { connectionString: "postgres://fake/fake" } } as any;
    const ctx = await createWorkersContext({ req, resHeaders: new Headers() } as any, env);
    expect(ctx.user).toBeNull();
    expect(ctx.missionsRepo).toBeDefined();
    expect(ctx.adminRepo).toBeDefined();
  });
});
