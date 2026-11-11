import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const token = "unit-dispatch-secret";
const env = {
  AGENTZ_DISPATCH_TOKEN: token,
  AGENTZ_MCP_TOKEN: "different-mcp-secret",
};
const request = (path, auth, header = "authichain-automation") =>
  new Request("https://agentz.internal" + path, {
    method: "POST",
    headers: {
      authorization: auth ? "Bearer " + auth : "",
      "x-agentz-dispatch": header,
    },
  });
function failingQueueDb() {
  let selected = false;
  return {
    prepare(sql) {
      const statement = {
        bind() {
          return this;
        },
        all: async () => ({ results: [] }),
        first: async () => {
          if (sql.startsWith("SELECT id,target,attempts")) {
            if (selected) return null;
            selected = true;
            return {
              id: "fixture",
              target: "https://github.com/undone0603/authichain-unified",
              attempts: 0,
              max_attempts: 3,
              authorization_class: "read_only_public",
            };
          }
          if (
            sql.startsWith("SELECT id FROM agentz_task_events WHERE event_key")
          )
            return { id: 1 };
          return null;
        },
        run: async () => ({ meta: { changes: 1 } }),
      };
      return statement;
    },
    batch: async () => [],
  };
}
test("internal dispatch rejects missing token", async () => {
  assert.equal(
    (await worker.fetch(request("/internal/cron"), env)).status,
    401
  );
});
test("internal dispatch rejects MCP client credential", async () => {
  assert.equal(
    (await worker.fetch(request("/internal/cron", env.AGENTZ_MCP_TOKEN), env))
      .status,
    401
  );
});
test("internal dispatch rejects unauthorized dispatcher", async () => {
  assert.equal(
    (await worker.fetch(request("/internal/cron", token, "unknown"), env))
      .status,
    403
  );
});
test("authorized dispatcher fails closed when D1 is unavailable", async () => {
  const r = await worker.fetch(request("/internal/cron", token), env);
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "dispatch unavailable" });
});
test("health distinguishes API liveness from scheduler readiness", async () => {
  const r = await worker.fetch(
    new Request("https://agentz.internal/health"),
    env
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    service: "agentz-mcp-edge",
    status: "up",
    api_alive: true,
    scheduler_ready: false,
    authenticated_tools: true,
  });
});
test("health does not claim authenticated tools are configured when token is absent", async () => {
  const r = await worker.fetch(
    new Request("https://agentz.internal/health"),
    {}
  );
  assert.deepEqual(await r.json(), {
    service: "agentz-mcp-edge",
    status: "up",
    api_alive: true,
    scheduler_ready: false,
    authenticated_tools: false,
  });
});
test("health reports scheduler ready only when D1 responds", async () => {
  const queries = [];
  const readyEnv = {
    ...env,
    AGENTZ_DB: {
      prepare: sql => ({
        all: async () => {
          queries.push(sql);
          return { results: [] };
        },
        first: async () => ({
          task_registered: 0,
          task_executed: 0,
          task_verified: 0,
        }),
      }),
    },
  };
  const r = await worker.fetch(
    new Request("https://agentz.internal/health"),
    readyEnv
  );
  assert.deepEqual(await r.json(), {
    service: "agentz-mcp-edge",
    status: "up",
    api_alive: true,
    scheduler_ready: true,
    authenticated_tools: true,
  });
  assert.equal(queries.length, 3);
  assert.ok(
    queries.some(
      sql => sql.includes("lease_token") && sql.includes("FROM agentz_tasks")
    )
  );
});
test("health reports scheduler not ready when D1 schema is incomplete", async () => {
  const readyEnv = {
    ...env,
    AGENTZ_DB: {
      prepare: () => ({
        all: async () => {
          throw new Error("no such table");
        },
      }),
    },
  };
  const r = await worker.fetch(
    new Request("https://agentz.internal/health"),
    readyEnv
  );
  assert.deepEqual(await r.json(), {
    service: "agentz-mcp-edge",
    status: "up",
    api_alive: true,
    scheduler_ready: false,
    authenticated_tools: true,
  });
});
test("authenticated readiness separates API, scheduler, and task evidence", async () => {
  const readyEnv = {
    ...env,
    AGENTZ_DB: {
      prepare: sql => ({
        all: async () => ({ results: [] }),
        first: async () =>
          sql.includes("AS task_registered")
            ? { task_registered: 1, task_executed: 1, task_verified: 0 }
            : null,
      }),
    },
  };
  const payload = {
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "agentz_readiness", arguments: {} },
  };
  const r = await worker.fetch(
    new Request("https://agentz.internal/mcp", {
      method: "POST",
      headers: { authorization: "Bearer " + env.AGENTZ_MCP_TOKEN },
      body: JSON.stringify(payload),
    }),
    readyEnv
  );
  const data = JSON.parse((await r.json()).result.content[0].text);
  assert.deepEqual(data, {
    api_alive: true,
    scheduler_ready: true,
    task_registered: true,
    task_executed: true,
    task_verified: false,
    browser_inspect: false,
    code_write: false,
    production_dispatch: false,
  });
});
test("authorized dispatcher reports an empty due queue truthfully", async () => {
  const readyEnv = {
    ...env,
    AGENTZ_DB: {
      prepare: sql => ({
        bind() {
          return this;
        },
        all: async () => ({ results: [] }),
        first: async () => null,
      }),
    },
  };
  const r = await worker.fetch(request("/internal/cron", token), readyEnv);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    service: "agentz-mcp-edge",
    processed: 0,
    succeeded: 0,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
});
test("dispatch and scheduled invocation surface durable task failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    const response = await worker.fetch(request("/internal/cron", token), {
      ...env,
      AGENTZ_DB: failingQueueDb(),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      service: "agentz-mcp-edge",
      processed: 1,
      succeeded: 0,
      failed_retryable: 1,
      failed_terminal: 0,
      recovered: 0,
      skipped_expired: 0,
    });
    const pending = [];
    await worker.scheduled(
      { scheduledTime: 1 },
      { AGENTZ_DB: failingQueueDb() },
      { waitUntil: promise => pending.push(promise) }
    );
    await assert.rejects(Promise.all(pending), /task failures/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("scheduled queue failure is observable through waitUntil", async () => {
  const pending = [];
  await worker.scheduled(
    { scheduledTime: 1 },
    {},
    { waitUntil: p => pending.push(p) }
  );
  await assert.rejects(Promise.all(pending), /D1 not configured/);
});
test("MCP endpoint denies dispatcher credential", async () => {
  assert.equal((await worker.fetch(request("/mcp", token), env)).status, 401);
});
test("MCP tool list is authenticated", async () => {
  const r = await worker.fetch(
    new Request("https://agentz.internal/mcp", {
      method: "POST",
      headers: { authorization: "Bearer " + env.AGENTZ_MCP_TOKEN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
    env
  );
  assert.equal(r.status, 200);
  const payload = await r.json();
  assert.ok(payload.result.tools.some(t => t.name === "agentz_enqueue_probe"));
  assert.ok(payload.result.tools.some(t => t.name === "agentz_memory_recent"));
  assert.ok(!payload.result.tools.some(t => t.name === "agentz_public_fetch"));
});
