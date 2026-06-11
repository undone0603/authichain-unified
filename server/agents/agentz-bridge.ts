import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logActivity } from '../db.js';
import type { MissionTask } from '../../drizzle/schema.js';
type Task = MissionTask;

const execAsync = promisify(exec);

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
  
  if (!workflowId) {
    throw new Error('AGENTZ_EXTERNAL: No workflowId in payload');
  }

  // Path to the agentz orchestrator (sibling of authichain-unified)
  const agentzPath = '/home/zac/agentz';
  
  // Construct command: set PYTHONPATH and run the module
  const command = `cd ${agentzPath} && PYTHONPATH=. python3 -m agentz.cli run ${workflowId} --mode ${mode} ${payload.args?.join(' ') || ''}`;

  console.log(`[AgentZ-Bridge] Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    
    await logActivity({
      userId: null,
      action: 'agentz_external_executed',
      entityType: 'task',
      entityId: 0,
      details: {
        taskId: task.id,
        workflowId,
        stdout: stdout.slice(-2000), // Log more output if available
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
      entityId: 0,
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
