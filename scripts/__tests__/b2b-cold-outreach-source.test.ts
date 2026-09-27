// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

// b2b-outreach.yml runs this file with `tsx` on a schedule. #1208 merged a
// stale copy over #1207's rewrite: the file stopped parsing (so every
// scheduled run died before sending) and it carried the old email copy that
// #1207 removed for making claims the product does not back.
const SOURCE = join(process.cwd(), "scripts", "b2b-cold-outreach.ts");
const src = readFileSync(SOURCE, "utf8");

describe("scripts/b2b-cold-outreach.ts", () => {
  it("parses", () => {
    expect(() => transformSync(src, { loader: "ts" })).not.toThrow();
  });

  it("takes its copy from scripts/lib/b2b-templates.ts, not local templates", () => {
    expect(src).toContain('from "./lib/b2b-templates"');
    for (const name of ["govchainEmail", "strainchaineEmail", "qronEmail", "partnerEmail"]) {
      expect(src).not.toMatch(new RegExp(`\\nfunction ${name}\\(`));
    }
  });

  it("does not carry the copy #1207 removed", () => {
    for (const phrase of [
      "C3PAOs are increasingly flagging",
      "METRC sync",
      "ISO 18013-5",
      "$0.002/QR",
      "tamper-proof",
      "7-day trial",
    ]) {
      expect(src).not.toContain(phrase);
    }
  });
});
