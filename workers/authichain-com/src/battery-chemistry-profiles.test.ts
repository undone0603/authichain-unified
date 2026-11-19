import { describe, expect, it } from "vitest";
import {
  CHEMISTRY_IDS,
  CHEMISTRY_PROFILES,
  DUE_DILIGENCE_FROM,
  chemistryRows,
  isChemistryId,
  type ChemistryId,
} from "./battery-chemistry-profiles.ts";
import {
  NON_LITHIUM_PATH,
  isNonLithiumPath,
  renderNonLithiumPage,
} from "./battery-non-lithium-page.ts";
import { ICP_SEO_SITEMAP_PATHS } from "./icp-seo-sitemap.ts";

const status = (id: ChemistryId, row: string) =>
  chemistryRows(id).find(r => r.id === row)!.status;

describe("battery chemistry profiles", () => {
  it("lithium-ion triggers due diligence and recycled content later", () => {
    expect(status("lithium_ion", "due_diligence")).toBe("phased");
    expect(status("lithium_ion", "recycled")).toBe("phased");
  });

  it("iron-air and zinc trigger neither Annex X due diligence nor Art. 8", () => {
    for (const id of ["iron_air", "zinc"] as const) {
      expect(status(id, "due_diligence")).toBe("not_triggered");
      expect(status(id, "recycled")).toBe("not_triggered");
    }
  });

  it("nickel-zinc is caught by nickel; lead-acid only by Art. 8 lead", () => {
    expect(status("nickel_zinc", "due_diligence")).toBe("phased");
    expect(status("nickel_zinc", "recycled")).toBe("phased");
    expect(status("lead_acid", "due_diligence")).toBe("not_triggered");
    expect(status("lead_acid", "recycled")).toBe("phased");
  });

  it("flow batteries are excluded from Art. 8 and get the later carbon date", () => {
    for (const id of ["iron_flow", "vanadium_flow"] as const) {
      expect(CHEMISTRY_PROFILES[id].externalStorage).toBe(true);
      expect(status(id, "recycled")).toBe("not_triggered");
      const carbon = chemistryRows(id).find(r => r.id === "carbon")!;
      expect(carbon.note).toContain("2030-08-18");
    }
    const ironAirCarbon = chemistryRows("iron_air").find(r => r.id === "carbon")!;
    expect(ironAirCarbon.note).toContain("2026-02-18");
  });

  it("never guesses a composition-dependent chemistry", () => {
    expect(status("sodium_ion", "due_diligence")).toBe("check");
    expect(status("sodium_ion", "recycled")).toBe("check");
  });

  it("uses the postponed due diligence date", () => {
    expect(DUE_DILIGENCE_FROM).toBe("2027-08-18");
    const li = chemistryRows("lithium_ion").find(r => r.id === "due_diligence")!;
    expect(li.note).toContain("2025/1561");
  });

  it("validates ids", () => {
    expect(isChemistryId("iron_air")).toBe(true);
    expect(isChemistryId("unobtainium")).toBe(false);
    expect(CHEMISTRY_IDS.length).toBe(8);
  });
});

describe("non-lithium explainer page", () => {
  const html = renderNonLithiumPage();

  it("matches only its own path and is in the sitemap", () => {
    expect(isNonLithiumPath(NON_LITHIUM_PATH)).toBe(true);
    expect(isNonLithiumPath(`${NON_LITHIUM_PATH}/`)).toBe(true);
    expect(isNonLithiumPath("/battery-passport")).toBe(false);
    expect(ICP_SEO_SITEMAP_PATHS).toContain(NON_LITHIUM_PATH);
  });

  it("renders every chemistry from the profiles", () => {
    for (const id of CHEMISTRY_IDS) {
      expect(html).toContain(CHEMISTRY_PROFILES[id].label.replace(/&/g, "&amp;"));
    }
    expect(html).toContain("Not triggered");
    expect(html).toContain("Check composition");
  });

  it("is hedged and makes no social-proof claims", () => {
    expect(html).toContain("not legal advice");
    expect(html).toContain("not an issued passport");
    expect(html).toContain("$950");
    expect(html).not.toMatch(/testimonial|trusted by|customers love|guarantee/i);
  });
});
