import assert from "node:assert/strict";
import { draftRecord, draftLog } from "./draft-record.mjs";
import { verifyRecord } from "./verifier.mjs";

const record = draftRecord({ generationId: "gen_test_1", destination: "https://example.com" });
assert.equal(record.proof, null);
assert.equal(record.meta.seal, false);
assert.equal(draftRecord({ generationId: "gen_test_1" }).credentialSubject.id, record.credentialSubject.id);

const verdict = verifyRecord(record);
assert.equal(verdict.verdict, "invalid");

const log = draftLog({ generationId: "gen_test_1" });
assert.equal(log.event, "draft_seal");
assert.equal(log.seal, false);
console.log(JSON.stringify(log));
