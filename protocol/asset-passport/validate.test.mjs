import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateAssetPassport, summarizeTrustDimensions } from "./validate.mjs";

const fixturePath = fileURLToPath(new URL("../examples/precious-metals/valcambi-2.5g.json", import.meta.url));
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

test("precious-metal fixture is structurally valid", () => {
  const result = validateAssetPassport(fixture);
  assert.deepEqual(result, { valid: true, reasons: [] });
});

test("GTIN identity requires a serial", () => {
  const invalid = structuredClone(fixture);
  invalid.identity.scheme = "gs1";
  invalid.identity.gtin = "09506000134352";
  invalid.identity.serial = "";
  const result = validateAssetPassport(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("missing:identity.serial"));
});

test("claims cannot reference missing evidence", () => {
  const invalid = structuredClone(fixture);
  invalid.claims[0].evidenceIds = ["does-not-exist"];
  const result = validateAssetPassport(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("claim_missing_evidence:claim-metal:does-not-exist"));
});

test("physical inspection remains distinct from issuer claims", () => {
  const dimensions = summarizeTrustDimensions(fixture);
  assert.equal(dimensions.identifier, "identified");
  assert.equal(dimensions.issuer, "asserted");
  assert.equal(dimensions.evidence, "present");
  assert.equal(dimensions.physicalInspection, "not_performed");
});

test("policy can explicitly require inspection", () => {
  const invalid = structuredClone(fixture);
  invalid.verificationPolicy = { requirePhysicalInspection: true };
  const result = validateAssetPassport(invalid);
  assert.ok(result.reasons.includes("policy_requires_physical_inspection"));
});
