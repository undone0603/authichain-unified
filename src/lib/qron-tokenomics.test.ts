import { describe, expect, it } from "vitest";
import {
  FIAT_BURN_RATE,
  LIVE_QRON_SUPPLY,
  THEATER_SUPPLY_DO_NOT_USE,
  computeRevenueObligations,
} from "./qron-tokenomics";

describe("qron revenue obligations", () => {
  it("uses the live 1B supply, not the 100M theater figure", () => {
    expect(LIVE_QRON_SUPPLY).toBe(1_000_000_000);
    expect(THEATER_SUPPLY_DO_NOT_USE).toBe(100_000_000);
    expect(LIVE_QRON_SUPPLY).not.toBe(THEATER_SUPPLY_DO_NOT_USE);
  });

  it("books 25% burn and splits the rest so the parts equal the dollar", () => {
    const row = computeRevenueObligations(100);
    expect(row.burnCents).toBe(2500);
    expect(row.burnCents / row.amountCents).toBe(FIAT_BURN_RATE);
    expect(
      row.burnCents +
        row.treasuryCents +
        row.nodeOperatorsCents +
        row.coreContributorsCents +
        row.ecosystemGrantsCents
    ).toBe(10000);
    expect(row.settlesOnChain).toBe(false);
    expect(row.autonomyEnabled).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(() => computeRevenueObligations(-1)).toThrow(/non-negative/);
  });
});
