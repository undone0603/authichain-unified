import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const PAGES = [
  "src/app/_home/StrainchainHome.tsx",
  "src/app/supply-chain/page.tsx",
];

describe("StrainChain passport copy", () => {
  for (const rel of PAGES) {
    it(`${rel} states the $49 passport and does not claim a track-and-trace connection`, () => {
      const src = read(rel);
      expect(src).toContain("$49");
      expect(src).toContain("certificates you already have");
      expect(src).not.toMatch(/METRC|BioTrack|DSCSA/i);
      expect(src).not.toMatch(/NFT/);
    });
  }

  it("the StrainChain price card and the shadow catalog use that passport", () => {
    for (const rel of [
      "client/src/components/MonetizationArchitecture.tsx",
      "apps/client/src/components/MonetizationArchitecture.tsx",
      "server/config/stripe.ts",
    ]) {
      const src = read(rel);
      expect(src).toContain("$49");
      expect(src).toContain("certificates you already have");
      expect(src).not.toMatch(/METRC|BioTrack|DSCSA/i);
    }
  });

  it("a recorded supply-chain event does not scan a passport", () => {
    for (const rel of [
      "client/src/pages/SupplyChain.tsx",
      "apps/client/src/pages/SupplyChain.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain("does not scan a product passport");
      expect(src).not.toMatch(/blockchain verification/);
    }
  });
});
