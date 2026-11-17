import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { getDb } from "./db";

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  })),
}));

const { isSuppressed } = await import("./email-service");

describe("isSuppressed", () => {
  const previous = ENV.suppressionList;

  afterEach(() => {
    ENV.suppressionList = previous;
    vi.mocked(getDb).mockReset();
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
  });

  it("honors SUPPRESSION_LIST as an extra source without querying the table", async () => {
    ENV.suppressionList = "env-blocked@example.com";
    await expect(isSuppressed("env-blocked@example.com")).resolves.toBe(true);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("reads guardrail_suppression_list from the database", async () => {
    ENV.suppressionList = "";
    vi.mocked(getDb).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ email: "db-blocked@example.com" }],
          }),
        }),
      }),
    } as never);
    await expect(isSuppressed("db-blocked@example.com")).resolves.toBe(true);
  });

  it("fails closed when neither the database nor REST can establish status", async () => {
    ENV.suppressionList = "";
    vi.mocked(getDb).mockRejectedValueOnce(new Error("db down"));
    const previousUrl = process.env.SUPABASE_URL;
    const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await expect(isSuppressed("maybe@example.com")).resolves.toBe(true);
    } finally {
      if (previousUrl !== undefined) process.env.SUPABASE_URL = previousUrl;
      if (previousPublicUrl !== undefined) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
      }
      if (previousKey !== undefined) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      }
    }
  });
});
