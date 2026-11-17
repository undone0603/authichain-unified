import { describe, expect, it } from "vitest";
import { BRANDS } from "@shared/brands";
import { renderBillingEmail } from "./billing-emails";

/**
 * AuthiChain billing must use a sender domain verified for this Resend account.
 * Tests render-only behavior; they never send mail or hit a provider.
 */
describe("AuthiChain billing sender domain", () => {
  it("uses the verified sending subdomain for DPP and subscription mail", () => {
    for (const type of ["dpp_audit_provisioned", "subscription_confirmed"] as const) {
      const email = renderBillingEmail(type, "authichain");
      expect(email.from).toBe("AuthiChain <billing@send.authichain.com>");
    }
  });

  it("keeps the monitored support mailbox and other brands unchanged", () => {
    expect(BRANDS.authichain.billing.supportEmail).toBe("support@authichain.com");
    expect(BRANDS.qron.billing.emailFrom).toBe("QRON <billing@qron.space>");
    expect(BRANDS.strainchain.billing.emailFrom).toBe("StrainChain <billing@strainchain.io>");
    expect(BRANDS.govchain.billing.emailFrom).toBe("GovChain <billing@govchain.us>");
  });
});
