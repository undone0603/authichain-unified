/**
 * Dev Team Agent: PLAN_SPRINT + WRITE_CODE
 *
 * PLAN_SPRINT:
 *   payload: { feature: string; context?: string; targetFiles?: string[] }
 *   LLM decomposes the feature request into a sequence of WRITE_CODE + OPEN_PR + RUN_TESTS tasks.
 *   Inserts them as PENDING tasks on the same mission, chained in dependency order.
 *
 * WRITE_CODE:
 *   payload: {
 *     branch: string;          // e.g. "agentz/feature-<taskId>"
 *     feature: string;         // human-readable description
 *     filesToModify: string[];  // relative paths in repo
 *     filesToCreate: string[];  // new files to create
 *     context?: string;         // additional LLM instructions
 *     prNumber?: number;        // if fixing a failing review
 *   }
 *   Reads existing files, LLM proposes changes, writes them via GitHub API.
 */

import { invokeLLM, parseLLMContent } from '../../_core/llm';
import { logActivity, getDb } from '../../db';
import { missionTasks } from '../../../drizzle/schema';
import type { MissionTask as Task } from '../../../drizzle/schema';
import {
  createBranch,
  getFile,
  writeFile,
  searchCode,
<<<<<<< HEAD
} from './github-service.js';
=======
  listFiles,
} from './github-service';
>>>>>>> origin/add-agentz-editable

// ─── Codebase knowledge injected into every code-write prompt ────────────

const CODEBASE_SYSTEM_PROMPT = `You are AgentZ, the autonomous senior engineer for authichain-unified.

## Tech stack
- Runtime: Cloudflare Workers (nodejs_compat), TypeScript
- Frontend: React 19, Vite, wouter (routing), shadcn/ui, Tailwind CSS, TanStack Query via tRPC
- Backend: tRPC v11, Drizzle ORM, PostgreSQL (Supabase), Zod validation
- Auth: JWT cookies via getSessionCookieOptions
- Blockchain: Thirdweb SDK, Polygon + Base
- AI: Forge API (OpenAI-compatible) via server/_core/llm.ts invokeLLM()
- Payments: Stripe
- CRM: HubSpot
- Deployment: Cloudflare Worker + Vercel (static assets)

## Project structure
- server/routers.ts         — all tRPC procedures (add new routers here)
- server/db.ts              — all database queries (add helpers here)
- server/_core/env.ts       — env var access (add new vars here)
- server/_core/llm.ts       — invokeLLM(params) for all LLM calls
- server/agents/            — pipeline agents (one file per concern)
- server/jobs/              — cron job runners
- server/missions/types.ts  — TaskKind + MissionType enums
- drizzle/schema.ts         — Drizzle table definitions
- drizzle/migrations/       — numbered SQL migration files
- client/src/pages/         — React page components (lazy-loaded in App.tsx)
- client/src/components/    — shared UI components
- client/src/lib/trpc.ts    — tRPC client (import trpc from here)

## Coding conventions
- All imports use .js extension (even for .ts files) — required for ESM
- Agents export async function run<Name>(task: Task): Promise<void>
- Use logActivity() for audit trail, createSystemNotification() for user alerts
- New pages need: lazy import in App.tsx + Route + nav item in DashboardLayout.tsx
- New tRPC routes: add to appRouter in routers.ts, use adminProcedure for admin-only
- DB helpers: add to db.ts, use drizzle ORM syntax
- Env vars: add to ENV object in server/_core/env.ts AND wrangler.toml comment

## Response format
Always respond with a JSON object:
{
  "files": [
    {
      "path": "relative/path/from/repo/root",
      "content": "complete file content — never partial",
      "action": "create" | "update",
      "commitMessage": "short commit message for this file"
    }
  ],
  "summary": "one-sentence summary of what was changed",
  "nextSteps": ["any notes for the PR description or code reviewer"]
}

IMPORTANT: Always return COMPLETE file content. Never use "..." or "existing code here" placeholders.`;

// ─── PLAN_SPRINT ─────────────────────────────────────────────────────────

export async function runPlanSprint(task: Task): Promise<void> {
  const p = task.payload as {
    feature: string;
    context?: string;
    targetFiles?: string[];
    repo?: string;
  };

  const branchName = `agentz/sprint-${task.id.slice(0, 8)}`;

  const prompt = `You are AgentZ, technical lead for authichain-unified.

Feature request: "${p.feature}"
${p.context ? `\nAdditional context: ${p.context}` : ''}
${p.targetFiles?.length ? `\nHinted files: ${p.targetFiles.join(', ')}` : ''}

Break this feature into a concrete development plan. Return JSON:
{
  "branch": "${branchName}",
  "prTitle": "feat: <short title>",
  "prBody": "## What\\n...\\n\\n## Why\\n...\\n\\n## Testing\\n...",
  "tasks": [
    {
      "kind": "WRITE_CODE",
      "payload": {
        "branch": "${branchName}",
        "feature": "...",
        "filesToModify": ["path/to/existing.ts"],
        "filesToCreate": ["path/to/new.ts"],
        "context": "specific instructions for this code change"
      }
    }
  ],
  "followupTasks": [
    { "kind": "OPEN_PR",     "payload": { "branch": "${branchName}", "title": "...", "body": "..." } },
    { "kind": "RUN_TESTS",   "payload": { "branch": "${branchName}" } },
    { "kind": "CODE_REVIEW", "payload": { "branch": "${branchName}" } }
  ]
}

Rules:
- Split large features into multiple WRITE_CODE tasks (one per concern: DB schema, server, client)
- Always include OPEN_PR → RUN_TESTS → CODE_REVIEW after WRITE_CODE tasks
- Keep each WRITE_CODE task focused on 1-3 files maximum`;

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: CODEBASE_SYSTEM_PROMPT },
      { role: 'user',   content: prompt },
    ],
    responseFormat: { type: 'json_object' },
  });

  let plan: {
    branch: string;
    prTitle: string;
    prBody: string;
    tasks: Array<{ kind: string; payload: Record<string, unknown> }>;
    followupTasks: Array<{ kind: string; payload: Record<string, unknown> }>;
  };

  plan = parseLLMContent<typeof plan>(result.choices[0].message.content);

  // Create the feature branch
  await createBranch(plan.branch);

  // Enqueue all planned tasks (WRITE_CODE + OPEN_PR + RUN_TESTS + CODE_REVIEW)
