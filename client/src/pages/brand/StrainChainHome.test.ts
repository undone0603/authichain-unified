import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const HOMES = [
  "client/src/pages/brand/StrainChainHome.tsx",
  "apps/client/src/pages/brand/StrainChainHome.tsx",
];

describe("StrainChain home passport copy", () => {
  for (const rel of HOMES) {
    it(`${rel} states the $49 passport and does not claim a track-and-trace connection`, () => {
      const src = read(rel);
      expect(src).toContain("$49");
      expect(src).toContain("certificates you already have");
      expect(src).not.toMatch(/METRC|BioTrack|DSCSA/i);
      expect(src).not.toMatch(/\$199|\$499|\$999/);
      expect(src).not.toMatch(/NFT|ERC-721|polygonscan/i);
    });
  }

  it("the GovChain card describes that same passport", () => {
    for (const rel of [
      "client/src/pages/brand/GovChainHome.tsx",
      "apps/client/src/pages/brand/GovChainHome.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain(
        "A published genetics passport for one cultivar, built from certificates you already have."
      );
      expect(src).not.toMatch(/METRC compliance/);
    }
  });
});
