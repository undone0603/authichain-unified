/**
 * One hourly cron trigger, fanned out to the ten cleared scheduled jobs.
 *
 * Why this exists: the ten GROUP A jobs in `wrangler.toml` each have their own
 * cron expression, so wiring them the obvious way needs ten cron triggers. The
 * Cloudflare free plan caps cron triggers **per account**, at five — and three
 * are already spent by other workers in this repo (qron-automation,
 * authichain-autopilot, authichain-infra). Ten more is not close to possible.
 *
 * So the worker registers exactly one trigger, `0 * * * *`, and this module
 * decides on each tick which jobs that hour is due for. One trigger, ten jobs,
 * and the schedules stay written as ordinary cron expressions next to the job
 * they belong to rather than being flattened into whatever fits in five slots.
 *
 * The constraint this imposes: a job can only be scheduled to hour precision.
 * Every GROUP A schedule is already at minute 0 (daily at an hour, weekly on
 * Monday at 08:00, or every six hours), so all ten survive the move intact —
 * but `assertDispatchable` below fails loudly rather than silently rounding if
 * someone later adds a job that needs finer granularity. The GROUP B jobs,
 * several of which run every 2–30 minutes, genuinely cannot be dispatched this
 * way; they are held for separate reasons anyway (see wrangler.toml).
 */

/** A job this dispatcher is cleared to fire, with the schedule it fires on. */
export interface ClearedJob {
  /** Must match the `name` in server/scheduled-jobs.ts. */
  name: string;
  /** The job's own cron expression, as written in server/scheduled-jobs.ts. */
  schedule: string;
  /** Why it is safe to fire autonomously — see GROUP A in wrangler.toml. */
  rationale: string;
}

/**
 * GROUP A, verbatim.
 *
 * Internal maintenance, read-only monitoring, and transactional notifications
 * to existing customers about their own accounts. No autonomous outreach, no
 * money movement, no on-chain writes. Keep this list and the GROUP A comment
 * in `wrangler.toml` in step: this array is now the thing that actually decides
 * what runs, so a job added here starts firing on the next deploy.
 */
export const CLEARED_JOBS: ClearedJob[] = [
  { name: "database-cleanup", schedule: "0 3 * * *", rationale: "deletes old job-run/notification/session rows (internal)" },
  { name: "customer-health-score", schedule: "0 5 * * *", rationale: "recomputes health scores in DB (no external calls)" },
  { name: "subscription-health-check", schedule: "0 6 * * *", rationale: "in-app expiry notices, marks past-due, resets quotas (internal)" },
  { name: "certificate-expiry-check", schedule: "0 7 * * *", rationale: "notifies cert owners of expiry (transactional)" },
  { name: "dunning-escalation", schedule: "0 8 * * *", rationale: "transactional payment-failed emails to affected customers" },
  { name: "weekly-analytics-digest", schedule: "0 8 * * 1", rationale: "Monday internal stats report to the owner" },
  { name: "live-systems-check", schedule: "0 11 * * *", rationale: "read-only liveness ping of Stripe/HubSpot/Gmail/PostHog/GA4" },
  { name: "token-metrics", schedule: "0 12 * * *", rationale: "read-only on-chain $QRON supply/gas snapshot" },
  { name: "ecosystem-health", schedule: "0 13 * * *", rationale: "read-only external uptime check across product domains" },
  { name: "fraud-detection-sweep", schedule: "0 */6 * * *", rationale: "inserts fraud_alerts flags only (defensive)" },
];

/** The single trigger registered in wrangler.toml. */
export const DISPATCH_CRON = "0 * * * *";

/**
 * Matches one cron field against a value.
 *
 * Supports exactly the syntax GROUP A uses: `*`, a literal number, a
 * comma-separated list, an inclusive `a-b` range, and `* /n` step values. This
 * is deliberately not a general cron parser — anything it does not understand
 * throws rather than guessing, so an unsupported expression fails at startup
 * (via assertDispatchable) instead of silently never firing.
 */
function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    const step = part.match(/^\*\/(\d+)$/);
    if (step) {
      const n = Number(step[1]);
      if (!n) throw new Error(`invalid step in cron field: ${part}`);
      return value % n === 0;
    }
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) return value >= Number(range[1]) && value <= Number(range[2]);
    if (/^\d+$/.test(part)) return value === Number(part);
    throw new Error(`unsupported cron field: ${part}`);
  });
}

/**
 * True when `expr` is due at `date` (UTC).
 *
 * Day-of-month and day-of-week follow cron's usual rule: when both are
 * restricted the job runs if *either* matches, not both.
 */
