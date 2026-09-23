// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkClaims, htmlToText } from "../../server/outreach/claims";
import {
  govchainEmail,
  partnerEmail,
  personFirstName,
  qronEmail,
  strainchainEmail,
  type CopyTarget,
} from "./b2b-templates";
import { CHANNEL_PARTNER_TARGETS } from "./channel-partners";

// Shapes taken from the target lists in scripts/b2b-cold-outreach.ts.
const TARGETS: CopyTarget[] = [
  { company: "ITC Federal", name: "Dr. Imran Bashir", email: "ib@example.com" },
  { company: "Kampi Components", name: "Allan Goodman", email: "ag@example.com" },
  { company: "Trulieve Cannabis", name: "Head of Compliance", email: "x@example.com" },
  { company: "Curaleaf", name: "Compliance Team", email: "x@example.com" },
  { company: "MOO", name: "Product Manager", email: "x@example.com" },
  { company: "4imprint", name: "B2B Sales Head", email: "" },
];

const BUILDERS = { govchainEmail, strainchainEmail, qronEmail };

describe("b2b copy", () => {
  for (const [name, build] of Object.entries(BUILDERS)) {
    it(`${name} makes no unbacked claims for any target`, () => {
      for (const t of TARGETS) {
        const { subject, html } = build(t);
        expect(checkClaims(subject, htmlToText(html))).toEqual([]);
      }
    });
  }

  it("partner copy makes no claims and never includes research notes", () => {
    expect(CHANNEL_PARTNER_TARGETS.length).toBeGreaterThan(0);
    for (const t of CHANNEL_PARTNER_TARGETS) {
      const { subject, html } = partnerEmail(t);
      expect(checkClaims(subject, htmlToText(html))).toEqual([]);
      expect(html).not.toContain(t.notes);
      expect(html).not.toMatch(/Published|CONNECTED|forwarded|734-999/);
    }
  });

  it("does not repeat the false product statements of the old copy", () => {
    const all = TARGETS.flatMap(t =>
      Object.values(BUILDERS).map(b => htmlToText(b(t).html))
    ).join("\n");
    for (const phrase of [
      /C3PAO/i,
      /DFARS|NIST 800-171/,
      /METRC/i,
      /18013-5/,
      /\$0\.002/,
      /tamper[- ]proof/i,
      /9B6cN59br5xcaCuazy1Nu1o/,
      /7-day trial/i,
    ]) {
      expect(all).not.toMatch(phrase);
    }
  });

  it("greets people by first name and everyone else neutrally", () => {
    expect(personFirstName("Dr. Imran Bashir")).toBe("Imran");
    expect(personFirstName("Allan Goodman")).toBe("Allan");
    expect(personFirstName("Head of Compliance")).toBeNull();
    expect(personFirstName("Existo Solutions")).toBeNull();
    expect(personFirstName("Onnit")).toBeNull();
    expect(govchainEmail(TARGETS[0]).html).toContain("Hi Imran,");
    expect(strainchainEmail(TARGETS[2]).html).toContain("Hello,");
    expect(strainchainEmail(TARGETS[2]).html).not.toContain("Hi Head");
  });

  it("uses catalogue prices and payment links only", () => {
    const s = strainchainEmail(TARGETS[2]).html;
    expect(s).toContain("$49 per cultivar");
    expect(s).toContain("buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y");
    const q = qronEmail(TARGETS[4]).html;
    expect(q).toContain("$99 for 500 generations");
    expect(q).toContain("buy.stripe.com/28E00l6OT7dHcjI1MgaIM0d");
  });
});
