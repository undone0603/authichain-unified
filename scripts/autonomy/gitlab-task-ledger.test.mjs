import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAllowed,
  DEFAULTS,
  ESCALATE_LABEL,
  extractFirstError,
  fingerprint,
  isLiveRef,
  isSuperseded,
  LABEL,
  makeClient,
  normalizeLine,
  planActions,
  priorityFor,
  readState,
  runLedger,
  summarize,
  titleFor,
  writeState,
} from "./gitlab-task-ledger.mjs";

// ---------------------------------------------------------------- fingerprint

describe("fingerprint", () => {
  const base = {
    jobName: "quality_gate",
    failureReason: "script_failure",
    logTail:
      "$ pnpm exec vitest run\n FAIL src/lib/a.test.ts\nError: expected 3 to be 4 at 2026-10-22T18:00:01Z",
  };

  it("is stable across timestamps, numbers, hashes and ANSI colour", () => {
    const again = {
      ...base,
      logTail:
        "$ pnpm exec vitest run\n\u001b[31m FAIL src/lib/a.test.ts\u001b[0m\nError: expected 9 to be 12 at 2026-10-23T01:02:03Z",
    };
    assert.equal(fingerprint(base), fingerprint(again));
    assert.match(fingerprint(base), /^[0-9a-f]{12}$/);
  });

  it("differs by job, by failure reason and by the error itself", () => {
    const f = fingerprint(base);
    assert.notEqual(f, fingerprint({ ...base, jobName: "build_gate" }));
    assert.notEqual(
      f,
      fingerprint({ ...base, failureReason: "runner_system_failure" })
    );
    assert.notEqual(
      f,
      fingerprint({ ...base, logTail: "Error: cannot find module left-pad" })
    );
  });

  it("extractFirstError skips the command echo and falls back to the last line", () => {
    assert.equal(
      extractFirstError("$ pnpm test\nrunning\nError: boom\nmore"),
      "Error: boom"
    );
    assert.equal(extractFirstError("one\ntwo"), "two");
    assert.equal(extractFirstError(""), "");
  });

  // Both lines below were picked as the "first error" by a dry run against the
  // live GitLab API, which made the task title and fingerprint meaningless.
  it("extractFirstError ignores a passing summary and runner boilerplate", () => {
    const log = [
      "# tests 53",
      "# pass 53",
      "# fail 0",
      "+Uploading artifacts for failed job",
      "Cleaning up project directory and file based variables",
      "ERROR: Job failed: exit code 1",
    ].join("\n");
    assert.equal(extractFirstError(log), "ERROR: Job failed: exit code 1");
    // The runner's closing line beats an unrelated trailing line.
    assert.equal(
      extractFirstError("ERROR: Job failed: exit code 1\nsome trailing text"),
      "ERROR: Job failed: exit code 1"
    );

    const withCause = [
      "# fail 0",
      "not ok 3 - scripts/lib/a.test.js",
      "AssertionError: expected 3 to be 4",
      "+Uploading artifacts for failed job",
      "ERROR: Job failed: exit code 1",
    ].join("\n");
    assert.equal(
      extractFirstError(withCause),
      "AssertionError: expected 3 to be 4"
    );
  });

  it("extractFirstError keeps real failures that mention counts", () => {
    assert.equal(
      extractFirstError("ran 10\n# fail 2\nFAIL src/a.test.ts"),
      "# fail 2"
    );
    assert.equal(
      extractFirstError("Tests: 0 failed, 12 passed"),
      "Tests: 0 failed, 12 passed"
    );
    assert.equal(
      extractFirstError("Tests: 0 failed, 12 passed\nError: boom"),
      "Error: boom"
    );
  });

  it("a failure with noise first keeps a stable fingerprint across runs", () => {
    const a = {
      jobName: "quality_gate",
      failureReason: "script_failure",
      logTail:
        "# fail 0\nError: cannot find module left-pad\nERROR: Job failed: exit code 1",
    };
    const b = {
      ...a,
      logTail:
        "# fail 0\n# cancelled 0\nError: cannot find module left-pad\nERROR: Job failed: exit code 1",
    };
    assert.equal(fingerprint(a), fingerprint(b));
    assert.notEqual(
      fingerprint(a),
      fingerprint({
        ...a,
        logTail: "# fail 0\nError: cannot find module right-pad",
      })
    );
  });

  it("normalizeLine removes volatile parts", () => {
    assert.equal(
      normalizeLine(
        "Failed 12 tests in 3.4s at /builds/g/p/authichain-unified/src/a.ts commit 1740258613abcd"
      ),
      "failed <n> tests in <n>s at src/a.ts commit <hex>"
    );
  });
});

