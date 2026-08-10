/**
 * Processes pending BROWSE_VISION_* tasks on a Playwright-capable Node host.
 * Run by .github/workflows/browser-vision-tasks.yml (which installs Chromium
 * and sets PLAYWRIGHT_AVAILABLE=1); the app runtime leaves these tasks
 * pending (see server/jobs/task-runner.ts) and never imports browser-vision,
 * so playwright-core stays out of the Workers bundle.
 *
 * Usage: PLAYWRIGHT_AVAILABLE=1 pnpm tsx scripts/run-vision-tasks.ts
 */
import { getDueTasks, markTaskRunning, markTaskDone, markTaskFailed, getDb } from '../server/db.js';
import { runVisionResearchLead, runVisionFreeform } from '../server/agents/browser-vision.js';

const VISION_RUNNERS: Record<string, (task: any, db: any) => Promise<unknown>> = {
  BROWSE_VISION_RESEARCH_LEAD: runVisionResearchLead,
  BROWSE_VISION_FREEFORM: runVisionFreeform,
};

async function main() {
  if (process.env.PLAYWRIGHT_AVAILABLE !== '1') {
    throw new Error('Set PLAYWRIGHT_AVAILABLE=1 (and install Chromium) before running vision tasks.');
  }

  const db = await getDb();
  const due = await getDueTasks(50);
  const visionTasks = due.filter(t => t.kind && VISION_RUNNERS[t.kind]);
  console.log(`Due tasks: ${due.length}; vision tasks: ${visionTasks.length}`);

  let ran = 0;
  let errors = 0;
  for (const task of visionTasks) {
    const claimed = await markTaskRunning(task.id);
    if (!claimed) continue;
    try {
      await VISION_RUNNERS[task.kind!](task, db);
      // markTaskDone guards with WHERE status='RUNNING', matching task-runner
      await markTaskDone(task.id);
      ran++;
    } catch (err) {
      await markTaskFailed(task.id, err instanceof Error ? err.message : String(err));
      errors++;
    }
  }

  console.log(`Done. ran=${ran} errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('run-vision-tasks failed:', err);
  process.exit(1);
});
