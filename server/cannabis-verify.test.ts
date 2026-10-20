import { describe, expect, it } from "vitest";
import { analyticsStub } from "./analytics-stub";
import { formatTruthLayerMetadata } from "./cannabis-service";
import { cannabisCallerNumbers } from "./cannabis-verify";

describe("cannabisCallerNumbers", () => {
  it("leaves omitted cannabinoid numbers empty", () => {
    const numbers = cannabisCallerNumbers({});
    expect(numbers).toEqual({
      thcPercent: null,
      cbdPercent: null,
      batchId: null,
      dispensaryId: null,
    });
    expect(JSON.stringify(numbers)).not.toMatch(/25|METRC|Bitcoin|Polygon/);
  });

  it("keeps a percent the caller sent", () => {
    expect(
      cannabisCallerNumbers({
        thcPercent: 18.5,
        cbdPercent: 0,
        batchId: " lot-1 ",
      })
    ).toMatchObject({ thcPercent: 18.5, cbdPercent: 0, batchId: "lot-1" });
  });
});

describe("analyticsStub", () => {
  it("returns zeros and does not name an authenticity rate", () => {
    const stub = analyticsStub("week");
    expect(stub.verifications).toEqual({ total: 0 });
    expect(stub.activeAgents).toBe(0);
    expect(JSON.stringify(stub)).not.toMatch(/authentic|counterfeit|METRC/i);
  });
});

describe("formatTruthLayerMetadata", () => {
  it("does not attach a chain proof to a rarity tally", () => {
    const layer = formatTruthLayerMetadata(
      {
        name: "Example",
        type: "HYBRID",
        genetics: ["A"],
        thcContent: 18,
        cbdContent: 1,
        harvestDate: "2020-01-01T00:00:00.000Z",
      },
      { thc: 18, thca: 20, cbd: 1, cbda: 1, total: 24 }
    );
    expect(JSON.stringify(layer)).not.toMatch(/blockchain_proof|Bitcoin|Polygon|NFT/i);
  });
});
