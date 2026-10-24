/**
 * Reads a StorePilot Pro entitlement written by the Stripe webhook (PR-C,
 * table storepilot_entitlements). Server-side only, service-role client.
 */
import { DEFAULT_CATALOG_LIMIT } from "./compliance-portfolio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

export type StorePilotEntitlement =
  | { entitled: true; catalogLimit: number }
  | { entitled: false };

export async function loadStorePilotEntitlement(
  admin: AnyClient,
  email: string | null | undefined
): Promise<StorePilotEntitlement> {
  const e = email?.trim().toLowerCase();
  if (!e) return { entitled: false };
  const { data, error } = await admin
    .from("storepilot_entitlements")
    .select("catalog_limit")
    .eq("customer_email", e)
    .eq("tier", "pro")
    .is("revoked_at", null)
    .order("catalog_limit", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { entitled: false };
  const n = Number(data.catalog_limit);
  return { entitled: true, catalogLimit: Number.isInteger(n) && n > 0 ? n : DEFAULT_CATALOG_LIMIT };
}
