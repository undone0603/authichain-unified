import type { ComplianceAccess } from "./compliance-access";
import {
  categoryById,
  daysUntil,
  type ObligationStatus,
} from "./dpp-readiness";

/**
 * The compliance dashboard's data: the account's published Digital Product
 * Passports and what EU law says about each one's category. Every figure is
 * derived at request time from the products rows and dpp-readiness.ts; no
 * count, date or status is stored or typed in.
 */

export type DppProductRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  serial_number: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type PortfolioItem = {
  id: string;
  name: string;
  brand: string | null;
  serial: string | null;
  categoryLabel: string | null;
  /** "unmapped" when the stored category is not one dpp-readiness knows. */
  obligation: ObligationStatus | "unmapped";
  legalDate: string | null;
  daysToLegalDate: number | null;
  when: string | null;
  source: string | null;
  publishedAt: string | null;
  verifyUrl: string | null;
};

export type Portfolio = {
  items: PortfolioItem[];
  counts: Record<PortfolioItem["obligation"], number>;
  /** The nearest legal date across the portfolio, if any category has one. */
  nearestLegal: { date: string; days: number; products: number } | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Pure: shape rows for display. `now` is explicit so tests never expire. */
export function buildPortfolio(rows: DppProductRow[], now: Date): Portfolio {
  const items = rows.map((row): PortfolioItem => {
    const meta = row.metadata ?? {};
    const info = row.category ? categoryById(row.category) : undefined;
    const visitId = str(meta.visit_id);
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      serial: row.serial_number,
      categoryLabel: info?.label ?? row.category,
      obligation: info?.status ?? "unmapped",
      legalDate: info?.date ?? null,
      daysToLegalDate: info?.date ? daysUntil(info.date, now) : null,
      when: info?.when ?? null,
      source: info?.source ?? null,
      publishedAt: str(meta.published_at) ?? row.created_at,
      verifyUrl: visitId
        ? `/api/dpp/verify?dpp_id=${encodeURIComponent(row.id)}&visit_id=${encodeURIComponent(visitId)}`
        : null,
    };
  });

  const counts: Portfolio["counts"] = {
    law: 0,
    expected: 0,
    none: 0,
    unmapped: 0,
  };
  for (const item of items) counts[item.obligation] += 1;

  let nearestLegal: Portfolio["nearestLegal"] = null;
  for (const item of items) {
    if (!item.legalDate || item.daysToLegalDate === null) continue;
    if (!nearestLegal || item.legalDate < nearestLegal.date) {
      nearestLegal = {
        date: item.legalDate,
        days: item.daysToLegalDate,
        products: 0,
      };
    }
  }
  if (nearestLegal) {
    const date = nearestLegal.date;
    nearestLegal.products = items.filter(i => i.legalDate === date).length;
  }

  return { items, counts, nearestLegal };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

const PRODUCT_COLUMNS =
  "id, name, brand, category, serial_number, created_at, metadata";
const MAX_ROWS = 500;

/**
 * Load the rows behind the dashboard. Takes a *granted* access result, so the
 * data cannot be fetched without the entitlement check having run first
 * (Next's guidance: authorize at the data layer, not in a layout).
 *
 * A subscriber sees the passports their account published (linked through the
 * dpp_published loop event, which records profile_id). The owner sees every
 * published passport.
 */
export async function loadPortfolioRows(
  admin: AnyClient,
  access: Extract<ComplianceAccess, { allowed: true }>
): Promise<DppProductRow[]> {
  if (access.reason === "owner") {
    const { data } = await admin
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("metadata->>dpp", "true")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    return (data ?? []) as DppProductRow[];
  }

  if (!access.profileId) return [];
  const { data: events } = await admin
    .from("funnel_events")
    .select("metadata")
    .eq("event_type", "dpp_loop:dpp_published")
    .eq("metadata->>profile_id", access.profileId)
    .limit(MAX_ROWS);

  const ids = [
    ...new Set(
      ((events ?? []) as Array<{ metadata: Record<string, unknown> | null }>)
        .map(e => str(e.metadata?.dpp_id))
        .filter((id): id is string => id !== null)
    ),
  ];
  if (ids.length === 0) return [];

  const { data } = await admin
    .from("products")
    .select(PRODUCT_COLUMNS)
    .in("id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []) as DppProductRow[];
}
