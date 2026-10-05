import { describe, it, expect } from "vitest";
import {
  accessDeniedMessage,
  decideComplianceAccess,
  loadComplianceProfile,
  type ComplianceProfile,
} from "./compliance-access";
import { COMPLIANCE_PLAN_ID, planById, planPaymentLink } from "./plans";

const OWNER = "owner@example.com";

function profile(
  plan: string | null,
  status: string | null
): ComplianceProfile {
  return { id: "p1", subscription_plan: plan, subscription_status: status };
}

describe("decideComplianceAccess", () => {
  it.each([
    ["active subscriber", profile(COMPLIANCE_PLAN_ID, "active"), true, "plan"],
    [
      "trialing subscriber",
      profile(COMPLIANCE_PLAN_ID, "trialing"),
      true,
      "plan",
    ],
    [
      "past_due subscriber",
      profile(COMPLIANCE_PLAN_ID, "past_due"),
      false,
      "inactive",
    ],
    [
      "cancelled subscriber",
      profile(COMPLIANCE_PLAN_ID, "cancelled"),
      false,
      "inactive",
    ],
    ["status missing", profile(COMPLIANCE_PLAN_ID, null), false, "inactive"],
    ["other paid plan", profile("dpp_readiness", "active"), false, "no_plan"],
    ["no plan", profile(null, null), false, "no_plan"],
    ["no profile", null, false, "no_profile"],
  ])("%s", (_label, p, allowed, reason) => {
    const result = decideComplianceAccess({
      email: "buyer@example.com",
      profile: p,
      ownerEmail: OWNER,
    });
    expect(result.allowed).toBe(allowed);
    expect(result.reason).toBe(reason);
  });

  it("lets the owner in without a plan, case-insensitively", () => {
    const result = decideComplianceAccess({
      email: "Owner@Example.com ",
      profile: null,
      ownerEmail: OWNER,
    });
    expect(result).toEqual({ allowed: true, reason: "owner", profileId: null });
  });

  it("does not treat a missing owner email as a match", () => {
    expect(
      decideComplianceAccess({ email: "", profile: null, ownerEmail: "" })
        .allowed
    ).toBe(false);
  });
});

describe("loadComplianceProfile", () => {
  function fakeAdmin(rows: Record<string, ComplianceProfile[]>) {
    const calls: string[] = [];
    const admin = {
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => ({
            limit: async () => {
              calls.push(`${column}=${value}`);
              return { data: rows[`${column}=${value}`] ?? [], error: null };
            },
          }),
        }),
      }),
    };
    return { admin, calls };
  }

  it("prefers the profile linked to the auth user id", async () => {
    const { admin, calls } = fakeAdmin({
      "user_id=u1": [profile(COMPLIANCE_PLAN_ID, "active")],
    });
    const found = await loadComplianceProfile(admin, {
      id: "u1",
      email: "a@b.co",
    });
    expect(found?.subscription_plan).toBe(COMPLIANCE_PLAN_ID);
    expect(calls).toEqual(["user_id=u1"]);
  });

  it("falls back to the lowercased verified email (guest checkout profile)", async () => {
    const { admin, calls } = fakeAdmin({
      "email=buyer@example.com": [profile(COMPLIANCE_PLAN_ID, "active")],
    });
    const found = await loadComplianceProfile(admin, {
      id: "u2",
      email: " Buyer@Example.com",
    });
    expect(found?.id).toBe("p1");
    expect(calls).toEqual(["user_id=u2", "email=buyer@example.com"]);
  });

  it("returns null when neither matches", async () => {
    const { admin } = fakeAdmin({});
    expect(
      await loadComplianceProfile(admin, { id: "u3", email: null })
    ).toBeNull();
  });
});

describe("enterprise_compliance catalogue state", () => {
  it("is not sellable until it has a real price and Stripe price", () => {
    expect(planById(COMPLIANCE_PLAN_ID)).toBeUndefined();
    expect(planPaymentLink(COMPLIANCE_PLAN_ID)).toBeUndefined();
  });

  it("explains a lapsed subscription differently from no subscription", () => {
    expect(accessDeniedMessage("inactive")).toMatch(/not active/);
    expect(accessDeniedMessage("no_plan")).toMatch(/does not have/);
  });
});
