/**
 * Free single-product EU DPP scan (Phase 3 PR-A). Pure: no I/O.
 *
 * Takes the fields one product record actually carries and reports which
 * passport data points are present, missing or malformed. It wraps
 * scoreDppReadiness() for the category obligation and dated deadline. It
 * checks data presence and format only: it does not assess legal conformity.
 */
import {
  DPP_READINESS_DISCLAIMER,
  categoryById,
  scoreDppReadiness,
  type DppCategory,
  type DppReadinessResult,
} from "./dpp-readiness";

/** New StorePilot Pro $29 one-time link. The only paid next step shown. */
export const STOREPILOT_PRO_LINK =
  "https://buy.stripe.com/6oU14n87n8Jo5iabDC1NE02";

export type ProductScanField =
  | "identifier"
  | "materials"
  | "recycled_content"
  | "footprint"
  | "care_repair"
  | "data_carrier";

export interface ProductScanInput {
  category: DppCategory;
  sellsInEu: boolean;
  name?: string;
  gtin?: string;
  serialOrBatch?: string;
  materials?: string;
  recycledContentPct?: string;
  co2eKg?: string;
  careRepair?: string;
  dataCarrierUrl?: string;
}

export interface ProductScanCheck {
  field: ProductScanField;
  label: string;
  weight: number;
  ok: boolean;
  gap: string | null;
}

export interface ProductScanResult {
  score: number;
  checks: ProductScanCheck[];
  gaps: string[];
  readiness: DppReadinessResult;
  proReportUrl: string;
  disclaimer: string;
}

export const PRODUCT_SCAN_DISCLAIMER =
  "Checks which data points this one product record has. Not legal advice and not a conformity assessment. " +
  DPP_READINESS_DISCLAIMER;

const s = (v?: string) => (typeof v === "string" ? v.trim() : "");

/** Mod-10 check digit for GTIN-8/12/13/14. */
export function isValidGtin(raw: string): boolean {
  const d = raw.replace(/\s+/g, "");
  if (!/^\d{8}$|^\d{12,14}$/.test(d)) return false;
  const digits = d.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

function num(v: string, min: number, max: number): boolean {
  if (!/^\d+(\.\d+)?$/.test(v)) return false;
  const n = Number(v);
  return n >= min && n <= max;
}

function httpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function scanDppProduct(
  input: ProductScanInput,
  opts: { now?: Date } = {}
): ProductScanResult {
  const gtin = s(input.gtin);
  const serial = s(input.serialOrBatch);
  const checks: ProductScanCheck[] = [
    {
      field: "identifier",
      label: "Unique identifier (valid GTIN plus serial or batch)",
      weight: 25,
      ok: isValidGtin(gtin) && serial.length > 0,
      gap: !gtin
        ? "Add a valid GTIN (barcode number) for this product."
        : !isValidGtin(gtin)
          ? "The GTIN check digit does not match. Re-check the number."
          : !serial
            ? "Add a serial or batch number next to the GTIN."
            : null,
    },
    {
      field: "materials",
      label: "Material composition",
      weight: 20,
      ok: s(input.materials).length >= 3,
      gap: "List the main materials, for example 80% cotton, 20% polyester.",
    },
    {
      field: "recycled_content",
      label: "Recycled content (%)",
      weight: 10,
      ok: num(s(input.recycledContentPct), 0, 100),
      gap: "Record recycled content as a percentage from 0 to 100.",
    },
    {
      field: "footprint",
      label: "Carbon footprint (kg CO2e per unit)",
      weight: 15,
      ok: num(s(input.co2eKg), 0, 1_000_000),
      gap: "Record a carbon footprint per unit in kg CO2e, even an estimate with its method noted.",
    },
    {
      field: "care_repair",
      label: "Care, repair or end-of-life instructions",
      weight: 10,
      ok: s(input.careRepair).length >= 10,
      gap: "Add care, repair or disposal instructions a buyer could follow.",
    },
    {
      field: "data_carrier",
      label: "Public product page a QR code can point to (https)",
      weight: 20,
      ok: httpsUrl(s(input.dataCarrierUrl)),
      gap: "Give this product a stable https page that a QR code can resolve to.",
    },
  ];
  for (const c of checks) if (c.ok) c.gap = null;

  const score = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0);
  const ok = (f: ProductScanField) => checks.find(c => c.field === f)!.ok;
  const readiness = scoreDppReadiness(
    {
      category: categoryById(input.category) ? input.category : "other",
      sellsInEu: input.sellsInEu,
      answers: {
        unique_id: ok("identifier"),
        supplier_data: ok("materials"),
        footprint: ok("footprint"),
        data_host: ok("data_carrier"),
      },
    },
    { now: opts.now, offerAudit: false }
  );

  return {
    score,
    checks,
    gaps: checks.filter(c => !c.ok).map(c => c.gap!),
    readiness,
    proReportUrl: STOREPILOT_PRO_LINK,
    disclaimer: PRODUCT_SCAN_DISCLAIMER,
  };
}

const FIELD_KEYS: Record<keyof Omit<ProductScanInput, "category" | "sellsInEu">, string> = {
  name: "name",
  gtin: "gtin",
  serialOrBatch: "serial",
  materials: "materials",
  recycledContentPct: "recycled_pct",
  co2eKg: "co2e_kg",
  careRepair: "care",
  dataCarrierUrl: "product_url",
};

/** Reads query params / MCP args. Null when no known category was chosen. */
export function parseProductScanInput(
  get: (key: string) => unknown
): ProductScanInput | null {
  const cat = get("category");
  if (typeof cat !== "string" || !categoryById(cat)) return null;
  const out: ProductScanInput = {
    category: cat as DppCategory,
    sellsInEu: get("sells_in_eu") !== "no",
  };
  for (const [k, q] of Object.entries(FIELD_KEYS)) {
    const v = get(q);
    if (typeof v === "string") (out as unknown as Record<string, string>)[k] = v.slice(0, 500);
  }
  return out;
}
