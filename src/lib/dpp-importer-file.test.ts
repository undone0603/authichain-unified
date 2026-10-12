import { describe, expect, it } from "vitest";
import {
  DPP_IMPORTER_FILE_DISCLAIMER,
  DPP_IMPORTER_FILE_SCHEMA,
  buildDppImporterFile,
} from "./dpp-importer-file";

describe("buildDppImporterFile", () => {
  const base = {
    categories: "LMT e-bike pack",
    markets: "DE, FR",
    labeling: "Wh and Ah on pack label; no unique ID yet",
    generatedAt: "2026-10-12T18:00:00.000Z",
  };

  it("marks activation answers present and Annex XIII public items missing", () => {
    const file = buildDppImporterFile(base);
    expect(file.schema).toBe(DPP_IMPORTER_FILE_SCHEMA);
    expect(file.disclaimer).toBe(DPP_IMPORTER_FILE_DISCLAIMER);
    expect(file.product).toEqual({
      categories: base.categories,
      markets: base.markets,
      labeling: base.labeling,
    });
    expect(file.generated_at).toBe(base.generatedAt);
    expect(file.qr.status).toBe("not_issued");

    const byId = Object.fromEntries(file.fields.map((f) => [f.id, f]));
    expect(byId.activation_categories?.status).toBe("present");
    expect(byId.activation_categories?.value).toBe(base.categories);
    expect(byId.activation_markets?.status).toBe("present");
    expect(byId.activation_labeling?.status).toBe("present");
    expect(byId.unique_id?.status).toBe("missing");
    expect(byId.unique_id?.owner).toBe("placing_on_market_operator");
    expect(byId.operator?.status).toBe("missing");
    expect(byId.composition?.status).toBe("restricted");
    expect(byId.qr_living?.status).toBe("out_of_scope");

    expect(file.summary.present).toBe(3);
    expect(file.summary.missing).toBeGreaterThan(0);
    expect(file.fields.every((f) => f.item && f.note && f.owner)).toBe(true);
  });

  it("does not claim a passport, certificate, registry filing, or issued QR", () => {
    const file = buildDppImporterFile(base);
    const blob = JSON.stringify(file).toLowerCase();
    expect(blob).toContain("not a battery passport");
    expect(blob).toContain("not a certificate");
    expect(blob).not.toMatch(/issued as a battery passport/);
    expect(file.qr.status).toBe("not_issued");
    expect(file.fields.some((f) => f.id === "unique_id" && f.status === "present")).toBe(
      false
    );
  });

  it("rejects blank intake", () => {
    expect(() =>
      buildDppImporterFile({
        categories: " ",
        markets: "DE",
        labeling: "x",
      })
    ).toThrow(/categories, markets, and labeling/);
  });

  it("marks Wh/Ah/V present when pack figures are typed", () => {
    const file = buildDppImporterFile({
      ...base,
      pack: {
        model: "Pack-A",
        statedWh: 500,
        ah: 14,
        nominalV: 36,
        cyclesLow: 500,
        cyclesHigh: 800,
      },
    });
    const byId = Object.fromEntries(file.fields.map((f) => [f.id, f]));
    expect(byId.model?.status).toBe("present");
    expect(byId.energy?.status).toBe("present");
    expect(byId.energy?.value).toBe("500 Wh");
    expect(byId.capacity?.status).toBe("present");
    expect(byId.voltage?.status).toBe("present");
    expect(byId.cycles?.status).toBe("present");
    expect(file.product.pack?.statedWh).toBe(500);
    expect(file.summary.present).toBeGreaterThanOrEqual(7);
  });

  it("keeps energy/capacity/voltage missing without pack figures", () => {
    const file = buildDppImporterFile(base);
    const byId = Object.fromEntries(file.fields.map((f) => [f.id, f]));
    expect(byId.energy?.status).toBe("missing");
    expect(byId.capacity?.status).toBe("missing");
    expect(byId.voltage?.status).toBe("missing");
    expect(file.product.pack).toBeUndefined();
  });
});
