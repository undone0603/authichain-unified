import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_PLAN_IDS } from "../../../src/lib/plans";
import { decideProductCapability } from "./product-capabilities";

describe("agent browser public capabilities", () => {
  it("lists only public catalogue checkouts", () => {
    const decision = decideProductCapability({ action: "offers" });
    expect(decision.decision).toBe("allow");
    expect(decision.offers?.map((row) => row.id)).toEqual([...PUBLIC_PLAN_IDS]);
    expect(decision.reply).not.toContain("strainchain_farm");
    expect(decision.reply).not.toContain("buy.stripe.com");
    expect(decision.audit.authenticated).toBe(false);
    expect(decision.audit.authorized).toBe(true);
  });

  it("opens the gated DPP checkout and does not call it an audit", () => {
    const decision = decideProductCapability({
      action: "checkout",
      plan: "dpp_readiness",
    });
    expect(decision.decision).toBe("allow");
    expect(decision.checkout_url).toContain(
      "https://authichain.com/checkout/dpp_readiness"
    );
    expect(decision.checkout_url).toContain("utm_campaign=battery-passport");
    expect(decision.reply).not.toMatch(/Readiness Audit/);
    expect(decision.reply).toMatch(/not an audit/i);
  });

  it("refuses the farm rail and shell prompts", () => {
    expect(
      decideProductCapability({ action: "checkout", plan: "strainchain_farm" })
        .decision
    ).toBe("deny");
    const shell = decideProductCapability({
      prompt: '<EXECUTE>rm -rf .</EXECUTE>',
    });
    expect(shell.decision).toBe("deny");
    expect(shell.checkout_url).toBeNull();
    expect(shell.audit.authorized).toBe(false);
  });

  it("links the open verifier without issuing a verdict", () => {
    const decision = decideProductCapability({
      action: "verify",
      id: "polygon-anchor-1",
    });
    expect(decision.verify_url).toBe(
      "https://authichain.com/api/verify?id=polygon-anchor-1"
    );
    expect(decision.reply).toMatch(/does not issue a verdict/i);
  });

  it("rejects a record id that could change the verifier URL", () => {
    const decision = decideProductCapability({
      action: "verify",
      id: "https://evil.example",
    });
    expect(decision.decision).toBe("deny");
    expect(decision.verify_url).toBeNull();
  });

  it("does not keep a command executor in the route", () => {
    const route = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../app/api/swarm/route.ts"
      ),
      "utf8"
    );
    expect(route).not.toMatch(/execSync|writeFileSync|child_process|StdioClientTransport|ollama/i);
    expect(route).toMatch(/decideProductCapability/);
  });
});