// ----------------------------------------------------------------- task state

describe("task state marker", () => {
  it("round-trips and replaces instead of duplicating", () => {
    const once = writeState("hello", { v: 1, fp: "aaa", attempts: 1 });
    const twice = writeState(once, { v: 1, fp: "aaa", attempts: 2 });
    assert.deepEqual(readState(twice), { v: 1, fp: "aaa", attempts: 2 });
    assert.equal(twice.match(/agent-task:/g).length, 1);
  });

  it("returns null for a missing or damaged marker", () => {
    assert.equal(readState("no marker"), null);
    assert.equal(readState("<!-- agent-task:{not json} -->"), null);
  });
});

// -------------------------------------------------------------------- planner

const F = (over = {}) => ({
  fp: "fp1",
  jobName: "quality_gate",
  pipelineId: 100,
  sha: "abc1234",
  ref: "main",
  jobId: 1,
  webUrl: "https://gitlab.example/p/100",
  firstError: "Error: boom",
  ...over,
});

const issue = (over = {}, state = {}) => ({
  iid: 7,
  state: "opened",
  description: writeState("x", {
    v: 1,
    fp: "fp1",
    attempts: 1,
    pipelines: [100],
    escalated: false,
    ...state,
  }),
  ...over,
});

const NOW = new Date("2026-10-22T20:00:00Z");

describe("planActions", () => {
  it("creates one task for a new fingerprint", () => {
    const [a] = planActions({ failures: [F()], issues: [], now: NOW });
    assert.equal(a.type, "create");
    assert.equal(a.state.attempts, 1);
    assert.equal(a.state.escalated, false);
  });

  it("does nothing when the same pipeline is seen again (idempotent)", () => {
    const [a] = planActions({ failures: [F()], issues: [issue()], now: NOW });
    assert.equal(a.type, "skip");
    assert.match(a.reason, /already recorded/);
  });

  it("adds one attempt for a new failing pipeline", () => {
    const [a] = planActions({
      failures: [F({ pipelineId: 101 })],
      issues: [issue()],
      now: NOW,
    });
    assert.equal(a.type, "comment");
    assert.equal(a.state.attempts, 2);
    assert.deepEqual(a.state.pipelines, [100, 101]);
  });

  it("escalates exactly at the attempt cap, then leaves the task alone", () => {
    const [esc] = planActions({
      failures: [F({ pipelineId: 102 })],
      issues: [
        issue(
          {},
          { attempts: DEFAULTS.maxAttempts - 1, pipelines: [100, 101] }
        ),
      ],
      now: NOW,
    });
    assert.equal(esc.type, "escalate");
    assert.equal(esc.state.escalated, true);

    const [after] = planActions({
      failures: [F({ pipelineId: 103 })],
      issues: [
        issue({}, { attempts: 3, pipelines: [100, 101, 102], escalated: true }),
      ],
      now: NOW,
    });
    assert.equal(after.type, "skip");
    assert.match(after.reason, /escalated/);
  });

  it("creates an already-escalated task when the cap is met on first sight", () => {
    const failures = [100, 101, 102].map(pipelineId => F({ pipelineId }));
    const [a] = planActions({ failures, issues: [], now: NOW });
    assert.equal(a.type, "create");
    assert.equal(a.state.escalated, true);
  });

  it("waits after a recent close, and files a regression after the cooldown", () => {
    const recent = issue({
      state: "closed",
      closed_at: "2026-10-22T18:30:00Z",
    });
    const [wait] = planActions({
      failures: [F({ pipelineId: 200 })],
      issues: [recent],
      now: NOW,
    });
    assert.equal(wait.type, "skip");

    const old = issue({ state: "closed", closed_at: "2026-10-20T00:00:00Z" });
    const [again] = planActions({
      failures: [F({ pipelineId: 200 })],
      issues: [old],
      now: NOW,
    });
    assert.equal(again.type, "create");
    assert.equal(again.regressionOf, 7);
  });

  it("caps new tasks per run and ignores the ledger's own job", () => {
    const failures = [1, 2, 3, 4, 5].map(n =>
      F({ fp: `fp${n}`, pipelineId: n })
    );
    const actions = planActions({ failures, issues: [], now: NOW });
    assert.equal(
      actions.filter(a => a.type === "create").length,
      DEFAULTS.maxNewPerRun
    );
    assert.equal(actions.filter(a => a.type === "skip").length, 2);

    const own = planActions({
      failures: [F({ jobName: "agent_task_ledger" })],
      issues: [],
      now: NOW,
    });
    assert.deepEqual(own, []);
  });

  it("priority: secret scan is P0, default branch P1, branches P3", () => {
    assert.equal(priorityFor(F({ jobName: "secret_scan_gate" })), "P0");
    assert.equal(priorityFor(F()), "P1");
    assert.equal(priorityFor(F({ ref: "feat/x" })), "P3");
  });
});

