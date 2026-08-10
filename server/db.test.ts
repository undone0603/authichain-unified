import { describe, it, expect, vi } from "vitest";
import { getHyperdriveDb } from "./db-hyperdrive.js";

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
