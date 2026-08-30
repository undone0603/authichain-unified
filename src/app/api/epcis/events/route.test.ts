import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock DB and jose to avoid actual db operations/crypto in unit test
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    }),
    query: {
      products: {
        findFirst: vi.fn().mockResolvedValue({ id: "prod_123" }),
      },
    },
  },
}));

vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue({}),
  verify: vi.fn().mockResolvedValue({}),
}));

describe("EPCIS Ingestion API", () => {
  it("rejects malformed evidence", async () => {
    const req = new NextRequest("http://localhost/api/epcis/events", {
      method: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
