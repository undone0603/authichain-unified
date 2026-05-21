/**
 * Dev Team Agent: OPEN_PR + CODE_REVIEW + MERGE_PR
 *
 * OPEN_PR:
 *   payload: { branch: string; title: string; body: string }
 *   Creates a GitHub pull request from the feature branch → main.
 *   Stores prNumber in activity log for downstream tasks.
 *
 * CODE_REVIEW:
 *   payload: { branch: string; prNumber: number }
 *   LLM reads the full diff, posts a structured review with inline comments.
 *   If APPROVE → enqueues MERGE_PR. If REQUEST_CHANGES → enqueues WRITE_CODE (fix).
 *
 * MERGE_PR:
 *   payload: { prNumber: number; branch: string }
 *   Merges the PR (squash). If REQUIRE_DEV_APPROVAL=true → sets task WAITING_HUMAN first.
 */

import { invokeLLM } from '../../_core/llm.js';
import { logActivity, markTaskWaitingHuman, getDb } from '../../db.js';
import { ENV } from '../../_core/env.js';
import type { MissionTask as Task } from '../../../drizzle/schema.js';
import {
  createPR,
  getPR,
  getPRFiles,
  addPRReview,
  addPRComment,
  mergePR,
  getFile,
} from './github-service.js';

// ─── OPEN_PR ─────────────────────────────────────────────────────────────

export async function runOpenPR(task: Task): Promise<void> {
  const p = task.payload as {
    branch: string;
    title: string;
    body: string;
    base?: string;
  };

  const pr = await createPR({
    title: p.title,
    body:  p.body,
    head:  p.branch,
    base:  p.base,
  });

  await logActivity({
    userId: null,
    action: 'pr_opened',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId:    task.id,
      missionId: task.missionId,
      prNumber:  pr.number,
      prUrl:     pr.html_url,
      branch:    p.branch,
    },
  });

  // Enqueue CODE_REVIEW task immediately after PR is open
  const db = await getDb();
  const reviewTaskId = crypto.randomUUID();
  await (db as any).execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'CODE_REVIEW',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
    [reviewTaskId, task.missionId, JSON.stringify({ branch: p.branch, prNumber: pr.number })]
  );
}

// ─── CODE_REVIEW ──────────────────────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are AgentZ, a rigorous senior code reviewer for authichain-unified.

Review for:
1. Correctness — logic bugs, off-by-one errors, race conditions
2. Security — SQL injection, XSS, unvalidated inputs, exposed secrets
3. Types — TypeScript errors, missing null checks
4. Conventions — .js imports, proper logActivity() usage, correct tRPC patterns
5. Performance — unnecessary DB queries, missing indexes, N+1 problems
6. Completeness — missing edge cases, incomplete error handling

Return JSON:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "summary": "1-2 sentence overall assessment",
  "inlineComments": [
    { "path": "file/path.ts", "line": 42, "body": "comment text" }
  ],
  "requiredFixes": ["description of blocking issue 1", ...],
  "suggestions": ["non-blocking suggestion 1", ...]
}

