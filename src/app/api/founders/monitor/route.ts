/**
 * GET /api/founders/monitor
 * Live autonomous pipeline + GitHub Actions status for Founders DreamDash.
 *
 * Auth matches sibling founders routes: resolveFoundersAccess(request).
 * automation_logs is read through access.supabase (same as digest/dashboard).
 *
 * GITHUB_MONITOR_TOKEN is server-only (never NEXT_PUBLIC_). Missing token
 * degrades GitHub Actions status; automation logs still return.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveFoundersAccess } from "@/lib/dreamdash/founders-access";

export const dynamic = "force-dynamic";

const REPO = "undone0603/authichain-unified";

/** Columns that exist on public.automation_logs (drizzle/0000 + later inserts). */
const AUTOMATION_LOG_COLUMNS =
  "id, workflow_name, trigger_type, status, payload, error_message, created_at";

/**
 * Workflow files that exist under .github/workflows. Draft list was kept in
 * full — all eight files are present on this tree.
 */
export const MONITORED_WORKFLOWS = [
  "agentz-host-executable-identity.yml",
  "pipeline-tick.yml",
  "autonomous-business-cycle.yml",
  "marketing-autonomous.yml",
  "agentz-orchestration.yml",
  "autonomy-reconcile.yml",
  "deploy-authichain-com.yml",
  "deploy-authichain-app.yml",
] as const;

export interface WorkflowRunSnapshot {
  workflow: string;
  runId: number | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string | null;
  updatedAt: string | null;
}

export interface AutomationLogItem {
  id: string;
  workflow_name: string;
  trigger_type: string;
  status: string;
  payload: string | null;
  error_message: string | null;
  created_at: string;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchWorkflowSnapshots(): Promise<{
  available: boolean;
  runs: WorkflowRunSnapshot[];
  error?: string;
}> {
  const token = process.env.GITHUB_MONITOR_TOKEN;
  if (!token) {
    return {
      available: false,
      runs: [],
      error: "GITHUB_MONITOR_TOKEN is not configured on the server.",
    };
  }

  const results = await Promise.all(
    MONITORED_WORKFLOWS.map(async (workflow): Promise<WorkflowRunSnapshot> => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=1`,
          {
            headers: githubHeaders(token),
            cache: "no-store",
          }
        );

        if (!res.ok) {
          return {
            workflow,
            runId: null,
            status: `http_${res.status}`,
            conclusion: null,
            htmlUrl: null,
            updatedAt: null,
          };
        }

        const data = (await res.json()) as {
          workflow_runs?: Array<{
            id: number;
            status: string;
            conclusion: string | null;
            html_url: string;
            updated_at: string;
          }>;
        };
        const latest = data.workflow_runs?.[0];
        if (!latest) {
          return {
            workflow,
            runId: null,
            status: "no_runs",
            conclusion: null,
            htmlUrl: null,
            updatedAt: null,
          };
        }

        return {
          workflow,
          runId: latest.id,
          status: latest.status,
          conclusion: latest.conclusion,
          htmlUrl: latest.html_url,
          updatedAt: latest.updated_at,
        };
      } catch {
        return {
          workflow,
          runId: null,
          status: "fetch_error",
          conclusion: null,
          htmlUrl: null,
          updatedAt: null,
        };
      }
    })
  );

  return { available: true, runs: results };
}

export async function GET(request: NextRequest) {
  const access = await resolveFoundersAccess(request);
  if (!access.ok) {
    return json({ error: access.error }, access.status);
  }

  const [logsRes, workflows] = await Promise.all([
    access.supabase
      .from("automation_logs")
      .select(AUTOMATION_LOG_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(25),
    fetchWorkflowSnapshots(),
  ]);

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    actor: access.actor,
    automationLogs: {
      error: logsRes.error?.message ?? null,
      items: (logsRes.data ?? []) as AutomationLogItem[],
    },
    githubActions: workflows,
  });
}
