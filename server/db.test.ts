import { describe, it, expect, vi } from "vitest";
import { getDb } from "./db";

describe("getDb", () => {
  it("builds a drizzle client from a Hyperdrive connection string", () => {
    const fakeEnv = {
      HYPERDRIVE: { connectionString: "postgres://fake:fake@localhost:5432/fake" },
    } as unknown as { HYPERDRIVE: Hyperdrive };
    const db = getDb(fakeEnv);
    expect(db).toBeDefined();
    // drizzle-orm/node-postgres clients expose $client (the underlying pg.Pool)
    expect((db as any).$client).toBeDefined();
  });
});