// ---------------------------------------------------- permissions of the client

describe("client permissions", () => {
  it("allows only the narrow set of calls", () => {
    assertAllowed("GET", "/projects/1/pipelines?status=failed");
    assertAllowed(
      "GET",
      "/projects/1/merge_requests?state=opened&per_page=100"
    );
    assertAllowed("POST", "/projects/1/issues");
    assertAllowed("POST", "/projects/1/issues/5/notes");
    assertAllowed("PUT", "/projects/1/issues/5", {
      description: "x",
      add_labels: "needs-founder",
    });
  });

  it("refuses delete, close, reopen, repository writes and merge requests", () => {
    assert.throws(() => assertAllowed("DELETE", "/projects/1/issues/5"));
    assert.throws(() =>
      assertAllowed("PUT", "/projects/1/issues/5", { state_event: "close" })
    );
    assert.throws(() =>
      assertAllowed("PUT", "/projects/1/issues/5", { state_event: "reopen" })
    );
    assert.throws(() =>
      assertAllowed("PUT", "/projects/1/issues/5", { labels: "x" })
    );
    assert.throws(() =>
      assertAllowed("POST", "/projects/1/repository/commits")
    );
    assert.throws(() =>
      assertAllowed("PUT", "/projects/1/merge_requests/9/merge")
    );
    assert.throws(() => assertAllowed("POST", "/projects/1/pipelines"));
  });

  it("reads open merge requests only; no other merge request call", () => {
    assert.throws(() => assertAllowed("GET", "/projects/1/merge_requests/9"));
    assert.throws(() =>
      assertAllowed("GET", "/projects/1/merge_requests/9/changes")
    );
    assert.throws(() => assertAllowed("GET", "/projects/1/merge_requests"));
    assert.throws(() =>
      assertAllowed("POST", "/projects/1/merge_requests?state=opened")
    );
    assert.throws(() =>
      assertAllowed("PUT", "/projects/1/merge_requests?state=opened", {})
    );
  });
});

// ------------------------------------------------------ a full cycle, fake GitLab

