import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const yml = readFileSync(
  resolve(".github/workflows/marketing-autonomous.yml"),
  "utf8"
);

describe("marketing-autonomous IndexNow first-dollar URLs", () => {
  it("pings Starter checkout and generate surfaces", () => {
    const required = [
      "https://authichain.com/checkout/starter",
      "https://authichain.com/generate",
      "https://authichain.com/onboard",
      "https://qron.space/generate",
    ];
    for (const url of required) {
      expect(yml).toContain(`"${url}"`);
    }
  });
});
