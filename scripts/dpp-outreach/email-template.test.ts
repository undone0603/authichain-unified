// MKT-117 / RES-232: the DPP outreach template body must not promise a
// workspace or generations. The subject line (line 3) is renamed on #1727.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const tpl = readFileSync(
  path.resolve(process.cwd(), "scripts/dpp-outreach/email-template.txt"),
  "utf8",
);
const body = tpl
  .split("\n")
  .filter((l) => !l.startsWith("Subject:"))
  .join("\n");

describe("dpp-outreach email-template", () => {
  it("has the gated $299 line", () => {
    expect(tpl).toContain(
      "EU DPP Readiness is $299. Stripe confirms your payment and links you to a short onboarding form. The readiness work itself is in development.",
    );
  });
  it("has no workspace or 50-generations claim", () => {
    expect(body).not.toMatch(/workspace/i);
    expect(tpl).not.toMatch(/50 generations/i);
  });
  it("keeps the disclaimer", () => {
    expect(tpl).toMatch(/not legal advice/i);
    expect(tpl).toMatch(/EUDAMED/);
  });
});
