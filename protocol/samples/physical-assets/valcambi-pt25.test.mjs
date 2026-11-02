import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("./valcambi-pt25.public.json", import.meta.url), "utf8"));

test("public pilot reports an unverified photo observation, never an authenticated bar", () => {
 assert.equal(data.classification, "REAL_OBJECT_UNVERIFIED");
 assert.equal(data.trust.status, "EVIDENCE_ONLY_UNVERIFIED");
 assert.equal(data.trust.authichainRegistration, "not_issued");
 assert.equal(data.trust.issuerSignature, "absent");
 assert.equal(data.trust.manufacturerAttestation, "absent");
 assert.equal(data.trust.physicalInspection, "not_performed");
});
test("no serial, GTIN, image bytes, or issuer claims leak in public record", () => {
 assert.equal(data.asset.serialPublic, null);
 assert.equal(data.asset.gtin, null);
 assert.equal(data.asset.manufacturerRelationship, "none asserted");
 assert.equal(data.evidence.length, 2);
 for (const e of data.evidence) {
   assert.match(e.sha256, /^[a-f0-9]{64}$/);
   assert.match(e.file, /^private\\//);
   assert.match(e.availability, /^private/);
 }
});
