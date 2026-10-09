import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderBillingEmail } from "./billing-emails";

// $299 DPP Readiness buyer copy (ADM-180, RES-214, RES-216, MKT-109).
const ABSENT = [
  /workspace is ready/i,
  /50 (workspace )?generations/i,
  /AuthiChain workspace/i,
  /email you before anything is delivered/i,
  /reply to (this|your confirmation) email/i,
];

describe("dpp_audit_provisioned email", () => {
  const mail = renderBillingEmail("dpp_audit_provisioned", "authichain", {
    activateUrl: "https://authichain.com/dpp/activate?session_id=cs_1",
  });

  it("uses the gated MKT-109 wording", () => {
    expect(mail.subject).toBe("Your AuthiChain payment confirmation");
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("Thanks for your $299 payment. This email confirms it.");
      expect(part).toContain("Your next step is the onboarding form:");
      expect(part).toContain("The readiness work is in development.");
      expect(part).toContain(
        "If you'd rather not wait, email support@authichain.com and we'll refund the full $299."
      );
      expect(part).toContain("https://authichain.com/dpp/activate?session_id=cs_1");
    }
  });

  it("drops the workspace, generations and follow-up claims", () => {
    for (const part of [mail.subject, mail.html, mail.text]) {
      for (const re of ABSENT) expect(part).not.toMatch(re);
    }
  });
});

describe("Next.js DPP thanks/activate pages", () => {
  const root = join(__dirname, "..", "app", "dpp");
  const thanks = readFileSync(join(root, "thanks", "page.tsx"), "utf8").replace(/\s+/g, " ");
  const activate = readFileSync(join(root, "activate", "page.tsx"), "utf8").replace(/\s+/g, " ");

  it("thanks page carries the gated wording", () => {
    expect(thanks).toContain("Thanks. This confirms your $299 payment. Next, use the link in your confirmation email to fill in the short onboarding form. The readiness work itself is in development.");
    expect(thanks).toContain("email support@authichain.com and we&apos;ll refund the full $299.");
    expect(thanks).not.toMatch(/onboarding form below/i);
  });

  it("neither page makes the workspace or generations claim", () => {
    for (const src of [thanks, activate]) {
      for (const re of ABSENT) expect(src).not.toMatch(re);
      expect(src).not.toMatch(/Workspace (opened|activated)/i);
    }
    expect(activate).toContain("The readiness work is in development.");
  });
});
