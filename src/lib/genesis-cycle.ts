import { isCronAuthorized } from "./cron-auth";

/**
 * Shared genesis / daily-economy runner.
 *
 * PUBLIC_LOOP_FREEZE: do not call AutonomousController (outbound email),
 * pipeline-tick (AgentZ), programmatic SEO, or gov-mint from this path.
 * Maintenance + a read of fee_flows / brands staking is enough to prove
 * the authentic economy can run once CRON_SECRET is bound.
 */
export function authorizeGenesis(request: Request): boolean {
  return isCronAuthorized(request);
}

export async function runGenesisCycle(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {
    outbound: "skipped_public_loop_freeze",
  };

  try {
    const { runDailyMaintenance } = await import("./automation");
    await runDailyMaintenance();
    results.maintenance = "ok";
  } catch (err) {
    results.maintenance = err instanceof Error ? err.message : String(err);
  }

  try {
    const { supabaseAdmin } = await import("./supabase-admin");
    const [fees, brands] = await Promise.all([
      supabaseAdmin
        .from("fee_flows")
        .select("id, flow_type, status, net_amount", { count: "exact", head: false })
        .limit(5),
      supabaseAdmin
        .from("brands")
        .select("id, staking_tier, qron_staked", { count: "exact", head: false })
        .limit(5),
    ]);
    results.economy = {
      ok: !fees.error && !brands.error,
      fee_flows: fees.count ?? fees.data?.length ?? 0,
      brands: brands.count ?? brands.data?.length ?? 0,
      staking_columns: "staking_tier,qron_staked",
      fee_error: fees.error?.message,
      brand_error: brands.error?.message,
    };
  } catch (err) {
    results.economy = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return results;
}

export function genesisJson(results: Record<string, unknown>) {
  return {
    ok: true,
    status: "genesis",
    results,
    timestamp: new Date().toISOString(),
  };
}
