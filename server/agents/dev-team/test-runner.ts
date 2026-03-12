/**
 * Dev Team Agent: RUN_TESTS + MONITOR_DEPLOY + FILE_BUG + AUTO_FIX
 *
 * RUN_TESTS:
 *   payload: { branch: string; prNumber?: number }
 *   Reads the PR's head SHA, polls GitHub Actions until the CI run completes.
 *   On failure → enqueues AUTO_FIX with the failure context.
 *
 * MONITOR_DEPLOY:
 *   payload: { prNumber: number; branch: string }
 *   Polls Cloudflare Workers deployments after a merge.
 *   On failure → files a GitHub issue + enqueues AUTO_FIX.
 *
 * FILE_BUG:
 *   payload: { title: string; body: string; labels?: string[]; relatedBranch?: string }
 *   Creates a GitHub issue.
 *
 * AUTO_FIX:
 *   payload: { branch: string; errorSummary: string; failedFiles?: string[] }
 *   LLM diagnoses the error and enqueues a targeted WRITE_CODE to fix it.
 */

import { invokeLLM } from '../../_core/llm.js';
import { logActivity, createSystemNotification } from '../../db.js';
import type { MissionTask as Task } from '../../../drizzle/schema.js';
import {
  getPR,
  getLatestRunForSha,
  waitForCIRun,
  createIssue,
  searchCode,
} from './github-service.js';

// ─── RUN_TESTS ────────────────────────────────────────────────────────────

export async function runTests(task: Task): Promise<void> {
  const p = task.payload as { branch: string; prNumber?: number };

  // Get the PR head SHA
  let headSha: string | undefined;
  if (p.prNumber) {
    const pr = await getPR(p.prNumber);
    headSha = pr.head.sha;
  } else {
    // Get latest commit on branch via GitHub API
    const { getBranchSha } = await import('./github-service.js');
    headSha = await getBranchSha(p.branch);
  }

  // Wait for CI to complete (up to 10 minutes)
  const run = await waitForCIRun(headSha, { timeoutMs: 10 * 60 * 1000 });

  if (!run) {
    throw new Error(`RUN_TESTS: No CI run found for ${p.branch} (SHA: ${headSha?.slice(0, 8)})`);
  }

  const passed = run.conclusion === 'success';

  await logActivity({
    userId: null,
    action: passed ? 'tests_passed' : 'tests_failed',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId:     task.id,
      missionId:  task.missionId,
      branch:     p.branch,
      runId:      run.id,
      conclusion: run.conclusion,
      runUrl:     run.html_url,
    },
  });

  if (!passed) {
    // Enqueue AUTO_FIX
    const { db } = await import('../../db.js');
    await (db as any).execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'AUTO_FIX',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch:       p.branch,
          errorSummary: `CI failed on branch ${p.branch}. Run: ${run.html_url}. Conclusion: ${run.conclusion}.`,
        }),
      ]
    );
    throw new Error(`Tests failed (${run.conclusion}). AUTO_FIX enqueued. See: ${run.html_url}`);
  }
}

// ─── MONITOR_DEPLOY ───────────────────────────────────────────────────────

export async function runMonitorDeploy(task: Task): Promise<void> {
  const p = task.payload as { prNumber: number; branch: string };

  // Poll Cloudflare for recent deployment (simple health check approach)
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
    ?? `https://authichain-unified.${process.env.CLOUDFLARE_ACCOUNT_ID}.workers.dev`;

  let deployHealthy = false;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise(r => setTimeout(r, 30_000)); // 30s between checks
    try {
      const res = await fetch(`${workerUrl}/api/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok || res.status < 500) {
        deployHealthy = true;
        break;
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  await logActivity({
    userId: null,
    action: deployHealthy ? 'deploy_healthy' : 'deploy_failed',
    entityType: 'task',
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber, lastError },
  });

  if (!deployHealthy) {
    // File a bug
    const issue = await createIssue({
      title: `[AgentZ] Deploy health check failed after PR #${p.prNumber}`,
      body:  `Automatic deploy monitor detected an issue after merging PR #${p.prNumber}.\n\n**Error:** ${lastError}\n\n**Branch:** ${p.branch}\n\nInvestigate and fix or revert.`,
      labels: ['bug', 'deploy', 'agentz'],
    });

    // Enqueue AUTO_FIX
    const { db } = await import('../../db.js');
    await (db as any).execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'AUTO_FIX',$3,'PENDING',NOW())`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch:       `agentz/hotfix-${task.id.slice(0, 8)}`,
          errorSummary: `Production health check failing: ${lastError}. Issue: ${issue.html_url}`,
        }),
      ]
    );

    // Notify admin
    const { getAllAdminIds } = await import('../../db.js');
    const adminIds = await getAllAdminIds();
    for (const adminId of adminIds) {
      await createSystemNotification(
        adminId,
        '🚨 Deploy Health Check Failed',
        `Post-deploy health check failed after PR #${p.prNumber}: ${lastError}. AUTO_FIX queued.`,
        'alert',
        issue.html_url
      );
    }
  }
}

