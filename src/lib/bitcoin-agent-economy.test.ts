import { describe, expect, it } from "vitest";
import {
  assertSpendAllowed,
  btcToSats,
  requiresHumanApproval,
  satsToBtc,
  type AgentSpendPolicy,
} from "./bitcoin-agent-economy";

const policy: AgentSpendPolicy = {
  agentId: "AgentZ",
  dailySats: 100_000n,
  perTransactionSats: 25_000n,
  requireHumanApprovalAboveSats: 10_000n,
  allowedPurposePrefixes: ["verification:", "infrastructure:"],
  enabled: true,
};

describe("Bitcoin agent economy", () => {
  it("converts BTC to sats without floating point arithmetic", () => {
    expect(btcToSats("0.001")).toBe(100_000n);
    expect(btcToSats("0.00000001")).toBe(1n);
    expect(satsToBtc(100_000n)).toBe("0.001");
  });

  it("enforces agent, amount, and purpose boundaries", () => {
    expect(() =>
      assertSpendAllowed(policy, {
        agentId: "AgentZ",
        amountSats: 5_000n,
        purpose: "verification:seal-123",
      }),
    ).not.toThrow();

    expect(() =>
      assertSpendAllowed(policy, {
        agentId: "AgentZ",
        amountSats: 30_000n,
        purpose: "verification:seal-123",
      }),
    ).toThrow("PER_TRANSACTION_LIMIT_EXCEEDED");

    expect(() =>
      assertSpendAllowed(policy, {
        agentId: "AgentZ",
        amountSats: 5_000n,
        purpose: "arbitrary:destination",
      }),
    ).toThrow("PURPOSE_NOT_ALLOWED");
  });

  it("requires human approval above the configured threshold", () => {
    expect(requiresHumanApproval(policy, 10_000n)).toBe(false);
    expect(requiresHumanApproval(policy, 10_001n)).toBe(true);
  });
});
