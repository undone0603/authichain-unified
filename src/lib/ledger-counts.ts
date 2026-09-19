/** Seed gallery profile — not a customer. */
export const DEMO_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export type LedgerCounts = {
  total_users: number;
  total_qrons: number;
  total_scans: number;
  generated_at: string;
};

type LedgerClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/**
 * Live ledger totals excluding seeded demo objects.
 * Caller supplies the client so a public page never imports the service role.
 */
export async function loadLedgerCounts(
  supabase: LedgerClient,
): Promise<LedgerCounts | null> {
  try {
    const [usersRes, qronsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .neq("id", DEMO_PROFILE_ID),
      supabase
        .from("qrons")
        .select("scan_count", { count: "exact" })
        .eq("is_demo", false),
    ]);
    if (usersRes.error || qronsRes.error) return null;
    const scanRows = qronsRes.data ?? [];
    return {
      total_users: usersRes.count || 0,
      total_qrons: qronsRes.count || 0,
      total_scans: scanRows.reduce(
        (sum, row) => sum + (row.scan_count || 0),
        0,
      ),
      generated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