export function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`expected 5 cron fields, got ${parts.length}: ${expr}`);
  const [min, hour, dom, month, dow] = parts;

  if (!fieldMatches(min, date.getUTCMinutes())) return false;
  if (!fieldMatches(hour, date.getUTCHours())) return false;
  if (!fieldMatches(month, date.getUTCMonth() + 1)) return false;

  const domRestricted = dom !== "*";
  const dowRestricted = dow !== "*";
  const domOk = fieldMatches(dom, date.getUTCDate());
  const dowOk = fieldMatches(dow, date.getUTCDay());
  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

/**
 * Fails loudly for any cleared job the hourly tick cannot actually fire.
 *
 * A schedule whose minute field is not a plain `0` would silently never run,
 * because the dispatcher only ever wakes at minute 0. Better to refuse the
 * job than to carry one that looks scheduled and never fires.
 */
export function assertDispatchable(jobs: ClearedJob[] = CLEARED_JOBS): void {
  for (const job of jobs) {
    const [min] = job.schedule.trim().split(/\s+/);
    if (min !== "0") {
      throw new Error(
        `${job.name} has schedule "${job.schedule}", which needs finer than hourly ` +
          `granularity; the hourly dispatcher only wakes at minute 0.`,
      );
    }
    // Surfaces an unsupported field now rather than at 03:00 on a Sunday.
    matchesCron(job.schedule, new Date(0));
  }
}

/** The jobs due at `now`, in declaration order. */
export function dueJobs(now: Date, jobs: ClearedJob[] = CLEARED_JOBS): ClearedJob[] {
  // The tick fires at minute 0, but Cloudflare may deliver it a little late.
  // Normalising to minute 0 keeps a 12:00:04 delivery from missing everything.
  const tick = new Date(now);
  tick.setUTCSeconds(0, 0);
  tick.setUTCMinutes(0);
  return jobs.filter((job) => matchesCron(job.schedule, tick));
}

/** Runs one job by name. Mirrors `runJobManually` in server/scheduled-jobs.ts. */
export type JobRunner = (name: string) => Promise<unknown>;

export interface DispatchResult {
  ran: string[];
  failed: { name: string; error: string }[];
}

/**
 * Runs every job due at `now`, isolating failures.
 *
 * Jobs run sequentially and one throwing does not stop the rest: these are
 * independent maintenance tasks, and a failing dunning run should not also
 * cancel that hour's database cleanup. Every outcome is returned so the caller
 * can log a single line per tick.
 */
export async function dispatch(now: Date, runJob: JobRunner, jobs: ClearedJob[] = CLEARED_JOBS): Promise<DispatchResult> {
  const result: DispatchResult = { ran: [], failed: [] };
  for (const job of dueJobs(now, jobs)) {
    try {
      await runJob(job.name);
      result.ran.push(job.name);
    } catch (err) {
      result.failed.push({ name: job.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/** The Workers ScheduledEvent fields this module uses. */
interface ScheduledEventLike {
  cron?: string;
  scheduledTime?: number;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Builds the `scheduled()` handler exported from index.ts.
 *
 * The runner is injected so the schedule logic can be tested without pulling in
 * `server/scheduled-jobs.ts`, which reaches for the database on import.
 */
export function createScheduledHandler(runJob: JobRunner) {
  return async function scheduled(
    event: ScheduledEventLike,
    _env: unknown,
    ctx?: ExecutionContextLike,
  ): Promise<void> {
    const now = event.scheduledTime ? new Date(event.scheduledTime) : new Date();
    const work = dispatch(now, runJob).then((result) => {
      const ran = result.ran.length ? result.ran.join(", ") : "none";
      console.log(`[cron-dispatch] ${now.toISOString()} ran: ${ran}`);
      for (const f of result.failed) {
        console.error(`[cron-dispatch] ${f.name} failed: ${f.error}`);
      }
    });
    // waitUntil keeps the isolate alive past the handler returning; without a
    // ctx (tests, local dev) just await it.
    if (ctx) ctx.waitUntil(work);
    else await work;
  };
}

/**
 * The default runner: defers to the existing job registry.
 *
 * Imported lazily so a tick with nothing due never loads the job module, and so
 * importing this file for its scheduling logic stays side-effect free.
 */
export const defaultJobRunner: JobRunner = async (name) => {
  const { runJobManually } = await import("../server/scheduled-jobs");
  const ok = await runJobManually(name);
  if (!ok) throw new Error(`job "${name}" is not registered or is disabled`);
  return ok;
};

/** The handler wired into worker-app/index.ts. */
export const scheduled = createScheduledHandler(defaultJobRunner);
