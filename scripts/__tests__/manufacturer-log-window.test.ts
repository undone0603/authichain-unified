import { describe, expect, it } from "vitest";
import {
  DEPLOYED_BLOCK,
  FREE_RPC_SPAN,
  logFromBlock,
} from "../../workers/manufacturer-status/src/window";

describe("manufacturer log window", () => {
  it("stays inside the free RPC span after deployment", () => {
    const current = DEPLOYED_BLOCK + 5_000_000n;
    const from = logFromBlock(current);
    expect(current - from).toBe(FREE_RPC_SPAN);
    expect(from).toBeGreaterThan(DEPLOYED_BLOCK);
  });

  it("starts at deployment when the contract is still inside the span", () => {
    const current = DEPLOYED_BLOCK + 100n;
    expect(logFromBlock(current)).toBe(DEPLOYED_BLOCK);
  });
});
