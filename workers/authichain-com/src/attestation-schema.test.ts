import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTESTATION_SCHEMA_PATH,
  attestationSchemaResponse,
} from "./attestation-schema";

test("serves attestation v0.1 at its schema id path", async () => {
  const res = attestationSchemaResponse(ATTESTATION_SCHEMA_PATH);
  assert.ok(res);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/schema\+json/);
  const body = (await res.json()) as { $id?: string; title?: string; properties?: { version?: { const?: string } } };
  assert.equal(body.$id, "https://authichain.com/schemas/attestation-v0.1.json");
  assert.equal(body.title, "AuthiChain Attestation v0.1");
  assert.equal(body.properties?.version?.const, "0.1");
});

test("other schema paths stay unanswered", () => {
  assert.equal(attestationSchemaResponse("/schemas/attestation-v0.2.json"), null);
  assert.equal(attestationSchemaResponse("/schemas/attestation-v0.1.json/"), null);
  assert.equal(attestationSchemaResponse("/battery-passport"), null);
});
