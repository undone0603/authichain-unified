import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { enqueue, recent, runQueue } from "./memory.mjs";

const migrationDir = new URL("./migrations/", import.meta.url);
const migration1 = readFileSync(
  new URL("0001_memory.sql", migrationDir),
  "utf8"
);
const migration2 = readFileSync(
  new URL("0002_scheduler_recovery.sql", migrationDir),
  "utf8"
);
const target = "https://github.com/undone0603/authichain-unified";

function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration1);
  sqlite.exec(migration2);
  return {
    sqlite,
    d1: {
      prepare(sql) {
        const statement = {
          sql,
          params: [],
          bind(...params) {
            this.params = params;
            return this;
          },
          first() {
            return sqlite.prepare(sql).get(...this.params) || null;
          },
          all() {
            return { results: sqlite.prepare(sql).all(...this.params) };
          },
          run() {
            const result = sqlite.prepare(sql).run(...this.params);
            return { meta: { changes: Number(result.changes) } };
          },
        };
        return statement;
      },
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          const results = statements.map(({ sql, params }) => {
            const result = sqlite.prepare(sql).run(...params);
            return { meta: { changes: Number(result.changes) } };
          });
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
}

function insertTask(
  sqlite,
  {
    id = "task-1",
    status = "pending",
    attempts = 0,
    maxAttempts = 3,
    leaseExpiresAt = null,
    leaseToken = null,
    expiresAt = "9999-12-31 23:59:59",
  } = {}
) {
  sqlite
    .prepare(
      "INSERT INTO agentz_tasks(id,kind,target,priority,status,attempts,next_run_at,max_attempts,lease_expires_at,lease_token,expires_at) VALUES (?,'public_probe',?,50,?,?,?, ?,?,?,?)"
    )
    .run(
      id,
      target,
      status,
      attempts,
      "2000-01-01 00:00:00",
      maxAttempts,
      leaseExpiresAt,
      leaseToken,
      expiresAt
    );
}

test("queue requires durable storage", async () => {
  await assert.rejects(runQueue({}), /D1 not configured/);
});

test("migration recovers legacy running tasks with durable evidence", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration1);
  sqlite
    .prepare(
      "INSERT INTO agentz_tasks(id,kind,target,status,attempts) VALUES (?,'public_probe',?,'running',1)"
    )
    .run("legacy-task", target);
  sqlite.exec(migration2);

  const task = sqlite
    .prepare(
      "SELECT status,last_error,expires_at FROM agentz_tasks WHERE id='legacy-task'"
    )
    .get();
  assert.equal(task.status, "pending");
  assert.equal(task.last_error, "recovered legacy task without lease");
  assert.ok(task.expires_at);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_task_events WHERE task_id='legacy-task'"
      )
      .get().count,
    1
  );
  sqlite.close();
});

test("migration terminalizes legacy running tasks already at their attempt limit", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration1);
  sqlite
    .prepare(
      "INSERT INTO agentz_tasks(id,kind,target,status,attempts) VALUES (?,'public_probe',?,'running',3)"
    )
    .run("legacy-exhausted", target);
  sqlite.exec(migration2);

  const task = sqlite
    .prepare(
      "SELECT status,last_error,completed_at FROM agentz_tasks WHERE id='legacy-exhausted'"
    )
    .get();
  assert.equal(task.status, "failed");
  assert.equal(
    task.last_error,
    "legacy running task reached maximum attempts during migration"
  );
  assert.ok(task.completed_at);
  assert.equal(
    sqlite
      .prepare(
        "SELECT outcome FROM agentz_task_events WHERE task_id='legacy-exhausted'"
      )
      .get().outcome,
    "failed"
  );
  sqlite.close();
});

test("enqueue durably registers bounded read-only work", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());

  const task = await enqueue({ AGENTZ_DB: d1 }, { target });
  const stored = sqlite
    .prepare(
      "SELECT kind,status,max_attempts,authorization_class,expires_at FROM agentz_tasks WHERE id=?"
    )
    .get(task.id);
  assert.equal(stored.kind, "public_probe");
  assert.equal(stored.status, "pending");
  assert.equal(stored.max_attempts, 3);
  assert.equal(stored.authorization_class, "read_only_public");
  assert.ok(Date.parse(stored.expires_at.replace(" ", "T") + "Z") > Date.now());
  await assert.rejects(
    enqueue({ AGENTZ_DB: d1 }, { target: "https://example.com" }),
    /target not allowlisted/
  );
});

