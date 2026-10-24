/**
 * Parses a StorePilot catalog upload (CSV with a header row, or a JSON array)
 * into DppProductRow[]. Pure. Columns: id, name, brand, category, serial_number
 * (also accepted: sku for id, serial for serial_number). Rows without a name
 * are rejected with their 1-based row number.
 */
import type { DppProductRow } from "./compliance-portfolio";

export type CatalogParse =
  | { ok: true; rows: DppProductRow[] }
  | { ok: false; error: string };

const MAX_BYTES = 1_000_000;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function toRow(rec: Record<string, unknown>, i: number): DppProductRow | string {
  const g = (k: string) => (typeof rec[k] === "string" && (rec[k] as string).trim() ? (rec[k] as string).trim() : null);
  const name = g("name");
  if (!name) return `row ${i + 1}: name is required`;
  return {
    id: g("id") ?? g("sku") ?? `row-${i + 1}`,
    name,
    brand: g("brand"),
    category: g("category"),
    serial_number: g("serial_number") ?? g("serial"),
    created_at: null,
    metadata: null,
  };
}

export function parseCatalogUpload(body: string, contentType = ""): CatalogParse {
  if (body.length > MAX_BYTES) return { ok: false, error: "upload is larger than 1 MB" };
  let records: Record<string, unknown>[];
  const t = body.trim();
  if (contentType.includes("json") || t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (!Array.isArray(parsed)) return { ok: false, error: "JSON upload must be an array" };
      records = parsed.filter(r => r && typeof r === "object");
    } catch {
      return { ok: false, error: "JSON upload could not be parsed" };
    }
  } else {
    const lines = t.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { ok: false, error: "upload is empty" };
    const head = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    records = lines.slice(1).map(l => {
      const cells = splitCsvLine(l);
      return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
    });
  }
  const rows: DppProductRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = toRow(records[i], i);
    if (typeof r === "string") return { ok: false, error: r };
    rows.push(r);
  }
  return { ok: true, rows };
}
