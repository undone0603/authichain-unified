import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { creditSpend, creditStatus } from "./business-tier";

describe("credit spending order (monthly allowance, then pack credits)", () => {
  it("spends the monthly allowance before pack credits", () => {
    const p = {
      generations_limit: 100,
      generations_used: 99,
      tier: null,
      pack_credits: 100,
    };
    expect(creditStatus(p)).toEqual({ ok: true, remaining: 101 });
    expect(creditSpend(p)).toEqual({ generations_used: 100 });
  });

  it("spends pack credits once the allowance is used up", () => {
    const p = {
      generations_limit: 100,
      generations_used: 100,
      tier: null,
      pack_credits: 100,
    };
    expect(creditStatus(p)).toEqual({ ok: true, remaining: 100 });
    expect(creditSpend(p)).toEqual({ pack_credits: 99 });
  });

  it("blocks when both balances are empty", () => {
    const p = {
      generations_limit: 100,
      generations_used: 100,
      tier: null,
      pack_credits: 0,
    };
    expect(creditStatus(p).ok).toBe(false);
    expect(creditSpend(p)).toBeNull();
  });

  it("treats a missing pack_credits column value as zero (pack-only buyer unchanged)", () => {
    const p = { generations_limit: 160, generations_used: 0, tier: null };
    expect(creditStatus(p)).toEqual({ ok: true, remaining: 160 });
    expect(creditSpend(p)).toEqual({ generations_used: 1 });
  });

  it("never spends for unlimited profiles", () => {
    const p = {
      generations_limit: 999999,
      generations_used: 5,
      tier: null,
      pack_credits: 3,
    };
    expect(creditStatus(p).remaining).toBe(Infinity);
    expect(creditSpend(p)).toBeNull();
  });
});
