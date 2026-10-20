import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
// passport.d.ts types this file for the protocol package. A path import does not use that declaration.
// @ts-expect-error TS7016
import { appendPassportEvidence, signPassport, storePassport } from "../../../protocol/passport.mjs";
import { canonicalize } from "./base";
import {
  DsCsaEvidenceSchema,
  DSCSA_PACKAGE_ABSENT_SENTENCE,
  checkDscsaPackageTi,
  DSCSA_PACKAGE_SENTENCE,
  storeDscsaPackageEvidence,
} from "./index";
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

describe("storeDscsaPackageEvidence", () => {
  function passport() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const issuer = "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
    const record = signPassport({
      digitalIdentity: "urn:authichain:item:example-1",
      privateKey,
      issuer,
    });
    const metadata = storePassport({ story: "kept" }, { record });
    return { record, metadata, proof: record.proof.proofValue };
  }

  it("stores the supplied package fields and leaves the signature alone", () => {
    const { record, metadata, proof } = passport();
    const withInspection = appendPassportEvidence(metadata, { type: "inspection", note: "looked" });
    const stored = storeDscsaPackageEvidence(withInspection, {
      ...packageTi(),
      genuine: true,
      category: "pharma",
    });
    const info = {
      productName: "Example",
      lotNumber: "LOT1",
      expirationDate: "2027-08-30",
      shipmentDate: "2026-10-18",
      transactionId: "TX1",
    };
    expect(stored.stored).toBe(true);
    expect(stored.entry).toEqual({
      type: "dscsa_package_ti",
      packageId: "pkg-1",
      event: { epcList: ["pkg-1"] },
      transactionInformation: info,
      digest: "sha256:" + createHash("sha256").update(canonicalize(info)).digest("hex"),
    });
    expect(stored.message).toBe(DSCSA_PACKAGE_SENTENCE.replace("{packageId}", "pkg-1"));
    const next = stored.metadata as {
      story: string;
      passport: {
        record: typeof record;
        evidence: unknown[];
      };
    };
    expect(next.story).toBe("kept");
    expect(next.passport.record).toBe(record);
    expect(next.passport.record.proof.proofValue).toBe(proof);
    expect(next.passport.evidence).toEqual([
      { type: "inspection", note: "looked" },
      stored.entry,
    ]);
    expect(stored.entry).not.toBeNull();
    expect(JSON.stringify(stored.entry)).not.toMatch(/genuine|pharma/);
    expect(Object.hasOwn(stored, "genuine")).toBe(false);
    expect(stored.entry && Object.hasOwn(stored.entry, "genuine")).toBe(false);
  });

  it("does not invent a package row from a category or a missing passport", () => {
    const { metadata } = passport();
    const fromCategory = storeDscsaPackageEvidence(metadata, {
      type: "inspection",
      category: "pharma",
      packageId: "pkg-1",
    });
    expect(fromCategory).toEqual({
      stored: false,
      entry: null,
      metadata,
      message: DSCSA_PACKAGE_ABSENT_SENTENCE,
    });
    expect(
      (fromCategory.metadata as { passport: { evidence?: unknown } }).passport.evidence,
    ).toBeUndefined();
    const missing = storeDscsaPackageEvidence({}, packageTi());
    expect(missing).toEqual({
      stored: false,
      entry: null,
      metadata: {},
      message: DSCSA_PACKAGE_ABSENT_SENTENCE,
    });
    const unknown = packageTi();
    (unknown.transactionInformation as { lotNumber: string }).lotNumber = "UNKNOWN";
    expect(storeDscsaPackageEvidence(metadata, unknown).stored).toBe(false);
  });

  it("rethrows when the evidence list is full", () => {
    const { metadata, proof } = passport();
    let bag = metadata;
    for (let i = 0; i < 32; i += 1) bag = appendPassportEvidence(bag, { type: "note", n: i });
    expect(() => storeDscsaPackageEvidence(bag, packageTi())).toThrow(/evidence_cap/);
    expect(
      (bag as { passport: { record: { proof: { proofValue: string } } } }).passport.record.proof
        .proofValue,
    ).toBe(proof);
  });
});

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buf: Buffer): string {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