If there are no blocking issues, verdict should be APPROVE.
Only REQUEST_CHANGES for actual bugs, security issues, or broken TypeScript.`;

export async function runCodeReview(task: Task): Promise<void> {
  const p = task.payload as { branch: string; prNumber: number };

  const pr = await getPR(p.prNumber);
  const changedFiles = await getPRFiles(p.prNumber);

  // Read full content of changed files for deep review
  const fileDiffs = changedFiles.slice(0, 10).map(f =>
    `### ${f.filename} (${f.status})\n\`\`\`diff\n${f.patch ?? '(binary or large file)'}\n\`\`\``
  ).join('\n\n');

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: `PR #${p.prNumber}: ${pr.title}\n\n${pr.body}\n\n## Changed Files\n\n${fileDiffs}` },
    ],
    responseFormat: { type: 'json_object' },
  });

  let review: {
    verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    summary: string;
    inlineComments: Array<{ path: string; line: number; body: string }>;
    requiredFixes: string[];
    suggestions: string[];
  };

  try {
    review = JSON.parse(result.choices[0].message.content as string);
  } catch {
    throw new Error('CODE_REVIEW: LLM returned unparseable JSON');
  }

  // Post review to GitHub
  const ghEvent = review.verdict === 'APPROVE'
    ? 'APPROVE'
    : review.verdict === 'REQUEST_CHANGES'
    ? 'REQUEST_CHANGES'
    : 'COMMENT';

  const reviewBody = [
    `**AgentZ Code Review** — ${review.summary}`,
    review.requiredFixes.length ? `\n**Required fixes:**\n${review.requiredFixes.map(f => `- ${f}`).join('\n')}` : '',
    review.suggestions.length   ? `\n**Suggestions:**\n${review.suggestions.map(s => `- ${s}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  await addPRReview({
    prNumber: p.prNumber,
    body: reviewBody,
    event: ghEvent,
    comments: review.inlineComments
      .filter(c => c.line > 0)
      .map(c => ({ path: c.path, line: c.line, body: c.body })),
  });

  await logActivity({
    userId: null,
    action: 'code_review_posted',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId:    task.id,
      missionId: task.missionId,
      prNumber:  p.prNumber,
      verdict:   review.verdict,
      summary:   review.summary,
      fixes:     review.requiredFixes,
    },
  });

  const db = await getDb();

  if (review.verdict === 'APPROVE') {
    // Enqueue MERGE_PR
    await (db as any).execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'MERGE_PR',$3,'PENDING',NOW() + INTERVAL '1 minute')`,
      [crypto.randomUUID(), task.missionId, JSON.stringify({ prNumber: p.prNumber, branch: p.branch })]
    );
  } else if (review.verdict === 'REQUEST_CHANGES') {
    // Re-enqueue WRITE_CODE with the fix list as context
    await (db as any).execute(
      `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'WRITE_CODE',$3,'PENDING',NOW() + INTERVAL '2 minutes')`,
      [
        crypto.randomUUID(),
        task.missionId,
        JSON.stringify({
          branch:    p.branch,
          feature:   `Fix review feedback on PR #${p.prNumber}`,
          context:   `Required fixes:\n${review.requiredFixes.join('\n')}`,
          prNumber:  p.prNumber,
        }),
      ]
    );
  }
}

// ─── MERGE_PR ─────────────────────────────────────────────────────────────

export async function runMergePR(task: Task): Promise<void> {
  const p = task.payload as { prNumber: number; branch: string };

  // If approval required — gate here
  if (ENV.requireDevApproval) {
    await markTaskWaitingHuman(task.id);
    await addPRComment(
      p.prNumber,
      `**AgentZ:** PR is ready to merge ✅\n\nTests passed · Code reviewed · Awaiting human approval.\n\nTo proceed: re-queue this task or merge manually on GitHub.`
    );
    await logActivity({
      userId: null,
      action: 'merge_awaiting_approval',
      entityType: 'task',
      entityId: 0,
      details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber },
    });
    return;
  }

  // Check PR is mergeable
  const pr = await getPR(p.prNumber);
  if (pr.state !== 'open') {
    throw new Error(`PR #${p.prNumber} is already ${pr.state}`);
  }
  if (pr.mergeable === false) {
    throw new Error(`PR #${p.prNumber} has merge conflicts — needs manual resolution`);
  }

  await mergePR(p.prNumber, 'squash');

  // Enqueue MONITOR_DEPLOY
  const db = await getDb();
  await (db as any).execute(
    `INSERT INTO tasks (id, mission_id, kind, payload, status, run_at) VALUES ($1,$2,'MONITOR_DEPLOY',$3,'PENDING',NOW() + INTERVAL '3 minutes')`,
    [crypto.randomUUID(), task.missionId, JSON.stringify({ prNumber: p.prNumber, branch: p.branch })]
  );

  await logActivity({
    userId: null,
    action: 'pr_merged',
    entityType: 'task',
    entityId: 0,
    details: { taskId: task.id, missionId: task.missionId, prNumber: p.prNumber },
  });
}
