import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWranglerVersionId } from "./parse-wrangler-version-id.mjs";

const ID = "1ee6d701-f97e-49e8-b3db-fbf7ed2a495a";

test("parses Worker Version ID line", () => {
  assert.equal(
    parseWranglerVersionId(`Uploaded authichain-com (1.23 sec)\n  Worker Version ID: ${ID}\n`),
    ID
  );
});

test("parses --json object with id", () => {
  assert.equal(parseWranglerVersionId(JSON.stringify({ id: ID, number: 1523 })), ID);
});

test("parses nested worker_version.id", () => {
  assert.equal(
    parseWranglerVersionId(JSON.stringify({ worker_version: { id: ID } })),
    ID
  );
});

test("empty and garbage return empty string", () => {
  assert.equal(parseWranglerVersionId(""), "");
  assert.equal(parseWranglerVersionId("fetch failed"), "");
});
