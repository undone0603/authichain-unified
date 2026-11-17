/**
 * Hourly QRON mode-usage digest (observability only).
 *
 * Kill switch: MODE_USAGE_CRON_ENABLED (plain var, default "false"). When not
 * "true" it only logs a dry-run line. No outbound HTTP, no email, no posts,
 * no new bindings. Counts come from an injected loader; this Worker has no
 * read path to qron_generations today, so the default loader reports
 * "no_data_source" instead of inventing numbers.
 */

export const CORE_MODES = ["stellar_seal", "batch_verify", "limited_drop"] as const;
export type CoreMode = (typeof CORE_MODES)[number];
export const MIN_TOTAL_FOR_ALERT = 100;
export const MIN_CORE_SHARE = 0.05;

export type ModeCounts = { total: number; byMode: Partial<Record<string, number>> };

export type ModeUsageDigest = {
  evt: "qron_mode_usage";
  total: number;
  shares: Record<CoreMode, number>;
  low_share_modes: CoreMode[];
  alert: boolean;
};

/** Alert when total >= 100 and any core mode share < 5%. */
export function computeModeUsageDigest(c: ModeCounts): ModeUsageDigest {
  const total = Math.max(0, Math.floor(c.total || 0));
  const shares = {} as Record<CoreMode, number>;
  const low: CoreMode[] = [];
  for (const m of CORE_MODES) {
    const n = Math.max(0, c.byMode[m] || 0);
    const share = total > 0 ? n / total : 0;
    shares[m] = Math.round(share * 10000) / 10000;
    if (share < MIN_CORE_SHARE) low.push(m);
  }
  const alert = total >= MIN_TOTAL_FOR_ALERT && low.length > 0;
  return { evt: "qron_mode_usage", total, shares, low_share_modes: alert ? low : [], alert };
}

export type ModeUsageEnv = { MODE_USAGE_CRON_ENABLED?: string };

export async function runModeUsageCron(
  env: ModeUsageEnv | undefined,
  deps: {
    loadCounts?: () => Promise<ModeCounts | null>;
    log?: (line: string) => void;
  } = {},
): Promise<{ status: "dry_run" | "no_data_source" | "ok" | "error"; digest?: ModeUsageDigest }> {
  const log = deps.log ?? ((l: string) => console.log(l));
  if (env?.MODE_USAGE_CRON_ENABLED !== "true") {
    log(JSON.stringify({ evt: "qron_mode_usage", status: "dry-run" }));
    return { status: "dry_run" };
  }
  if (!deps.loadCounts) {
    log(JSON.stringify({ evt: "qron_mode_usage", status: "no_data_source" }));
    return { status: "no_data_source" };
  }
  try {
    const counts = await deps.loadCounts();
    if (!counts) {
      log(JSON.stringify({ evt: "qron_mode_usage", status: "no_data_source" }));
      return { status: "no_data_source" };
    }
    const digest = computeModeUsageDigest(counts);
    log(JSON.stringify({ ...digest, status: "ok" }));
    return { status: "ok", digest };
  } catch (err) {
    log(JSON.stringify({ evt: "qron_mode_usage", status: "error", error: err instanceof Error ? err.message : String(err) }));
    return { status: "error" };
  }
}