/** In-memory GitLab that records every call. Not the real service. */
function fakeGitLab({ pipelines, jobs, traces, mrs = () => [] }) {
  const issues = [];
  const calls = [];
  let nextIid = 1;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const path = u.pathname.replace("/api/v4", "");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: path + u.search, body });
    const json = data => ({
      ok: true,
      json: async () => data,
      text: async () => String(data),
    });
    let m;
    if (method === "GET" && /\/pipelines$/.test(path)) {
      // Honour ?status= like GitLab does. Fixtures without a status are failed.
      const want = u.searchParams.get("status");
      return json(
        pipelines().filter(p => !want || (p.status ?? "failed") === want)
      );
    }
    if (method === "GET" && /\/merge_requests$/.test(path)) return json(mrs());
    if (method === "GET" && (m = /\/pipelines\/(\d+)\/jobs$/.exec(path)))
      return json(jobs(Number(m[1])));
    if (method === "GET" && (m = /\/jobs\/(\d+)\/trace$/.exec(path)))
      return json(traces(Number(m[1])));
    if (method === "GET" && /\/issues$/.test(path))
      return json(issues.map(i => ({ ...i })));
    if (method === "POST" && /\/issues$/.test(path)) {
      const made = {
        iid: nextIid++,
        state: "opened",
        title: body.title,
        description: body.description,
        labels: body.labels.split(","),
        notes: [],
      };
      issues.push(made);
      return json({ iid: made.iid });
    }
    if (method === "PUT" && (m = /\/issues\/(\d+)$/.exec(path))) {
      const it = issues.find(i => i.iid === Number(m[1]));
      if (body.description) it.description = body.description;
      if (body.add_labels) it.labels.push(body.add_labels);
      return json({ iid: it.iid });
    }
    if (method === "POST" && (m = /\/issues\/(\d+)\/notes$/.exec(path))) {
      issues.find(i => i.iid === Number(m[1])).notes.push(body.body);
      return json({});
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => "",
    };
  };
  return { fetchImpl, issues, calls };
}

