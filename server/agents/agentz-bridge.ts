import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logActivity } from '../db.js';
import type { MissionTask } from '../../drizzle/schema.js';
type Task = MissionTask;

const execFileAsync = promisify(execFile);

const VALID_WORKFLOW_ID = /^[A-Za-z0-9._-]+$/;
const VALID_MODES = new Set(['auto', 'confirm', 'dry-run']);

/**
 * AGENTZ_EXTERNAL Bridge Agent
 *
 * Triggers external Python workflows from the AgentZ orchestrator.
 * Payload: { workflowId: string; mode?: 'auto' | 'confirm' | 'dry-run'; args?: string[] }
 */
export async function runAgentZExternal(task: Task): Promise<void> {
  const payload = task.payload as { workflowId: string; mode?: string; args?: string[] };
  const workflowId = payload?.workflowId;
  const mode = payload?.mode || 'auto';
  const extraArgs = Array.isArray(payload?.args) ? payload!.args : [];

  if (!workflowId) {
    throw new Error('AGENTZ_EXTERNAL: No workflowId in payload');
  }
  if (!VALID_WORKFLOW_ID.test(workflowId)) {
    throw new Error(`AGENTZ_EXTERNAL: Invalid workflowId: ${workflowId}`);
  }
  if (!VALID_MODES.has(mode)) {
    throw new Error(`AGENTZ_EXTERNAL: Invalid mode: ${mode}`);
  }

  // Resolve the agentz package root. Default to the repo root (two levels up
  // from server/agents/) so PYTHONPATH=. finds the `agentz` package.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const agentzPath = process.env.AGENTZ_PATH || path.resolve(here, '..', '..');
  const pythonBin = process.env.AGENTZ_PYTHON || 'python3';

  const cliArgs = ['-m', 'agentz.cli', 'run', workflowId, '--mode', mode, ...extraArgs];

  console.log(`[AgentZ-Bridge] Executing: ${pythonBin} ${cliArgs.join(' ')} (cwd=${agentzPath})`);

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, cliArgs, {
      cwd: agentzPath,
      env: { ...process.env, PYTHONPATH: agentzPath },
    });

    await logActivity({
      userId: null,
      action: 'agentz_external_executed',
      entityType: 'task',
      details: {
        taskId: task.id,
        workflowId,
        stdout: stdout.slice(-2000),
        stderr: stderr.slice(-1000),
      },
    });

    console.log(`[AgentZ-Bridge] Successfully executed workflow: ${workflowId}`);
  } catch (error: any) {
    console.error(`[AgentZ-Bridge] Execution failed for ${workflowId}: ${error.message}`);

    await logActivity({
      userId: null,
      action: 'agentz_external_failed',
      entityType: 'task',
      details: {
        taskId: task.id,
        workflowId,
        error: error.message,
        stderr: error.stderr?.slice(-1000),
      },
    });

    throw new Error(`AgentZ execution failed: ${error.message}`);
  }
}
