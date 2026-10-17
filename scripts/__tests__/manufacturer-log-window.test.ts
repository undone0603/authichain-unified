import { describe, expect, it } from "vitest";
import {
  DEPLOYED_BLOCK,
  FREE_RPC_SPAN,
  ROLE_IDS,
  compareHistory,
  logFromBlock,
  roleName,
  timestampWord,
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

  it("reads one timestamp word and ignores anything else", () => {
    expect(timestampWord("0x" + "0".repeat(62) + "0a")).toBe("10");
    expect(timestampWord("0x")).toBeNull();
    expect(timestampWord("0x" + "ab".repeat(40))).toBeNull();
  });

  it("names the four contract roles and hides any other topic", () => {
    expect(roleName(ROLE_IDS.minter)).toBe("minter");
    expect(roleName(ROLE_IDS.admin.toUpperCase())).toBe("admin");
    expect(roleName(ROLE_IDS.updater)).toBe("updater");
    expect(roleName(ROLE_IDS.pauser)).toBe("pauser");
    expect(roleName("0x" + "ab".repeat(32))).toBe("unknown");
  });

  it("orders a later log in the same block first", () => {
    const older = { block: "100", logIndex: "1" };
    const newer = { block: "100", logIndex: "4" };
    const nextBlock = { block: "101", logIndex: "0" };
    expect(compareHistory(older, newer)).toBe(1);
    expect(compareHistory(newer, older)).toBe(-1);
    expect(compareHistory(older, nextBlock)).toBe(1);
  });
});