<<<<<<< HEAD
  const { createTask } = await import('../../db.js');
  const allTasks = [...plan.tasks, ...plan.followupTasks];

  for (const t of allTasks) {
    await createTask({
      missionId: task.missionId,
      kind: t.kind,
      title: t.kind,
      payload: t.payload,
      status: 'pending',
    });
  }
=======
  const db = await getDb();
  const allTasks = [...plan.tasks, ...plan.followupTasks];

  await db.insert(missionTasks).values(
    allTasks.map((t, i) => ({
      id: crypto.randomUUID(),
      missionId: task.missionId,
      kind: t.kind,
      title: `${t.kind.replace(/_/g, ' ')}: ${p.feature.slice(0, 60)}`,
      payload: t.payload,
      status: 'PENDING' as const,
      scheduledAt: new Date(Date.now() + (i + 1) * 5 * 60 * 1000),
    }))
  );
>>>>>>> origin/add-agentz-editable

  await logActivity({
    userId: null,
    action: 'sprint_planned',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId: task.id,
      missionId: task.missionId,
      branch: plan.branch,
      tasksEnqueued: allTasks.length,
      feature: p.feature,
    },
  });
}

// ─── WRITE_CODE ───────────────────────────────────────────────────────────

export async function runWriteCode(task: Task): Promise<void> {
  const p = task.payload as {
    branch: string;
    feature: string;
    filesToModify?: string[];
    filesToCreate?: string[];
    context?: string;
    prNumber?: number;
  };

  const filesToModify = p.filesToModify ?? [];
  const filesToCreate = p.filesToCreate ?? [];

  // Read existing files the LLM needs as context
  const existingFiles: { path: string; content: string }[] = [];
  for (const path of filesToModify) {
    const file = await getFile(path, p.branch);
    if (file) existingFiles.push({ path, content: file.content });
  }

  // Search for relevant symbols if files weren't specified
  if (!filesToModify.length && !filesToCreate.length) {
    const searchResults = await searchCode(p.feature.split(' ').slice(0, 3).join(' '));
    for (const r of searchResults.slice(0, 4)) {
      const file = await getFile(r.path, p.branch);
      if (file) existingFiles.push({ path: r.path, content: file.content });
    }
  }

  // Also include key architectural files for context
  const archFiles = ['server/missions/types.ts', 'server/_core/env.ts'];
  for (const path of archFiles) {
    if (!existingFiles.find(f => f.path === path)) {
      const file = await getFile(path, p.branch);
      if (file) existingFiles.push({ path, content: file.content.slice(0, 2000) }); // truncate long files
    }
  }

  const fileContext = existingFiles.map(f =>
    `### ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``
  ).join('\n\n');

  const userPrompt = `Feature: "${p.feature}"
${p.context ? `\nInstructions: ${p.context}` : ''}
${p.prNumber ? `\nThis is a fix for review feedback on PR #${p.prNumber}` : ''}

Files to modify: ${filesToModify.join(', ') || 'none — use your judgement based on codebase knowledge'}
Files to create: ${filesToCreate.join(', ') || 'none specified'}

## Current file contents:
${fileContext || '(no files provided — create new files as needed)'}

Write the code changes. Return the full JSON response as specified in your system prompt.`;

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: CODEBASE_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
    responseFormat: { type: 'json_object' },
  });

  let codeResult: {
    files: Array<{
      path: string;
      content: string;
      action: 'create' | 'update';
      commitMessage: string;
    }>;
    summary: string;
    nextSteps: string[];
  };

  codeResult = parseLLMContent<typeof codeResult>(result.choices[0].message.content);

  if (!codeResult.files?.length) {
    throw new Error('WRITE_CODE: LLM returned no files');
  }

  // Commit each file to the feature branch
  const committedFiles: string[] = [];
  for (const file of codeResult.files) {
    const existing = await getFile(file.path, p.branch);
    await writeFile({
      path:    file.path,
      content: file.content,
      message: `[AgentZ] ${file.commitMessage}`,
      branch:  p.branch,
      sha:     existing?.sha,
    });
    committedFiles.push(file.path);
  }

  await logActivity({
    userId: null,
    action: 'code_written',
    entityType: 'task',
    entityId: 0,
    details: {
      taskId:    task.id,
      missionId: task.missionId,
      branch:    p.branch,
      files:     committedFiles,
      summary:   codeResult.summary,
      nextSteps: codeResult.nextSteps,
    },
  });
}
