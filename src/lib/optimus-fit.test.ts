import { describe, expect, it } from "vitest";
import { fitOptimus, INDUSTRIAL_ART77_KWH } from "./optimus-fit";

const PUBLIC_HASH = "ab".repeat(32);
const RESTRICTED_HASH = "cd".repeat(32);

describe("fitOptimus", () => {
  it("identifies a robot and does not apply Article 77", () => {
    const fit = fitOptimus({
      kind: "robot",
      identifier: "OP-UNIT-1",
      model: "Optimus",
      batteryIdentifier: "PACK-9",
      commercial: {
        unitCost: 20000,
        currency: "USD",
        supplierName: "Secret Co",
      },
      evidence: [
        {
          id: "public-coa",
          kind: "test_report",
          sha256: PUBLIC_HASH,
          audience: "public",
        },
        {
          id: "bom",
          kind: "document",
          sha256: RESTRICTED_HASH,
          audience: "restricted",
        },
      ],
    });

    expect(fit.identity).toEqual({
      kind: "robot",
      key: "optimus:robot:OP-UNIT-1",
      missing: [],
    });
    expect(fit.batteryDuty.applies).toBe(false);
    expect(fit.batteryDuty.state).toBe("not_a_battery");
    expect(fit.batteryDuty.reason).toContain("PACK-9");
    expect(fit.publicRecord.evidence).toEqual([
      { id: "public-coa", kind: "test_report", sha256: PUBLIC_HASH },
    ]);
    const published = JSON.stringify(fit.publicRecord);
    expect(published).not.toContain(RESTRICTED_HASH);
    expect(published).not.toContain("Secret Co");
    expect(published).not.toContain("20000");
    expect(fit.doesNotClaim).toContain(
      "not a statement that any Optimus unit must carry one"
    );
  });

  it("leaves the key empty when the operator supplied no identifier", () => {
    const fit = fitOptimus({ kind: "supplier_lot", identifier: "   " });
    expect(fit.identity.key).toBeNull();
    expect(fit.identity.missing).toContain("identifier");
    expect(fit.batteryDuty.state).toBe("not_a_battery");
  });

  it("records Article 77 for an industrial battery above 2 kWh on the EU market", () => {
    const fit = fitOptimus({
      kind: "battery",
      identifier: "PACK-9",
      batteryClass: "industrial",
      capacityKwh: INDUSTRIAL_ART77_KWH + 0.1,
      placedOnEuMarket: true,
    });
    expect(fit.batteryDuty).toMatchObject({
      applies: true,
      state: "art77",
      categoryId: "battery_passport",
      citation: "Regulation (EU) 2023/1542, Art. 77",
      date: "2027-02-18",
    });
  });

  it("keeps an industrial battery at exactly 2 kWh outside Article 77", () => {
    const fit = fitOptimus({
      kind: "battery",
      identifier: "PACK-2",
      batteryClass: "industrial",
      capacityKwh: INDUSTRIAL_ART77_KWH,
      putIntoServiceInEu: true,
    });
    expect(fit.batteryDuty.applies).toBe(false);
    expect(fit.batteryDuty.state).toBe("below_threshold");
    expect(fit.batteryDuty.categoryId).toBe("battery_other");
  });

  it("does not apply Article 77 when the battery is not on the EU market", () => {
    const fit = fitOptimus({
      kind: "battery",
      identifier: "PACK-US",
      batteryClass: "industrial",
      capacityKwh: 4,
      placedOnEuMarket: false,
    });
    expect(fit.batteryDuty.state).toBe("not_on_eu_market");
    expect(fit.batteryDuty.applies).toBe(false);
  });

  it("does not assume a duty when class, capacity, or EU placing is missing", () => {
    const unknownClass = fitOptimus({
      kind: "battery",
      identifier: "PACK-X",
      placedOnEuMarket: true,
    });
    expect(unknownClass.batteryDuty.state).toBe("unknown");
    expect(unknownClass.identity.missing).toContain("batteryClass");

    const unknownCapacity = fitOptimus({
      kind: "battery",
      identifier: "PACK-Y",
      batteryClass: "industrial",
      placedOnEuMarket: true,
    });
    expect(unknownCapacity.batteryDuty.state).toBe("unknown");
    expect(unknownCapacity.identity.missing).toContain("capacityKwh");

    const unknownMarket = fitOptimus({
      kind: "battery",
      identifier: "PACK-Z",
      batteryClass: "ev",
      capacityKwh: 10,
    });
    expect(unknownMarket.batteryDuty.state).toBe("unknown");
    expect(unknownMarket.identity.missing).toContain("euMarket");
    expect(unknownMarket.batteryDuty.applies).toBe(false);
  });

  it("applies Article 77 to LMT and EV classes without a 2 kWh floor", () => {
    for (const batteryClass of ["lmt", "ev"] as const) {
      const fit = fitOptimus({
        kind: "battery",
        identifier: batteryClass,
        batteryClass,
        putIntoServiceInEu: true,
      });
      expect(fit.batteryDuty.applies).toBe(true);
      expect(fit.batteryDuty.categoryId).toBe("battery_passport");
    }
  });

  it("maps portable and SLI batteries to the other-battery category", () => {
    const fit = fitOptimus({
      kind: "battery",
      identifier: "CELL-1",
      batteryClass: "portable",
      placedOnEuMarket: true,
      capacityKwh: 0.05,
    });
    expect(fit.batteryDuty.state).toBe("class_out");
    expect(fit.batteryDuty.categoryId).toBe("battery_other");
  });

  it("rejects an unsupported batteryClass at runtime instead of treating it as industrial", () => {
    const unsupported = [
      "fusion",
      "INDUSTRIAL",
      "Industrial",
      "other",
      2,
      { label: "industrial" },
    ];
    for (const batteryClass of unsupported) {
      const fit = fitOptimus({
        kind: "battery",
        identifier: "PACK-BAD",
        batteryClass: batteryClass as never,
        capacityKwh: INDUSTRIAL_ART77_KWH + 10,
        placedOnEuMarket: true,
      });
      expect(fit.batteryDuty.applies).toBe(false);
      expect(fit.batteryDuty.state).toBe("unknown");
      expect(fit.batteryDuty.categoryId).toBeNull();
      expect(fit.batteryDuty.reason).toContain("not a supported value");
      expect(fit.identity.missing).toContain("batteryClass");
    }
  });

  it("keeps unknown class distinct from a class that is not applicable", () => {
    const unknown = fitOptimus({
      kind: "battery",
      identifier: "PACK-U",
      batteryClass: "unknown",
      capacityKwh: 40,
      placedOnEuMarket: true,
    });
    expect(unknown.batteryDuty.applies).toBe(false);
    expect(unknown.batteryDuty.state).toBe("unknown");
    expect(unknown.batteryDuty.categoryId).toBeNull();

    const notApplicable = fitOptimus({
      kind: "battery",
      identifier: "PACK-S",
      batteryClass: "sli",
      capacityKwh: 40,
      placedOnEuMarket: true,
    });
    expect(notApplicable.batteryDuty.applies).toBe(false);
    expect(notApplicable.batteryDuty.state).toBe("class_out");
    expect(notApplicable.batteryDuty.categoryId).toBe("battery_other");
  });

  it("drops a public evidence item whose digest is not a SHA-256", () => {
    const fit = fitOptimus({
      kind: "supplier_lot",
      identifier: "LOT-1",
      evidence: [
        {
          id: "bad",
          kind: "certificate",
          sha256: "not-a-hash",
          audience: "public",
        },
      ],
    });
    expect(fit.publicRecord.evidence).toEqual([]);
  });
});