test("recent task view exposes durable completion and evidence", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite, { status: "succeeded", attempts: 1 });
  sqlite
    .prepare(
      "UPDATE agentz_tasks SET completed_at='2026-11-11 12:00:00' WHERE id='task-1'"
    )
    .run();
  sqlite
    .prepare(
      "INSERT INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail,event_key) VALUES ('task-1','public_probe','success',?,'HTTP 200','task:task-1:1')"
    )
    .run(target);

  const result = await recent({ AGENTZ_DB: d1 }, { limit: 1 });
  assert.equal(result.tasks[0].status, "succeeded");
  assert.equal(result.tasks[0].completed_at, "2026-11-11 12:00:00");
  assert.equal(result.tasks[0].last_event_outcome, "success");
  assert.equal(result.tasks[0].last_evidence_url, target);
  assert.equal(result.tasks[0].last_execution_detail, "HTTP 200");
});

test("due task records durable completion and duplicate dispatch does not repeat it", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite);
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    return new Response("ok", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 1,
    succeeded: 1,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
  const task = sqlite
    .prepare(
      "SELECT status,attempts,completed_at,lease_token FROM agentz_tasks WHERE id='task-1'"
    )
    .get();
  assert.equal(task.status, "succeeded");
  assert.equal(task.attempts, 1);
  assert.ok(task.completed_at);
  assert.equal(task.lease_token, null);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_task_events WHERE event_key='task:task-1:1'"
      )
      .get().count,
    1
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_learnings WHERE source_event_id IN (SELECT id FROM agentz_task_events WHERE event_key='task:task-1:1')"
      )
      .get().count,
    1
  );
  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 0,
    succeeded: 0,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
  assert.equal(fetches, 1);
});

test("concurrent dispatchers claim a due task once", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite);
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response("ok", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const results = await Promise.all([
    runQueue({ AGENTZ_DB: d1 }),
    runQueue({ AGENTZ_DB: d1 }),
  ]);
  assert.equal(
    results.reduce((total, result) => total + result.processed, 0),
    1
  );
  assert.equal(fetches, 1);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_task_events WHERE task_id='task-1' AND event_type='public_probe'"
      )
      .get().count,
    1
  );
});

test("expired lease is recovered, recorded, and safely re-executed", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite, {
    status: "running",
    attempts: 1,
    leaseExpiresAt: "2000-01-01 00:00:00",
    leaseToken: "stale-worker",
  });
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    return new Response("ok", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 1,
    succeeded: 1,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 1,
    skipped_expired: 0,
  });
  const task = sqlite
    .prepare("SELECT status,attempts FROM agentz_tasks WHERE id='task-1'")
    .get();
  assert.equal(task.status, "succeeded");
  assert.equal(task.attempts, 2);
  assert.equal(fetches, 1);
  assert.equal(
    sqlite
      .prepare(
        "SELECT outcome FROM agentz_task_events WHERE event_type='lease_recovery'"
      )
      .get().outcome,
    "requeued"
  );
  assert.ok(
    sqlite
      .prepare(
        "SELECT id FROM agentz_task_events WHERE event_key='task:task-1:2'"
      )
      .get()
  );
});

test("stale worker cannot overwrite the result of a recovered lease", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite);
  const originalFetch = globalThis.fetch;
  let releaseFirstFetch;
  let signalFirstFetch;
  const firstFetchStarted = new Promise(resolve => {
    signalFirstFetch = resolve;
  });
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    if (fetches === 1) {
      signalFirstFetch();
      return new Promise(resolve => {
        releaseFirstFetch = resolve;
      });
    }
    return new Response("recovered worker", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const staleRun = runQueue({ AGENTZ_DB: d1 });
  await firstFetchStarted;
  sqlite
    .prepare(
      "UPDATE agentz_tasks SET lease_expires_at='2000-01-01 00:00:00' WHERE id='task-1'"
    )
    .run();

  const recoveredRun = await runQueue({ AGENTZ_DB: d1 });
  assert.equal(recoveredRun.succeeded, 1);
  releaseFirstFetch(new Response("stale worker", { status: 200 }));
  await assert.rejects(staleRun, /task lease lost/);

  const task = sqlite
    .prepare(
      "SELECT status,attempts,completed_at FROM agentz_tasks WHERE id='task-1'"
    )
    .get();
  assert.equal(task.status, "succeeded");
  assert.equal(task.attempts, 2);
  assert.ok(task.completed_at);
  assert.equal(fetches, 2);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_task_events WHERE event_key='task:task-1:1'"
      )
      .get().count,
    0
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM agentz_task_events WHERE event_key='task:task-1:2'"
      )
      .get().count,
    1
  );
});

