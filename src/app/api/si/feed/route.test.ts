import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const state = vi.hoisted(() => ({
  isAdmin: true,
  rows: [] as Record<string, unknown>[],
}));

vi.mock("../../../../utils/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        gte: () => query,
        order: () => query,
        limit: async () => ({ data: state.rows, error: null }),
      };
      return query;
    },
  }),
}));

vi.mock("../../../../lib/require-admin", () => ({
  requireAdmin: async () =>
    state.isAdmin
      ? { user: { id: "owner" } }
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
}));

import { GET } from "./route";

const get = (query = "") =>
  GET(new NextRequest(`https://authichain.com/api/si/feed${query}`));

describe("/api/si/feed", () => {
  beforeEach(() => {
    state.isAdmin = true;
    state.rows = [];
  });

  it("requires the owner session before returning operational activity", async () => {
    state.isAdmin = false;

    const response = await get();

    expect(response.status).toBe(401);
  });

  it("normalizes automation logs without exposing raw log payloads", async () => {
    state.rows = [
      {
        id: "event-1",
        workflow_name: "agentz_daily_check",
        trigger_type: "webhook",
        status: "failure",
        created_at: "2026-10-02T10:00:00.000Z",
        error_message: "sensitive detail",
        payload: '{"token":"private"}',
      },
    ];

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events[0]).toMatchObject({
      id: "event-1",
      source: "agentz",
      transport: "webhook",
      type: "automation.run_failed",
      severity: "warning",
      entity: "agentz_daily_check",
      agent: "AgentZ",
    });
    expect(JSON.stringify(body)).not.toContain("sensitive detail");
    expect(JSON.stringify(body)).not.toContain("private");
  });

  it("filters by source, severity, and entity", async () => {
    state.rows = [
      {
        id: "event-agent",
        workflow_name: "agentz_nightly",
        trigger_type: "cron",
        status: "failure",
        created_at: "2026-10-02T10:00:00.000Z",
      },
      {
        id: "event-automation",
        workflow_name: "weekly_report",
        trigger_type: "cron",
        status: "success",
        created_at: "2026-10-02T09:00:00.000Z",
      },
    ];

    const response = await get(
      "?source=agentz&severity=warning&entity=nightly"
    );
    const body = await response.json();

    expect(body.events).toHaveLength(1);
    expect(body.events[0].id).toBe("event-agent");
  });

  it("rejects malformed since cursors", async () => {
    const response = await get("?since=not-a-date");

    expect(response.status).toBe(400);
  });
});
