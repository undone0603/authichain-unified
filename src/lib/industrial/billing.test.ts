import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  profileError: null as { message: string } | null,
  logs: [] as Record<string, unknown>[],
  create: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("../../../server/config/stripe", () => ({
  getStripe: () => ({ billing: { meterEvents: { create: state.create } } }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "automation_logs") {
        return {
          insert: async (row: Record<string, unknown>) => {
            state.logs.push(row);
            return {};
          },
        };
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data: state.profile,
          error: state.profileError,
        }),
      };
      return chain;
    },
  }),
}));

import { reportAgentUsage } from "./billing";

describe("reportAgentUsage", () => {
  const ORIGINAL = process.env.STRIPE_AGENT_METER_EVENT;

  beforeEach(() => {
    state.profile = {
      stripe_customer_id: "cus_123",
      subscription_status: "active",
    };
    state.profileError = null;
    state.logs = [];
    state.create = vi.fn().mockResolvedValue({});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.STRIPE_AGENT_METER_EVENT;
    else process.env.STRIPE_AGENT_METER_EVENT = ORIGINAL;
    vi.restoreAllMocks();
  });

  it("sends nothing to Stripe while the flag is unset", async () => {
    delete process.env.STRIPE_AGENT_METER_EVENT;
    await reportAgentUsage("u1", "verify_product");
    expect(state.create).not.toHaveBeenCalled();
    expect(state.logs).toEqual([]);
  });

  it("sends a meter event for an entitled customer", async () => {
    process.env.STRIPE_AGENT_METER_EVENT = "agent_tool_calls";
    await reportAgentUsage("u1", "check_eu_dpp");
    expect(state.create).toHaveBeenCalledTimes(1);
    const [params] = state.create.mock.calls[0];
    expect(params).toMatchObject({
      event_name: "agent_tool_calls",
      payload: { stripe_customer_id: "cus_123", value: "100" },
    });
    expect(params.identifier).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.logs[0]).toMatchObject({
      workflow_name: "metered_usage_reported",
      status: "success",
    });
  });

  it.each([
    ["no profile", null],
    [
      "no customer",
      { stripe_customer_id: null, subscription_status: "active" },
    ],
    [
      "canceled",
      { stripe_customer_id: "cus_1", subscription_status: "canceled" },
    ],
    [
      "past_due",
      { stripe_customer_id: "cus_1", subscription_status: "past_due" },
    ],
  ])("skips %s", async (_label, profile) => {
    process.env.STRIPE_AGENT_METER_EVENT = "agent_tool_calls";
    state.profile = profile;
    await reportAgentUsage("u1", "verify_product");
    expect(state.create).not.toHaveBeenCalled();
  });

  it("swallows a Stripe error and logs the failure", async () => {
    process.env.STRIPE_AGENT_METER_EVENT = "agent_tool_calls";
    state.create.mockRejectedValueOnce(new Error("No meter found"));
    await expect(
      reportAgentUsage("u1", "verify_product")
    ).resolves.toBeUndefined();
    await Promise.resolve();
    expect(state.logs).toContainEqual(
      expect.objectContaining({
        status: "failure",
        error_message: "No meter found",
      })
    );
  });
});
