import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { audioStoryScript } from "./audio-story";

describe("audioStoryScript", () => {
  it("omits a missing manufacturing date and does not call the product verified", () => {
    const script = audioStoryScript({ brandName: "Example", strainName: "Cultivar" });
    expect(script).toBe("Recorded story for Cultivar by Example.");
    expect(script).not.toMatch(/Recent|verified|Bitcoin|authentic|Truth Layer|genuine/i);
    const dated = audioStoryScript({
      brandName: "Example",
      strainName: "Cultivar",
      harvestDate: "2020-01-01T00:00:00.000Z",
      thcContent: "18",
    });
    expect(dated).toContain("2020-01-01T00:00:00.000Z");
    expect(dated).toContain("THC content supplied as 18.");
    expect(dated).not.toMatch(/Recent|verified|Bitcoin|authentic|Truth Layer/i);
    const src = readFileSync(path.join(import.meta.dirname, "asset-service.ts"), "utf8");
    expect(src).not.toMatch(/Recent|\|\| 50/);
  });
});