describe("runLedger against a fake GitLab", () => {
  const LOG = "$ pnpm exec vitest run\nError: expected 3 to be 4\n";
  const state = {
    pipelines: [{ id: 100, sha: "aaa1111", ref: "main", web_url: "u/100" }],
  };
  const make = () =>
    fakeGitLab({
      pipelines: () => state.pipelines,
      jobs: id => [
        {
          id: id * 10,
          name: "quality_gate",
          failure_reason: "script_failure",
          allow_failure: false,
        },
        {
          id: id * 10 + 1,
          name: "static_checks",
          failure_reason: "script_failure",
          allow_failure: true,
        },
        {
          id: id * 10 + 2,
          name: "agent_task_ledger",
          failure_reason: "script_failure",
          allow_failure: false,
        },
      ],
      traces: () => LOG,
    });
  const clientFor = fake =>
    makeClient({
      baseUrl: "https://gl.example/api/v4",
      token: "t",
      fetchImpl: fake.fetchImpl,
    });
  const run = (fake, extra = {}) =>
    runLedger({ client: clientFor(fake), projectId: 1, now: NOW, ...extra });

  it("files one task, then does nothing on a rerun of the same pipeline", async () => {
    const fake = make();
    const first = await run(fake);
    assert.equal(first.actions.filter(a => a.type === "create").length, 1);
    assert.equal(fake.issues.length, 1);
    assert.ok(fake.issues[0].labels.includes(LABEL));
    assert.match(
      fake.issues[0].title,
      /^\[agent-task [0-9a-f]{12}\] quality_gate/
    );
    assert.match(
      fake.issues[0].description,
      /Do not skip, weaken or delete the failing check/
    );

    const writesBefore = fake.calls.filter(c => c.method !== "GET").length;
    const second = await run(fake);
    assert.equal(second.actions[0].type, "skip");
    assert.equal(fake.issues.length, 1);
    assert.equal(
      fake.calls.filter(c => c.method !== "GET").length,
      writesBefore
    );
  });

  it("ignores allow_failure jobs and its own job", async () => {
    const fake = make();
    const r = await run(fake);
    assert.equal(r.failures, 1);
  });

  it("counts attempts across pipelines, escalates at the cap, then stops", async () => {
    const fake = make();
    await run(fake);
    state.pipelines = [
      { id: 101, sha: "bbb2222", ref: "main", web_url: "u/101" },
    ];
    const second = await run(fake);
    assert.equal(second.actions[0].type, "comment");
    assert.equal(fake.issues[0].notes.length, 1);

    state.pipelines = [
      { id: 102, sha: "ccc3333", ref: "main", web_url: "u/102" },
    ];
    const third = await run(fake);
    assert.equal(third.actions[0].type, "escalate");
    assert.ok(fake.issues[0].labels.includes(ESCALATE_LABEL));
    assert.equal(readState(fake.issues[0].description).escalated, true);

    state.pipelines = [
      { id: 103, sha: "ddd4444", ref: "main", web_url: "u/103" },
    ];
    const notesBefore = fake.issues[0].notes.length;
    const fourth = await run(fake);
    assert.equal(fourth.actions[0].type, "skip");
    assert.equal(fake.issues[0].notes.length, notesBefore);
    assert.equal(
      fake.issues.length,
      1,
      "never a second issue for the same failure"
    );
    state.pipelines = [
      { id: 100, sha: "aaa1111", ref: "main", web_url: "u/100" },
    ];
  });

  it("a dry run reads and plans but writes nothing", async () => {
    const fake = make();
    const r = await run(fake, { dryRun: true });
    assert.equal(r.dryRun, true);
    assert.equal(r.actions[0].type, "create");
    assert.equal(fake.issues.length, 0);
    assert.ok(fake.calls.every(c => c.method === "GET"));
  });

  it("never issues a call outside its permissions", async () => {
    const fake = make();
    await run(fake);
    state.pipelines = [
      { id: 101, sha: "bbb2222", ref: "main", web_url: "u/101" },
    ];
    await run(fake);
    state.pipelines = [
      { id: 100, sha: "aaa1111", ref: "main", web_url: "u/100" },
    ];
    for (const c of fake.calls) {
      assert.doesNotThrow(
        () =>
          assertAllowed(
            c.method,
            c.method === "GET" ? c.path : c.path.split("?")[0],
            c.body
          ),
        `${c.method} ${c.path}`
      );
      assert.notEqual(c.method, "DELETE");
      assert.ok(!c.body || !("state_event" in c.body));
    }
  });

  it("titleFor is stable", () => {
    assert.equal(titleFor("abc", "job"), "[agent-task abc] job failing in CI");
  });
});

// ------------------------------------------- failures that no longer describe now

