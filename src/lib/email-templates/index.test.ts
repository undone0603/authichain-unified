import { describe, expect, it } from "vitest";
import { generateObjectionBudgetTemplate } from "./index";

describe("generateObjectionBudgetTemplate", () => {
  it("quotes the public DPP checkout and no pilot price", () => {
    const email = generateObjectionBudgetTemplate({
      leadName: "Ada",
      pilotPrice: "$2,999",
    });
    expect(email.body).toContain("https://authichain.com/checkout/dpp_readiness");
    expect(email.body).not.toContain("$2,999");
    expect(email.body).not.toContain("$X/month");
    expect(email.body).not.toContain("pilot");
  });
});