// ─── FILE_BUG ─────────────────────────────────────────────────────────────

export async function runFileBug(task: Task): Promise<void> {
  const p = task.payload as {
    title: string;
    body: string;
    labels?: string[];
    relatedBranch?: string;
  };

  const issue = await createIssue({
    title:  p.title,
    body:   p.body,
    labels: p.labels ?? ['bug', 'agentz'],
  });

  await logActivity({
    userId: null,
    action: 'bug_filed',
    entityType: 'task',
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, issueNumber: issue.number, issueUrl: issue.html_url },
  });
}

// ─── AUTO_FIX ─────────────────────────────────────────────────────────────

const DIAGNOSIS_PROMPT = `You are AgentZ, a debugging expert for authichain-unified.

Given an error summary, identify the most likely root cause and the exact files that need to be changed to fix it.

Return JSON:
{
  "diagnosis": "1-2 sentence root cause analysis",
  "filesToFix": ["path/to/file.ts"],
  "fixDescription": "clear instruction for the WRITE_CODE agent to follow",
  "isHotfix": true/false  // true if this needs a new branch, false if it can go on the existing branch
}`;

export async function runAutoFix(task: Task): Promise<void> {
  const p = task.payload as {
    branch: string;
    errorSummary: string;
    failedFiles?: string[];
  };

  // Search code for relevant files
  const keywords = p.errorSummary.split(' ').slice(0, 5).join(' ');
  const searchResults = await searchCode(keywords);

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: DIAGNOSIS_PROMPT },
      { role: 'user', content: `Error: ${p.errorSummary}\n\nRelated files found: ${searchResults.map(r => r.path).join(', ')}\n${p.failedFiles?.length ? `\nFailed files: ${p.failedFiles.join(', ')}` : ''}` },
    ],
    responseFormat: { type: 'json_object' },
  });

  let diagnosis: {
    diagnosis: string;
    filesToFix: string[];
    fixDescription: string;
    isHotfix: boolean;
  };

  try {
    diagnosis = JSON.parse(result.choices[0].message.content as string);
  } catch {
    throw new Error('AUTO_FIX: LLM returned unparseable JSON');
  }

  const targetBranch = diagnosis.isHotfix
    ? `agentz/hotfix-${task.id.slice(0, 8)}`
    : p.branch;

  if (diagnosis.isHotfix) {
    const { createBranch } = await import('./github-service.js');
    await createBranch(targetBranch);
  }

  // Enqueue WRITE_CODE targeting the identified files
  const { db } = await import('../../db.js');
  const fixTaskId = crypto.randomUUID();
  await (db as any).execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'WRITE_CODE',$3,'PENDING',NOW() + INTERVAL '1 minute')`,
    [
      fixTaskId,
      task.missionId,
      JSON.stringify({
        branch:          targetBranch,
        feature:         `Auto-fix: ${diagnosis.diagnosis}`,
        filesToModify:   diagnosis.filesToFix,
        context:         diagnosis.fixDescription,
      }),
    ]
  );

  // If hotfix, also enqueue OPEN_PR + RUN_TESTS
  if (diagnosis.isHotfix) {
    const runAt2 = new Date(Date.now() + 6 * 60 * 1000); // after WRITE_CODE
    await (db as any).execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'OPEN_PR',$3,'PENDING',$4)`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch: targetBranch,
          title:  `fix: ${diagnosis.diagnosis.slice(0, 70)}`,
          body:   `**Auto-fix by AgentZ**\n\n**Root cause:** ${diagnosis.diagnosis}\n\n**Original error:** ${p.errorSummary}`,
        }),
        runAt2,
      ]
    );
  }

  await logActivity({
    userId: null,
    action: 'auto_fix_queued',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId:     task.id,
      missionId:  task.missionId,
      diagnosis:  diagnosis.diagnosis,
      branch:     targetBranch,
      isHotfix:   diagnosis.isHotfix,
      fixTaskId,
    },
  });
}