describe("which failures still matter", () => {
  const open = {
    defaultBranch: "main",
    openIids: new Set([7]),
    openBranches: new Set(["fix/x"]),
  };

  it("isLiveRef: the default branch, open merge request refs and their branches", () => {
    assert.equal(isLiveRef("main", open), true);
    assert.equal(isLiveRef("refs/merge-requests/7/head", open), true);
    assert.equal(isLiveRef("refs/merge-requests/7/merge", open), true);
    assert.equal(isLiveRef("refs/merge-requests/8/head", open), false);
    assert.equal(isLiveRef("fix/x", open), true);
    assert.equal(isLiveRef("old/branch", open), false);
    assert.equal(isLiveRef(undefined, open), false);
  });

  it("isSuperseded: only a later success on the same ref counts", () => {
    const failed = { id: 10, ref: "main" };
    const later = over => [{ id: 11, ref: "main", status: "success", ...over }];
    assert.equal(isSuperseded(failed, later()), true);
    assert.equal(isSuperseded(failed, later({ id: 9 })), false, "older run");
    assert.equal(isSuperseded(failed, later({ ref: "other" })), false);
    assert.equal(isSuperseded(failed, later({ status: "failed" })), false);
    assert.equal(isSuperseded(failed, later({ status: "running" })), false);
  });

  const P = (id, ref, status = "failed") => ({
    id,
    ref,
    status,
    sha: `sha${id}`,
    web_url: `u/${id}`,
  });
  const trace =
    "# fail 0\nError: boom\n+Uploading artifacts for failed job\nERROR: Job failed: exit code 1";
  const go = async (pipelines, mrs, extra = {}) => {
    const fake = fakeGitLab({
      pipelines: () => pipelines,
      jobs: id => [
        {
          id: id * 10,
          name: "quality_gate",
          failure_reason: "script_failure",
          allow_failure: false,
        },
      ],
      traces: () => trace,
      mrs: () => mrs,
    });
    const client = makeClient({
      baseUrl: "https://gl.example/api/v4",
      token: "t",
      fetchImpl: fake.fetchImpl,
    });
    const report = await runLedger({
      client,
      projectId: 1,
      now: NOW,
      ...extra,
    });
    return { report, fake };
  };
  const MR7 = { iid: 7, source_branch: "fix/x" };

  it("leaves out a failure that a later passing run on the same ref already fixed", async () => {
    const { report, fake } = await go(
      [
        P(100, "refs/merge-requests/7/head"),
        P(101, "refs/merge-requests/7/head", "success"),
      ],
      [MR7]
    );
    assert.equal(report.failures, 0);
    assert.deepEqual(report.filtered, { inactive: 0, superseded: 1 });
    assert.deepEqual(report.actions, []);
    assert.equal(fake.issues.length, 0);
    assert.match(summarize(report), /1 superseded by a passing run/);
  });

  it("leaves out a failure on a merge request that is no longer open", async () => {
    const { report, fake } = await go(
      [P(100, "refs/merge-requests/8/head")],
      [MR7]
    );
    assert.equal(report.failures, 0);
    assert.deepEqual(report.filtered, { inactive: 1, superseded: 0 });
    assert.equal(fake.issues.length, 0);
    assert.match(summarize(report), /1 on a closed or unknown ref/);
  });

  it("files a task for an open merge request that is still failing, with the real error", async () => {
    const { report, fake } = await go(
      [P(100, "refs/merge-requests/7/head")],
      [MR7]
    );
    assert.equal(report.failures, 1);
    assert.deepEqual(report.filtered, { inactive: 0, superseded: 0 });
    assert.equal(fake.issues.length, 1);
    assert.match(
      fake.issues[0].description,
      /\| First error \| Error: boom \|/
    );
    assert.match(fake.issues[0].description, /\| Priority \| P3 \|/);
  });

  it("keeps a failure on the default branch that came after the last pass", async () => {
    const { report } = await go(
      [P(100, "main", "success"), P(101, "main")],
      []
    );
    assert.equal(report.failures, 1);
    assert.equal(report.actions[0].type, "create");
    assert.equal(report.filtered.superseded, 0);
  });

  it("drops a default-branch failure once main has passed again", async () => {
    const { report } = await go(
      [P(100, "main"), P(101, "main", "success")],
      []
    );
    assert.equal(report.failures, 0);
    assert.equal(report.filtered.superseded, 1);
  });

  it("keeps a failure on the source branch of an open merge request", async () => {
    const { report } = await go([P(100, "fix/x")], [MR7]);
    assert.equal(report.failures, 1);
  });

  it("a dry run with filtering still writes nothing", async () => {
    const { report, fake } = await go(
      [
        P(100, "refs/merge-requests/7/head"),
        P(101, "refs/merge-requests/9/head"),
      ],
      [MR7],
      { dryRun: true }
    );
    assert.equal(report.failures, 1);
    assert.equal(report.filtered.inactive, 1);
    assert.ok(fake.calls.every(c => c.method === "GET"));
    assert.equal(fake.issues.length, 0);
  });
});
