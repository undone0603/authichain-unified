import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AFFILIATE_BASE_RATE } from "./affiliate-rate";

describe("AFFILIATE_BASE_RATE", () => {
  it("matches the Starter tier advertised on /affiliate", () => {
    const page = readFileSync(
      join(__dirname, "../app/affiliate/page.tsx"),
      "utf8"
    );
    const starter = page.match(
      /name: 'Starter',[\s\S]*?commission: '(\d+)%'/
    );
    expect(starter?.[1]).toBe(String(Math.round(AFFILIATE_BASE_RATE * 100)));
  });

  it("is never written as the old 10% literal in the join route", () => {
    const join_ = readFileSync(
      join(__dirname, "../app/api/affiliate/join/route.ts"),
      "utf8"
    );
    expect(join_).not.toMatch(/commission_rate:\s*0\.1\b/);
  });
});
