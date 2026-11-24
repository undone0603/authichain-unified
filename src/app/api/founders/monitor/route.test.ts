import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const TOKEN = "test-monitor-token-not-a-secret";

const { access, logs } = vi.hoisted(() => {
  const logs = {
    data: [
      {
        id: "log-1",
        workflow_name: "pipeline-tick",
        trigger_type: "cron",
        status: "success",
        payload: '{"ok":true}',
        error_message: null,
        created_at: "2026-11-24T18:00:00.000Z",
      },
    ] as unknown[],
    error: null as { message: string } | null,
    selectArg: "",
  };
  const chain = {
    select(columns: string) {
      logs.selectArg = columns;
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return Promise.resolve({ data: logs.data, error: logs.error });
    },
  };
  const supabase = {
    from: vi.fn(() => chain),
  };
  const access = {
    result: {
      ok: true as const,
      actor: "founder" as const,
      supabase,
    } as
      | { ok: true; actor: "founder" | "agentz"; supabase: typeof supabase }
      | { ok: false; status: number; error: string },
    supabase,
  };
  return { access, logs };
});

vi.mock("@/lib/dreamdash/founders-access", () => ({
  resolveFoundersAccess: vi.fn(async () => access.result),
}));

import { GET, MONITORED_WORKFLOWS } from "./route";

function get() {
  return GET({} as NextRequest);
}

function workflowUrl(name: string) {
  return `https://api.github.com/repos/undone0603/authichain-unified/actions/workflows/${name}/runs?per_page=1`;
}

describe("GET /api/founders/monitor", () => {
  const savedToken = process.env.GITHUB_MONITOR_TOKEN;

  beforeEach(() => {
    access.result = { ok: true, actor: "founder", supabase: access.supabase };
    logs.data = [
      {
        id: "log-1",
        workflow_name: "pipeline-tick",
        trigger_type: "cron",
        status: "success",
        payload: '{"ok":true}',
        error_message: null,
        created_at: "2026-11-24T18:00:00.000Z",
      },
    ];
    logs.error = null;
    logs.selectArg = "";
    access.supabase.from.mockClear();
    delete process.env.GITHUB_MONITOR_TOKEN;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const workflow = MONITORED_WORKFLOWS.find(name =>
          url.includes(`/workflows/${name}/`)
        );
        return {
          ok: true,
          status: 200,
          json: async () => ({
            workflow_runs: [
              {
                id: 42,
                status: "completed",
                conclusion: "success",
                html_url: `https://github.com/undone0603/authichain-unified/actions/runs/42?w=${workflow ?? ""}`,
                updated_at: "2026-11-24T18:01:00.000Z",
              },
            ],
          }),
        };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedToken === undefined) delete process.env.GITHUB_MONITOR_TOKEN;
    else process.env.GITHUB_MONITOR_TOKEN = savedToken;
  });

  it("returns the founders access error and status when unauthorized", async () => {
    access.result = { ok: false, status: 401, error: "Unauthorized" };
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(access.supabase.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("omits GitHub Actions when GITHUB_MONITOR_TOKEN is missing and still returns logs", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.githubActions).toEqual({
      available: false,
      runs: [],
      error: "GITHUB_MONITOR_TOKEN is not configured on the server.",
    });
    expect(body.automationLogs.items).toHaveLength(1);
    expect(body.automationLogs.items[0].workflow_name).toBe("pipeline-tick");
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("returns latest logs and per-workflow runs on the happy path", async () => {
    process.env.GITHUB_MONITOR_TOKEN = TOKEN;
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.actor).toBe("founder");
    expect(body.githubActions.available).toBe(true);
    expect(body.githubActions.runs).toHaveLength(MONITORED_WORKFLOWS.length);
    expect(body.githubActions.runs[0]).toMatchObject({
      workflow: MONITORED_WORKFLOWS[0],
      runId: 42,
      status: "completed",
      conclusion: "success",
    });
    expect(body.automationLogs.items[0]).toMatchObject({
      id: "log-1",
      trigger_type: "cron",
      payload: '{"ok":true}',
    });
    expect(logs.selectArg).toBe(
      "id, workflow_name, trigger_type, status, payload, error_message, created_at"
    );
    const columns = logs.selectArg.split(",").map(part => part.trim());
    expect(columns).not.toContain("trigger");
    expect(columns).not.toContain("metadata");
    expect(columns).not.toContain("error");
    expect(access.supabase.from).toHaveBeenCalledWith("automation_logs");

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toMatch(/ghs_|github_pat_|Bearer /i);

    expect(fetch).toHaveBeenCalledTimes(MONITORED_WORKFLOWS.length);
    const firstCall = vi.mocked(fetch).mock.calls[0];
    expect(String(firstCall[0])).toBe(workflowUrl(MONITORED_WORKFLOWS[0]));
    const headers = (firstCall[1] as RequestInit | undefined)
      ?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("lists only workflow files that exist in .github/workflows", () => {
    const root = join(import.meta.dirname, "..", "..", "..", "..", "..");
    for (const workflow of MONITORED_WORKFLOWS) {
      expect(
        existsSync(join(root, ".github", "workflows", workflow)),
        workflow
      ).toBe(true);
    }
  });
});