test("expired final lease becomes terminal without replay", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite, {
    status: "running",
    attempts: 3,
    maxAttempts: 3,
    leaseExpiresAt: "2000-01-01 00:00:00",
    leaseToken: "stale-worker",
  });
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    return new Response("unexpected", { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 0,
    succeeded: 0,
    failed_retryable: 0,
    failed_terminal: 1,
    recovered: 1,
    skipped_expired: 0,
  });
  const task = sqlite
    .prepare("SELECT status,completed_at FROM agentz_tasks WHERE id='task-1'")
    .get();
  assert.equal(task.status, "failed");
  assert.ok(task.completed_at);
  assert.equal(fetches, 0);
  assert.equal(
    sqlite
      .prepare(
        "SELECT outcome FROM agentz_task_events WHERE event_type='lease_recovery'"
      )
      .get().outcome,
    "failed"
  );
});

test("transient probe failure is retried and recorded as failure", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite);
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches++;
    return new Response("unavailable", { status: fetches === 1 ? 503 : 200 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 1,
    succeeded: 0,
    failed_retryable: 1,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
  assert.equal(
    sqlite
      .prepare("SELECT status,attempts FROM agentz_tasks WHERE id='task-1'")
      .get().status,
    "pending"
  );
  sqlite
    .prepare(
      "UPDATE agentz_tasks SET next_run_at='2000-01-01 00:00:00' WHERE id='task-1'"
    )
    .run();
  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 1,
    succeeded: 1,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
  assert.equal(
    sqlite
      .prepare("SELECT status,attempts FROM agentz_tasks WHERE id='task-1'")
      .get().status,
    "succeeded"
  );
  assert.deepEqual(
    sqlite
      .prepare(
        "SELECT outcome FROM agentz_task_events WHERE event_type='public_probe' ORDER BY id"
      )
      .all()
      .map(row => row.outcome),
    ["failure", "success"]
  );
  assert.deepEqual(
    sqlite
      .prepare("SELECT outcome FROM agentz_learnings ORDER BY id")
      .all()
      .map(row => row.outcome),
    ["failure", "success"]
  );
});

test("task policy rejects authorization classes outside read-only public probes", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite);
  assert.throws(() =>
    sqlite
      .prepare(
        "UPDATE agentz_tasks SET authorization_class='customer_message' WHERE id='task-1'"
      )
      .run()
  );
  sqlite.exec("PRAGMA ignore_check_constraints=ON");
  sqlite
    .prepare(
      "UPDATE agentz_tasks SET authorization_class='customer_message' WHERE id='task-1'"
    )
    .run();
  sqlite.exec("PRAGMA ignore_check_constraints=OFF");
  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 0,
    succeeded: 0,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 0,
  });
});

test("expired work is recorded as skipped rather than replayed", async t => {
  const { sqlite, d1 } = makeDb();
  t.after(() => sqlite.close());
  insertTask(sqlite, { expiresAt: "2000-01-01 00:00:00" });

  assert.deepEqual(await runQueue({ AGENTZ_DB: d1 }), {
    processed: 0,
    succeeded: 0,
    failed_retryable: 0,
    failed_terminal: 0,
    recovered: 0,
    skipped_expired: 1,
  });
  assert.equal(
    sqlite
      .prepare("SELECT status,last_error FROM agentz_tasks WHERE id='task-1'")
      .get().status,
    "failed"
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT outcome FROM agentz_task_events WHERE event_type='task_expired'"
      )
      .get().outcome,
    "skipped_policy"
  );
});
