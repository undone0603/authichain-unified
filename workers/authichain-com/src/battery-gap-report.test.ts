import { describe, expect, it } from "vitest";
import { annexXiiiRows } from "./battery-gap-map.ts";
import {
  REPORT_DISCLAIMER,
  buildGapReport,
  markdownToHtml,
  modelReport,
  validateIntake,
  type GapReportIntake,
} from "./battery-gap-report.ts";

const intake = (over: Partial<GapReportIntake> = {}): GapReportIntake => ({
  orderRef: "cs_test_example",
  company: "Example Packs Inc.",
  preparedOn: "2026-11-19",
  modelsPaid: 1,
  models: [
    {
      model: "EX-48V-20Ah",
      statedWh: 960,
      ah: 20,
      nominalV: 48,
      cyclesLow: 1500,
      cyclesHigh: 2000,
      placing: "self",
      available: {
        conformity: "EU declaration of conformity draft, rev B",
        composition: "Cathode/anode bill of materials from cell supplier",
      },
    },
  ],
  ...over,
});

describe("validateIntake", () => {
  it("accepts a complete intake", () => {
    expect(() => validateIntake(intake())).not.toThrow();
  });

  it("refuses more models than were paid for", () => {
    const i = intake();
    i.models.push({ ...i.models[0], model: "EX-36V" });
    expect(() => validateIntake(i)).toThrow(
      /2 models submitted but 1 paid for/
    );
  });

  it("lists every problem at once", () => {
    const err = (() => {
      try {
        validateIntake(
          intake({
            orderRef: "",
            preparedOn: "19/11/2026",
            models: [
              { model: "", statedWh: 0, ah: 1, nominalV: 1, placing: "self" },
            ],
          })
        );
      } catch (e) {
        return String(e);
      }
      return "";
    })();
    expect(err).toMatch(/orderRef is required/);
    expect(err).toMatch(/preparedOn must be an ISO date/);
    expect(err).toMatch(/Model is required/);
    expect(err).toMatch(/Stated energy/);
  });

  it("rejects an unknown or customer-figure row id in available", () => {
    const i = intake();
    i.models[0].available = { conformty: "typo" };
    expect(() => validateIntake(i)).toThrow(
      /available\.conformty is not an item/
    );
    i.models[0].available = { energy: "we have it" };
    expect(() => validateIntake(i)).toThrow(/available\.energy is not an item/);
  });
});

describe("modelReport", () => {
  it("covers every Annex XIII row from the gap map exactly once", () => {
    const m = intake().models[0];
    expect(modelReport(m).rows.map(r => r.id)).toEqual(
      annexXiiiRows(m).map(r => r.id)
    );
  });

  it("marks typed figures, customer statements, gaps and restricted items", () => {
    const r = modelReport(intake().models[0]);
    const by = Object.fromEntries(r.rows.map(x => [x.id, x]));
    expect(by.energy.reportStatus).toBe("have_figure");
    expect(by.conformity.reportStatus).toBe("have_reported");
    expect(by.conformity.customerStatement).toBe(
      "EU declaration of conformity draft, rev B"
    );
    expect(by.carbon.reportStatus).toBe("missing");
    expect(by.composition.reportStatus).toBe("restricted_prepared");
    expect(by.test_reports.reportStatus).toBe("restricted");
    expect(by.commercial.reportStatus).toBe("outside");
    expect(r.counts.have_figure).toBe(5);
    expect(r.counts.have_reported).toBe(1);
    expect(r.counts.missing).toBe(10);
  });

  it("flags an energy figure that does not match V × Ah", () => {
    const m = { ...intake().models[0], statedWh: 1000 };
    expect(modelReport(m).consistency).toMatch(
      /^Recheck before publishing: 48 V × 20 Ah = 960 Wh, but 1000 Wh/
    );
  });

  it("names the cell maker as supplier when the cell maker places the battery", () => {
    const m = { ...intake().models[0], placing: "cell_maker" as const };
    const carbon = modelReport(m).rows.find(x => x.id === "carbon")!;
    expect(carbon.note).toMatch(/^Your cell maker places this battery/);
  });
});

describe("buildGapReport", () => {
  it("renders the promised sections with the disclaimer at the top and bottom", () => {
    const { markdown } = buildGapReport(intake());
    expect(markdown).toMatch(
      /^# EU Battery Passport gap report — Example Packs Inc\./
    );
    expect(markdown).toContain("Order cs_test_example");
    expect(markdown).toContain("### What you have");
    expect(markdown).toContain("### What is missing, and who supplies it");
    expect(markdown).toContain("18 February 2027");
    expect(markdown.split(REPORT_DISCLAIMER).length - 1).toBe(2);
    expect(markdown).toContain(
      'You report: "EU declaration of conformity draft, rev B" (not reviewed)'
    );
  });

  it("never invents an identifier or passport ID", () => {
    const { markdown } = buildGapReport(intake());
    expect(markdown).not.toMatch(/urn:|did:|passport id:|[0-9a-f]{16,}/i);
  });

  it("is deterministic for the same intake", () => {
    expect(buildGapReport(intake()).markdown).toBe(
      buildGapReport(intake()).markdown
    );
  });

  it("escapes customer text in the HTML", () => {
    const i = intake({ company: "<script>alert(1)</script> Co" });
    i.models[0].available = { conformity: 'DoC "rev | B" <b>' };
    const { html } = buildGapReport(i);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;rev | B&quot; &lt;b&gt;");
  });
});

describe("markdownToHtml", () => {
  it("renders tables, lists and headings", () => {
    const html = markdownToHtml(
      "# T\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- x\n- **y**\n\n1. one\n2. two"
    );
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain("<th>A</th><th>B</th>");
    expect(html).toContain("<td>1</td><td>2</td>");
    expect(html).toContain("<ul><li>x</li><li><strong>y</strong></li></ul>");
    expect(html).toContain("<ol><li>one</li><li>two</li></ol>");
  });
});
