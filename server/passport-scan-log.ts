import { count, gte } from "drizzle-orm";
import { passportScanLog } from "../drizzle/schema";
import { analyticsStub } from "./analytics-stub";
import { getDb } from "./db";
import type { PassportVerdict } from "./passport-verdict";

export const METERING_ON_SENTENCE =
  "In {period}, recorded passport scans were {genuine} genuine, {notGenuine} not genuine, and {noPassport} with no passport. These counts are scans recorded by AuthiChain. They are not a market counterfeit rate.";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type PassportScanVerdict = "genuine" | "not_genuine" | "no_passport";

export type PassportScanLogRow = {
  digitalIdentity: string | null;
  verdict: PassportScanVerdict;
  bindingMethod: string | null;
  bindingPass: boolean | null;
};

export type PassportScanCounts = {
  period: string;
  genuine: number;
  not_genuine: number;
  no_passport: number;
  message: string;
};

type VerdictRow = {
  verdict: string | null;
  n?: number | string | null;
};

type AppDb = Awaited<ReturnType<typeof getDb>>;

export function passportScanMeteringEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.PASSPORT_SCAN_METERING === "true";
}

/** An unparsed period is not widened to the whole table. */
export function periodStart(period: string, now: Date): Date | null {
  const match = /^(\d{1,4})([dh])$/.exec(period);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount < 1 || amount > 3660) return null;
  const span = match[2] === "d" ? amount * DAY_MS : amount * HOUR_MS;
  return new Date(now.getTime() - span);
}

export function passportScanLogRow(
  verdict: PassportVerdict
): PassportScanLogRow {
  const kind: PassportScanVerdict =
    verdict.genuine === true
      ? "genuine"
      : verdict.genuine === false
        ? "not_genuine"
        : "no_passport";
  const binding = verdict.productBinding;
  const identity = verdict.digitalIdentity;
  return {
    digitalIdentity:
      kind === "no_passport"
        ? null
        : typeof identity === "string" && identity.length > 0
          ? identity
          : null,
    verdict: kind,
    bindingMethod: typeof binding?.method === "string" ? binding.method : null,
    bindingPass: typeof binding?.pass === "boolean" ? binding.pass : null,
  };
}

export function countPassportVerdicts(
  rows: VerdictRow[],
  period: string
): PassportScanCounts {
  let genuine = 0;
  let notGenuine = 0;
  let noPassport = 0;
  for (const row of rows) {
    const n = Number(row.n ?? 1);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (row.verdict === "genuine") genuine += n;
    else if (row.verdict === "not_genuine") notGenuine += n;
    else if (row.verdict === "no_passport") noPassport += n;
  }
  return {
    period,
    genuine,
    not_genuine: notGenuine,
    no_passport: noPassport,
    message: METERING_ON_SENTENCE.replace("{period}", period)
      .replace("{genuine}", String(genuine))
      .replace("{notGenuine}", String(notGenuine))
      .replace("{noPassport}", String(noPassport)),
  };
}

async function insertPassportScanLog(row: PassportScanLogRow): Promise<void> {
  const db = await getDb();
  await db.insert(passportScanLog).values({
    digitalIdentity: row.digitalIdentity,
    verdict: row.verdict,
    bindingMethod: row.bindingMethod,
    bindingPass: row.bindingPass,
  });
}

export async function recordPassportScan(
  verdict: PassportVerdict,
  deps?: {
    enabled?: boolean;
    insert?: (row: PassportScanLogRow) => Promise<void>;
  }
): Promise<void> {
  const enabled = deps?.enabled ?? passportScanMeteringEnabled();
  if (!enabled) return;
  const row = passportScanLogRow(verdict);
  const insert = deps?.insert ?? insertPassportScanLog;
  await insert(row);
}

/** Only call site is POST /api/internal/verify. A log failure does not change the verdict. */
export async function finishPassportScan(
  verdict: PassportVerdict,
  deps?: { insert?: (row: PassportScanLogRow) => Promise<void> }
): Promise<void> {
  if (!passportScanMeteringEnabled()) return;
  try {
    await recordPassportScan(verdict, {
      enabled: true,
      ...(deps?.insert ? { insert: deps.insert } : {}),
    });
  } catch {
    console.error("[Internal API] passport scan log error");
  }
}

export async function readPassportScanCounts(
  db: AppDb,
  period: string,
  now: Date = new Date()
): Promise<PassportScanCounts> {
  const start = periodStart(period, now);
  if (!start) return countPassportVerdicts([], period);
  const rows = await db
    .select({
      verdict: passportScanLog.verdict,
      n: count(),
    })
    .from(passportScanLog)
    .where(gte(passportScanLog.recordedAt, start))
    .groupBy(passportScanLog.verdict);
  return countPassportVerdicts(rows, period);
}

export async function analyticsResponse(
  period: string,
  db: AppDb | null,
  env: Record<string, string | undefined> = process.env
): Promise<{
  status: number;
  body:
    { error: string } | PassportScanCounts | ReturnType<typeof analyticsStub>;
}> {
  if (!db) return { status: 503, body: { error: "Database unavailable" } };
  if (!passportScanMeteringEnabled(env)) {
    return { status: 200, body: analyticsStub(period) };
  }
  return { status: 200, body: await readPassportScanCounts(db, period) };
}
