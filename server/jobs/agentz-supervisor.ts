import "dotenv/config";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ENV } from "../_core/env";
import { logActivity } from "../db";
import { runPipelineTick } from "./pipeline-tick";

type TickResult = Awaited<ReturnType<typeof runPipelineTick>>;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function delay(ms: number) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

async function acquireLock(lockFilePath: string) {
  const handle = await fs.open(lockFilePath, "wx");
  await handle.writeFile(
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  return handle;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function runSingleTick() {
  const result = await runPipelineTick();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

export async function runAgentZSupervisor(options?: { once?: boolean }) {
  if (!ENV.autonomousPipelineEnabled) {
    throw new Error(
      "AgentZ requires AUTONOMOUS_PIPELINE_ENABLED=true. Set it in runtime environment before starting.",
    );
  }

  const once = options?.once ?? process.argv.includes("--once");
  const tickSeconds = parsePositiveInt(process.env.AGENTZ_TICK_SECONDS, 300);
  const baseBackoffSeconds = parsePositiveInt(process.env.AGENTZ_FAILURE_BACKOFF_SECONDS, 60);
  const lockFilePath = resolve(process.cwd(), process.env.AGENTZ_LOCK_FILE ?? ".agentz.lock");

  let lockHandle: Awaited<ReturnType<typeof acquireLock>> | null = null;
  let shouldStop = false;
  let consecutiveFailures = 0;

  process.on("SIGINT", () => {
    shouldStop = true;
  });
  process.on("SIGTERM", () => {
    shouldStop = true;
  });

  try {
    lockHandle = await acquireLock(lockFilePath);
  } catch (error) {
    throw new Error(
      `AgentZ supervisor is already running or lock file is stale (${lockFilePath}). Remove the lock file if no process is active.`,
    );
  }

  await logActivity({
    userId: null,
    action: "agentz_supervisor_started",
    entityType: "automation",
    entityId: 0,
    details: {
      once,
      tickSeconds,
      baseBackoffSeconds,
      lockFilePath,
      startedAt: new Date().toISOString(),
    },
  });

  try {
    do {
      const tickStartedAt = Date.now();

      try {
        const tickResult: TickResult = await runSingleTick();
        consecutiveFailures = 0;
        await logActivity({
          userId: null,
          action: "agentz_tick_success",
          entityType: "automation",
          entityId: 0,
          details: tickResult,
        });
      } catch (error) {
        consecutiveFailures += 1;
        const failureMessage = toErrorMessage(error);
        const backoffSeconds = baseBackoffSeconds * Math.min(consecutiveFailures, 10);

        await logActivity({
          userId: null,
          action: "agentz_tick_failed",
          entityType: "automation",
          entityId: 0,
          details: {
            failureMessage,
            consecutiveFailures,
            backoffSeconds,
          },
        });

        console.error(`AgentZ tick failed (${consecutiveFailures}): ${failureMessage}`);

        if (once) {
          throw error;
        }

        await delay(backoffSeconds * 1000);
        continue;
      }

      if (once || shouldStop) {
        break;
      }

      const elapsedMs = Date.now() - tickStartedAt;
      const sleepMs = Math.max(tickSeconds * 1000 - elapsedMs, 1000);
      await delay(sleepMs);
    } while (!shouldStop);
  } finally {
    await logActivity({
      userId: null,
      action: "agentz_supervisor_stopped",
      entityType: "automation",
      entityId: 0,
      details: {
        stoppedAt: new Date().toISOString(),
        bySignal: shouldStop,
      },
    });

    try {
      await lockHandle?.close();
      await fs.unlink(lockFilePath);
    } catch {
      // No-op: best effort cleanup.
    }
  }
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runAgentZSupervisor()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("AgentZ supervisor failed:", err);
      process.exit(1);
    });
}
