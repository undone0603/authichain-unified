import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchLiveWorkerVersion,
  liveDeploymentUrl,
  pickLiveVersionId,
} from "./live-worker-version.mjs";

const NEW_ID = "ab0623ea-a98a-4ec5-9dd9-8ae1c48b6e03";
const OLD_ID = "11111111-2222-4333-8444-555555555555";
const ACCOUNT = "4c1869b90f13f86940aa3747839bf420";

const dep = (created_on, versions) => ({ id: `dep-${created_on}`, created_on, versions });

test("deployments URL matches Cloudflare GET deployments", () => {
  assert.equal(
    liveDeploymentUrl(ACCOUNT, "authichain-edge-router"),
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/authichain-edge-router/deployments`
  );
});

test("picks the single 100% version of the newest deployment", () => {
  const result = {
    deployments: [
      dep("2026-11-01T10:00:00Z", [{ version_id: NEW_ID, percentage: 100 }]),
      dep("2026-10-20T10:00:00Z", [{ version_id: OLD_ID, percentage: 100 }]),
    ],
  };
  assert.equal(pickLiveVersionId(result), NEW_ID);
});

test("does not trust API order: newest created_on wins", () => {
  const result = {
    deployments: [
      dep("2026-10-20T10:00:00Z", [{ version_id: OLD_ID, percentage: 100 }]),
      dep("2026-11-01T10:00:00Z", [{ version_id: NEW_ID, percentage: 100 }]),
    ],
  };
  assert.equal(pickLiveVersionId(result), NEW_ID);
});

test("ignores zero-percent entries beside the live version", () => {
  const result = {
    deployments: [
      dep("2026-11-01T10:00:00Z", [
        { version_id: NEW_ID, percentage: 100 },
        { version_id: OLD_ID, percentage: 0 },
      ]),
    ],
  };
  assert.equal(pickLiveVersionId(result), NEW_ID);
});

test("fails closed with no deployments", () => {
  assert.throws(() => pickLiveVersionId({ deployments: [] }), /no deployments/);
  assert.throws(() => pickLiveVersionId({}), /no deployments/);
  assert.throws(() => pickLiveVersionId(undefined), /no deployments/);
});

test("fails closed on split traffic", () => {
  const result = {
    deployments: [
      dep("2026-11-01T10:00:00Z", [
        { version_id: NEW_ID, percentage: 90 },
        { version_id: OLD_ID, percentage: 10 },
      ]),
    ],
  };
  assert.throws(() => pickLiveVersionId(result), /not a single 100% version/);
});

test("fails closed when the only version is not at 100%", () => {
  const result = {
    deployments: [dep("2026-11-01T10:00:00Z", [{ version_id: NEW_ID, percentage: 50 }])],
  };
  assert.throws(() => pickLiveVersionId(result), /not a single 100% version/);
});

test("fails closed on a version id that is not a UUID", () => {
  const result = {
    deployments: [dep("2026-11-01T10:00:00Z", [{ version_id: "latest", percentage: 100 }])],
  };
  assert.throws(() => pickLiveVersionId(result), /not a UUID/);
});

test("fetchLiveWorkerVersion GETs with Bearer auth and returns the id", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          result: { deployments: [dep("2026-11-01T10:00:00Z", [{ version_id: NEW_ID, percentage: 100 }])] },
        }),
    };
  };
  const id = await fetchLiveWorkerVersion({
    scriptName: "authichain-edge-router",
    accountId: ACCOUNT,
    token: "tok",
    fetchImpl,
  });
  assert.equal(id, NEW_ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.method, "GET");
  assert.match(calls[0].opts.headers.Authorization, /^Bearer tok$/);
});

test("fetchLiveWorkerVersion surfaces API errors and non-JSON", async () => {
  await assert.rejects(
    () =>
      fetchLiveWorkerVersion({
        scriptName: "authichain-edge-router",
        accountId: ACCOUNT,
        token: "tok",
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          text: async () => JSON.stringify({ success: false, errors: [{ message: "forbidden" }] }),
        }),
      }),
    /HTTP 403: forbidden/
  );
  await assert.rejects(
    () =>
      fetchLiveWorkerVersion({
        scriptName: "authichain-edge-router",
        accountId: ACCOUNT,
        token: "tok",
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<html>" }),
      }),
    /non-JSON/
  );
});

test("fetchLiveWorkerVersion refuses bad input before any fetch", async () => {
  let fetched = false;
  const fetchImpl = async () => {
    fetched = true;
    return { ok: true, status: 200, text: async () => "{}" };
  };
  await assert.rejects(
    () => fetchLiveWorkerVersion({ scriptName: "Bad Name", accountId: ACCOUNT, token: "tok", fetchImpl }),
    /invalid worker name/
  );
  await assert.rejects(
    () => fetchLiveWorkerVersion({ scriptName: "authichain-edge-router", accountId: "", token: "", fetchImpl }),
    /required/
  );
  assert.equal(fetched, false);
});