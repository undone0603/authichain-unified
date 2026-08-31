/**
 * GS1 Digital Link URI Syntax 1.7.0 — subset used on-pack.
 */

export const GS1_AI = {
  GTIN: "01",
  PROD_DATE: "11",
  EXPIRY: "17",
  VARIANT: "22",
  LOT: "10",
  SERIAL: "21",
} as const;

export type Gs1Fields = {
  gtin?: string;
  lot?: string;
  serial?: string;
  expiry?: string;
  prodDate?: string;
  variant?: string;
  certId?: string;
  rawPath: string;
};

const PATH_AI_ORDER = ["01", "10", "21", "22"] as const;
const QUERY_AI: Record<string, keyof Omit<Gs1Fields, "rawPath" | "certId">> = {
  "01": "gtin",
  "10": "lot",
  "21": "serial",
  "17": "expiry",
  "11": "prodDate",
  "22": "variant",
};

export function normalizeGtin(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  return digits.padStart(14, "0");
}

export function isValidYyMmDd(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

export function parseGs1Path(pathname: string, search: string): Gs1Fields {
  const rawPath = pathname.replace(/\/+$/, "") || "/";
  const parts = rawPath.split("/").filter(Boolean);
  const fields: Gs1Fields = { rawPath };
  if (parts[0] === "cert" || parts[0] === "p" || parts[0] === "passport") {
    if (parts[1]) fields.certId = decodeURIComponent(parts[1]);
    applyQuery(fields, search);
    return fields;
  }
  for (let i = 0; i < parts.length - 1; i += 2) {
    const ai = parts[i];
    const value = decodeURIComponent(parts[i + 1] ?? "");
    if (!value) continue;
    if (ai === "01") fields.gtin = normalizeGtin(value) ?? value;
    else if (ai === "10") fields.lot = value;
    else if (ai === "21") fields.serial = value;
    else if (ai === "22") fields.variant = value;
    else if (ai === "17" && isValidYyMmDd(value)) fields.expiry = value;
    else if (ai === "11" && isValidYyMmDd(value)) fields.prodDate = value;
  }
  applyQuery(fields, search);
  return fields;
}

function applyQuery(fields: Gs1Fields, search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of params.entries()) {
    const mapped = QUERY_AI[key];
    if (!mapped || !value) continue;
    if (mapped === "gtin") fields.gtin = normalizeGtin(value) ?? value;
    else if ((mapped === "expiry" || mapped === "prodDate") && !isValidYyMmDd(value)) continue;
    else (fields as Record<string, string>)[mapped] = value;
  }
}

export function toDigitalLink(base: string, fields: Gs1Fields): string {
  const origin = base.replace(/\/+$/, "");
  if (fields.certId && !fields.gtin) return `${origin}/cert/${encodeURIComponent(fields.certId)}`;
  if (!fields.gtin) return origin;
  let path = `/01/${fields.gtin}`;
  if (fields.lot) path += `/10/${encodeURIComponent(fields.lot)}`;
  if (fields.serial) path += `/21/${encodeURIComponent(fields.serial)}`;
  const q = new URLSearchParams();
  if (fields.expiry) q.set("17", fields.expiry);
  if (fields.prodDate) q.set("11", fields.prodDate);
  if (fields.variant) q.set("22", fields.variant);
  const qs = q.toString();
  return `${origin}${path}${qs ? `?${qs}` : ""}`;
}

export function lookupKey(fields: Gs1Fields): string {
  if (fields.serial && fields.gtin) return `gtin:${fields.gtin}:ser:${fields.serial}`;
  if (fields.certId) return `cert:${fields.certId.toLowerCase()}`;
  if (fields.gtin && fields.lot) return `gtin:${fields.gtin}:lot:${fields.lot}`;
  if (fields.gtin) return `gtin:${fields.gtin}`;
  return `path:${fields.rawPath}`;
}

export function hasResolvableId(fields: Gs1Fields): boolean {
  return Boolean(fields.gtin || fields.certId);
}

export function isResolverPath(pathname: string): boolean {
  const head = pathname.split("/").filter(Boolean)[0];
  return (
    head === "01" ||
    head === "cert" ||
    head === "p" ||
    head === "passport" ||
    PATH_AI_ORDER.includes(head as (typeof PATH_AI_ORDER)[number])
  );
}
