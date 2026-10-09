import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudflareAccessHeaders } from "./access-headers.ts";

test("omits Access headers unless both halves are set", () => {
  assert.deepEqual(cloudflareAccessHeaders({}), {});
  assert.deepEqual(cloudflareAccessHeaders({ CF_ACCESS_CLIENT_ID: "id" }), {});
  assert.deepEqual(
    cloudflareAccessHeaders({ CF_ACCESS_CLIENT_SECRET: "secret" }),
    {}
  );
  assert.deepEqual(
    cloudflareAccessHeaders({
      CF_ACCESS_CLIENT_ID: "  ",
      CF_ACCESS_CLIENT_SECRET: "secret",
    }),
    {}
  );
});

test("sends the Access service-token pair when both halves are set", () => {
  assert.deepEqual(
    cloudflareAccessHeaders({
      CF_ACCESS_CLIENT_ID: " client ",
      CF_ACCESS_CLIENT_SECRET: " secret ",
    }),
    {
      "CF-Access-Client-Id": "client",
      "CF-Access-Client-Secret": "secret",
    }
  );
});
