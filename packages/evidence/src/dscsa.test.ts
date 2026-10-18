import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { canonicalize } from "./base";
import { DsCsaEvidenceSchema, checkDscsaPackageTi, DSCSA_PACKAGE_SENTENCE } from "./index";
import { mapEpcisToDsCsa } from "./mapping";

describe("DsCsaEvidenceSchema", () => {
  it("validates a correct DSCSA event", () => {
    const validDscsaEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Pharma Co" },
      timestamp: "2026-08-30T10:00:00Z",
      digest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "base64sig",
      metadata: {
        lotNumber: "LOT123",
        expirationDate: "2027-08-30T00:00:00Z",
        tradingPartnerId: "PARTNER_1",
        transactionId: "TX_999",
      },
    };
    expect(DsCsaEvidenceSchema.safeParse(validDscsaEvidence).success).toBe(
      true
    );
  });

  it("rejects DSCSA event missing required metadata", () => {
    const invalidDscsaEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Pharma Co" },
      timestamp: "2026-08-30T10:00:00Z",
      digest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "base64sig",
      metadata: {
        lotNumber: "LOT123",
        // Missing expirationDate
        tradingPartnerId: "PARTNER_1",
        transactionId: "TX_999",
      },
    };
    expect(DsCsaEvidenceSchema.safeParse(invalidDscsaEvidence).success).toBe(
      false
    );
  });
});

function packageTi(overrides: Record<string, unknown> = {}) {
  return {
    type: "dscsa_package_ti",
    packageId: "pkg-1",
    event: {
      type: "ObjectEvent",
      action: "OBSERVE",
      eventTime: "2026-10-18T00:00:00Z",
      bizStep: "urn:epcglobal:cbv:bizstep:shipping",
      epcList: ["pkg-1"],
    },
    transactionInformation: {
      productName: "Example",
      lotNumber: "LOT1",
      expirationDate: "2027-08-30",
      shipmentDate: "2026-10-18",
      transactionId: "TX1",
    },
    ...overrides,
  };
}

describe("dscsa package transaction information", () => {
  it("accepts the five supplied fields and does not set genuine", () => {
    const out = checkDscsaPackageTi(packageTi());
    expect(out.pass).toBe(true);
    expect(out.reason).toBeNull();
    expect(out.sentence).toBe(DSCSA_PACKAGE_SENTENCE.replace("{packageId}", "pkg-1"));
    expect(out.sentence).toContain("not an FDA DSCSA compliance determination");
    expect(Object.hasOwn(out, "genuine")).toBe(false);
    expect(checkDscsaPackageTi(null).sentence).toBe(
      "No DSCSA package transaction information is stored on this passport.",
    );
  });

  it("rejects a missing package, a placeholder digest, and a missing expiration", () => {
    expect(checkDscsaPackageTi(packageTi({ packageId: "" })).reason).toBe("dscsa_package_missing");
    const copied = packageTi();
    (copied.event as { epcList: string[] }).epcList = ["other"];
    expect(checkDscsaPackageTi(copied).reason).toBe("dscsa_package_missing");
    const info = {
      productName: "Example",
      lotNumber: "LOT1",
      expirationDate: "2027-08-30",
      shipmentDate: "2026-10-18",
      transactionId: "TX1",
    };
    const digest =
      "sha256:" + createHash("sha256").update(canonicalize(info)).digest("hex");
    expect(checkDscsaPackageTi(packageTi({ digest })).pass).toBe(true);
    expect(checkDscsaPackageTi(packageTi({ digest: "sha256:" + "cd".repeat(32) })).reason).toBe(
      "dscsa_placeholder_digest",
    );
    expect(
      checkDscsaPackageTi(
        packageTi({
          digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        }),
      ).reason,
    ).toBe("dscsa_placeholder_digest");
    const dropped = packageTi();
    delete (dropped.transactionInformation as { expirationDate?: string }).expirationDate;
    expect(checkDscsaPackageTi(dropped).reason).toBe("dscsa_synthesized_expiration");
    const unknown = packageTi();
    (unknown.transactionInformation as { lotNumber: string }).lotNumber = "UNKNOWN";
    expect(checkDscsaPackageTi(unknown).reason).toBe("dscsa_ti_incomplete");
    expect(checkDscsaPackageTi(packageTi({ signature: "unsigned" })).reason).toBe(
      "dscsa_ti_incomplete",
    );
  });
});

describe("mapEpcisToDsCsa", () => {
  const complete = {
    eventID: "550e8400-e29b-41d4-a716-446655440000",
    epcList: ["pkg-1"],
    action: "OBSERVE",
    bizLocation: "urn:loc:1",
    bizLocationName: "Example Lab",
    eventTime: "2026-10-18T00:00:00.000Z",
    hash: "ab".repeat(32),
    signature: "c2ln",
    lotNumber: "LOT1",
    expirationDate: "2027-08-30T00:00:00.000Z",
    sourceList: [{ source: "PARTNER_1" }],
    transactionId: "TX1",
  };

  it("keeps supplied fields and does not invent the four substitutions", () => {
    const out = mapEpcisToDsCsa(complete);
    expect(out.metadata.lotNumber).toBe("LOT1");
    expect(out.metadata.expirationDate).toBe("2027-08-30T00:00:00.000Z");
    expect(out.metadata.tradingPartnerId).toBe("PARTNER_1");
    expect(out.issuer.name).toBe("Example Lab");
    expect(out.digest).toBe("sha256:" + "ab".repeat(32));
    expect(out.signature).toBe("c2ln");
    expect(() => mapEpcisToDsCsa({ ...complete, expirationDate: undefined })).toThrow(
      /dscsa_synthesized_expiration/,
    );
    expect(() => mapEpcisToDsCsa({ ...complete, lotNumber: undefined })).toThrow(
      /dscsa_ti_incomplete/,
    );
    expect(() => mapEpcisToDsCsa({ ...complete, hash: undefined })).toThrow(
      /dscsa_placeholder_digest/,
    );
    expect(() => mapEpcisToDsCsa({ ...complete, bizLocationName: "Unknown Partner" })).toThrow(
      /dscsa_ti_incomplete/,
    );
    expect(() => mapEpcisToDsCsa({ ...complete, epcList: [] })).toThrow(/dscsa_package_missing/);
    const src = readFileSync(path.join(import.meta.dirname, "mapping.ts"), "utf8");
    expect(src).not.toMatch(/new Date\(|\|\| "UNKNOWN"|\|\| "Unknown Partner"|\|\| "unsigned"/);
  });
});
