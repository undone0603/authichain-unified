import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deploymentBody,
  deploymentUrl,
  promoteWorkerVersion,
} from "./promote-worker-version.mjs";

const ID = "ab0623ea-a98a-4ec5-9dd9-8ae1c48b6e03";
const ACCOUNT = "4c1869b90f13f86940aa3747839bf420";

test("deployment URL and body match Cloudflare POST deployments", () => {
  assert.equal(
    deploymentUrl(ACCOUNT, "authichain-com"),
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/authichain-com/deployments`
  );
  assert.deepEqual(deploymentBody(ID), {
    strategy: "percentage",
    versions: [{ percentage: 100, version_id: ID }],
  });
});

test("promoteWorkerVersion POSTs Bearer auth and treats success", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, result: { id: "dep-1" } }),
    };
  };
  const result = await promoteWorkerVersion({
    scriptName: "authichain-com",
    versionId: ID,
    accountId: ACCOUNT,
    token: "tok",
    fetchImpl,
  });
  assert.equal(result.id, "dep-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].opts.headers.Authorization, /^Bearer tok$/);
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(JSON.parse(calls[0].opts.body).versions[0].percentage, 100);
});

test("promoteWorkerVersion refuses a bad version id before fetch", async () => {
  let fetched = false;
  await assert.rejects(
    () =>
      promoteWorkerVersion({
        scriptName: "authichain-com",
        versionId: "not-a-uuid",
        accountId: ACCOUNT,
        token: "tok",
        fetchImpl: async () => {
          fetched = true;
          return { ok: true, status: 200, text: async () => "{}" };
        },
      }),
    /invalid version id/
  );
  assert.equal(fetched, false);
});
