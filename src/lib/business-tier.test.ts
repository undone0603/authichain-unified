import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClient, updateFilters, updateResult } = vi.hoisted(() => ({
  mockClient: {
    from: vi.fn(),
  },
  updateFilters: [] as Array<[string, unknown]>,
  updateResult: { data: [{ generations_used: 1 }], error: null as null | { message: string } },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockClient,
}));

import { deductCredit } from "./business-tier";

describe("deductCredit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateFilters.length = 0;
    updateResult.data = [{ generations_used: 1 }];
    updateResult.error = null;
    mockClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              generations_used: 0,
              generations_limit: 5,
              tier: "pro",
            },
          }),
        }),
      }),
      update: () => {
        const chain = {
          eq: (column: string, value: unknown) => {
            updateFilters.push([column, value]);
            return chain;
          },
          lt: (column: string, value: unknown) => {
            updateFilters.push([column, value]);
            return chain;
          },
          select: async () => updateResult,
        };
        return chain;
      },
    }));
  });

  it("uses compare-and-set filters for a bounded credit debit", async () => {
    await expect(deductCredit("profile-1")).resolves.toEqual({
      ok: true,
      remaining: 4,
    });
    expect(updateFilters).toEqual([
      ["id", "profile-1"],
      ["generations_used", 0],
      ["generations_used", 5],
    ]);
  });

  it("reports a lost concurrent update instead of claiming a debit", async () => {
    updateResult.data = [];
    await expect(deductCredit("profile-1")).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/changed during the request/),
    });
  });
});
