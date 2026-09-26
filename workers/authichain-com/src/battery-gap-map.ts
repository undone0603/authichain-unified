/**
 * Battery passport gap map — source of truth for the no-network self-serve
 * tool on /battery-passport (#gap-map).
 *
 * Pure functions only: no I/O, no fetch, no storage. The page's inline script
 * duplicates the constants and formulas below so it can run in the browser
 * without a network call; battery-gap-map.test.ts pins the behaviour.
 *
 * Truth rules:
 * - Only figures the user typed are ever shown as values.
 * - No identifier, passport ID or registration number is generated. Anything
 *   only the placing-on-market operator can supply is marked needs_operator.
 * - Item wording follows Regulation (EU) 2023/1542, Art. 77 and Annex XIII
 *   (public / interested persons / authorities layers). Not legal advice.
 */

export type Placing = "self" | "cell_maker" | "unknown";

export type GapStatus =
  "user_provided" | "needs_operator" | "not_public" | "not_art77";

export const GAP_STATUSES: readonly GapStatus[] = [
  "user_provided",
  "needs_operator",
  "not_public",
  "not_art77",
] as const;

export const GAP_MAP_DISCLAIMER =
  "Unofficial gap map from figures you typed. Not issued as a battery passport. No identifier here is live. Not legal advice. Confirm against Regulation (EU) 2023/1542 and counsel.";

/** Relative tolerance between stated Wh and nominal V × Ah. */
export const CONSISTENCY_TOLERANCE = 0.01;
/** Absorbs floating-point noise so e.g. 36.36 vs 36.0 counts as exactly 1%. */
const FLOAT_SLACK = 1e-9;
const MAX_MODEL_LEN = 120;

export interface PackInput {
  model: string;
  statedWh: number;
  ah: number;
  nominalV: number;
  cyclesLow?: number | null;
  cyclesHigh?: number | null;
  placing: Placing;
}

export interface PackScore {
  model: string;
  statedWh: number | null;
  ah: number | null;
  nominalV: number | null;
  cyclesLow: number | null;
  cyclesHigh: number | null;
  placing: Placing;
  /** round1(nominalV × ah), or null when either input is invalid. */
  vTimesAh: number | null;
  /** round2(statedWh / ah), or null when either input is invalid. */
  impliedV: number | null;
  /** Relative deviation |statedWh − vTimesAh| / vTimesAh, rounded to 4 dp. */
  deviation: number | null;
  /** True only when every figure is valid and deviation ≤ 1%. */
  consistent: boolean;
  valid: boolean;
  errors: string[];
}

export interface AnnexRow {
  id: string;
  /** Annex XIII layer the item sits in (or "Outside Art. 77"). */
  layer: string;
  item: string;
  status: GapStatus;
  /** The user's own figure, only for user_provided rows. */
  value?: string;
  note: string;
}

const roundTo = (x: number, dp: number): number => {
  const f = 10 ** dp;
  const r = Math.round((x + Math.sign(x) * Number.EPSILON) * f) / f;
  return Object.is(r, -0) ? 0 : r;
};
export const round1 = (x: number): number => roundTo(x, 1);
export const round2 = (x: number): number => roundTo(x, 2);

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const positive = (v: unknown): number | null => {
  const n = toNumber(v);
  return n !== null && n > 0 ? n : null;
};
const nonNegative = (v: unknown): number | null => {
  const n = toNumber(v);
  return n !== null && n >= 0 ? n : null;
};

export function normalizePlacing(p: unknown): Placing {
  return p === "self" || p === "cell_maker" ? p : "unknown";
}

function cleanModel(m: unknown): string {
  return typeof m === "string"
    ? m.replace(/\s+/g, " ").trim().slice(0, MAX_MODEL_LEN)
    : "";
}

export function scorePack(input: PackInput): PackScore {
  const errors: string[] = [];
  const src = (input ?? {}) as Partial<PackInput>;
  const model = cleanModel(src.model);
  const statedWh = positive(src.statedWh);
  const ah = positive(src.ah);
  const nominalV = positive(src.nominalV);
  let cyclesLow = nonNegative(src.cyclesLow);
  let cyclesHigh = nonNegative(src.cyclesHigh);

  if (!model) errors.push("Model is required.");
  if (statedWh === null)
    errors.push("Stated energy (Wh) must be a number above 0.");
  if (ah === null) errors.push("Capacity (Ah) must be a number above 0.");
  if (nominalV === null)
    errors.push("Nominal voltage (V) must be a number above 0.");
  if (toNumber(src.cyclesLow) !== null && cyclesLow === null)
    errors.push("Cycle range low must not be negative.");
  if (toNumber(src.cyclesHigh) !== null && cyclesHigh === null)
    errors.push("Cycle range high must not be negative.");
  if (cyclesLow !== null && cyclesHigh !== null && cyclesLow > cyclesHigh) {
    errors.push("Cycle range low is above high; ignored.");
    cyclesLow = null;
    cyclesHigh = null;
  }

  const vTimesAh =
    nominalV !== null && ah !== null ? round1(nominalV * ah) : null;
  const impliedV =
    statedWh !== null && ah !== null ? round2(statedWh / ah) : null;
  let deviation: number | null = null;
  let consistent = false;
  if (statedWh !== null && vTimesAh !== null && vTimesAh > 0) {
    const d = Math.abs(statedWh - vTimesAh) / vTimesAh;
    if (Number.isFinite(d)) {
      deviation = roundTo(d, 4);
      consistent = d <= CONSISTENCY_TOLERANCE + FLOAT_SLACK;
    }
  }

  return {
    model,
    statedWh,
    ah,
    nominalV,
    cyclesLow,
    cyclesHigh,
    placing: normalizePlacing(src.placing),
    vTimesAh,
    impliedV,
    deviation,
    consistent,
    valid: errors.length === 0 || errors.every(e => e.startsWith("Cycle")),
    errors,
  };
}

/** Who supplies operator-only items, worded for the placing choice. */
export function operatorNote(placing: Placing, what: string): string {
  switch (placing) {
    case "self":
      return `You place this battery on the EU market, so you supply ${what}.`;
    case "cell_maker":
      return `Your cell maker places this battery on the EU market, so request ${what} from them.`;
    default:
      return `Confirm who places this battery on the EU market first; that operator supplies ${what}.`;
  }
}

const PUBLIC = "Public (Annex XIII §1)";
const INTERESTED = "Interested persons (Annex XIII §2)";
const AUTHORITIES = "Authorities (Annex XIII §3)";
const LEGIT = "Legitimate interest (Annex XIII §4)";
const OUTSIDE = "Outside Art. 77";

export function annexXiiiRows(input: PackInput): AnnexRow[] {
  const s = scorePack(input);
  const p = s.placing;
  const rows: AnnexRow[] = [];
  const typed = (
    id: string,
    item: string,
    value: string | null,
    missing: string
  ) =>
    rows.push(
      value !== null
        ? {
            id,
            layer: PUBLIC,
            item,
            status: "user_provided",
            value,
            note: "Figure you typed. Not verified.",
          }
        : {
            id,
            layer: PUBLIC,
            item,
            status: "needs_operator",
            note: operatorNote(p, missing),
          }
    );
  const op = (id: string, layer: string, item: string, what: string) =>
    rows.push({
      id,
      layer,
      item,
      status: "needs_operator",
      note: operatorNote(p, what),
    });

  typed(
    "model",
    "Battery model",
    s.model || null,
    "the battery model designation"
  );
  typed(
    "energy",
    "Stated energy (Wh)",
    s.statedWh !== null ? `${s.statedWh} Wh` : null,
    "the stated energy"
  );
  typed(
    "capacity",
    "Rated capacity (Ah)",
    s.ah !== null ? `${s.ah} Ah` : null,
    "the rated capacity"
  );
  typed(
    "voltage",
    "Nominal voltage (V)",
    s.nominalV !== null ? `${s.nominalV} V` : null,
    "the nominal, minimum and maximum voltage"
  );
  const cycles =
    s.cyclesLow !== null && s.cyclesHigh !== null
      ? `${s.cyclesLow}–${s.cyclesHigh} cycles`
      : s.cyclesLow !== null
        ? `≥ ${s.cyclesLow} cycles`
        : s.cyclesHigh !== null
          ? `≤ ${s.cyclesHigh} cycles`
          : null;
  typed(
    "cycles",
    "Expected lifetime in cycles",
    cycles,
    "the expected lifetime in cycles and the test basis for it"
  );

  op(
    "operator",
    PUBLIC,
    "Operator identity, registered trade name and contact",
    "its name, registered trade name, postal and web contact"
  );
  op(
    "unique_id",
    PUBLIC,
    "Unique battery identifier and passport identifier",
    "the unique battery identifier and passport identifier (none is generated here)"
  );
  op(
    "manufacture",
    PUBLIC,
    "Manufacturer, place and date of manufacture",
    "the manufacturer identity and place/date of manufacture"
  );
  op(
    "category",
    PUBLIC,
    "Battery category, chemistry and weight",
    "the battery category, chemistry and weight"
  );
  op(
    "hazardous",
    PUBLIC,
    "Hazardous substances and critical raw materials",
    "the hazardous substance and critical raw material information"
  );
  op(
    "carbon",
    PUBLIC,
    "Carbon footprint (where required for the category)",
    "the carbon footprint declaration and performance class"
  );
  op(
    "recycled",
    PUBLIC,
    "Recycled and renewable content",
    "the recycled and renewable content shares"
  );
  op(
    "performance",
    PUBLIC,
    "Power capability, internal resistance, round-trip efficiency, temperature range",
    "the Annex VII performance and durability figures"
  );
  op(
    "conformity",
    PUBLIC,
    "EU declaration of conformity",
    "the EU declaration of conformity"
  );
  op(
    "due_diligence",
    PUBLIC,
    "Supply-chain due diligence report",
    "the due diligence policy and report"
  );
  op(
    "eol",
    PUBLIC,
    "Separate collection, prevention and end-of-life information",
    "the collection and end-of-life information"
  );

  const restricted = (id: string, layer: string, item: string, note: string) =>
    rows.push({ id, layer, item, status: "not_public", note });
  restricted(
    "composition",
    INTERESTED,
    "Detailed composition (materials in cathode, anode, electrolyte)",
    "Restricted to persons with a legitimate interest and the Commission. Not shown publicly."
  );
  restricted(
    "dismantling",
    INTERESTED,
    "Dismantling information, part numbers and safety measures",
    "Restricted to repairers, remanufacturers and recyclers. Not shown publicly."
  );
  restricted(
    "test_reports",
    AUTHORITIES,
    "Test reports proving compliance",
    "Restricted to notified bodies, market surveillance authorities and the Commission."
  );
  restricted(
    "state_of_health",
    LEGIT,
    "State of health and dynamic usage data",
    "Restricted to persons with a legitimate interest; updated over the battery's life."
  );

  const outside = (id: string, item: string, note: string) =>
    rows.push({ id, layer: OUTSIDE, item, status: "not_art77", note });
  outside(
    "commercial",
    "Price, warranty and commercial terms",
    "Not part of the Art. 77 battery passport."
  );
  outside(
    "marketing",
    "Marketing claims and brand copy",
    "Not part of the Art. 77 battery passport; keep claims consistent with the passport data."
  );
  outside(
    "customers",
    "Customer and distributor lists",
    "Not part of the Art. 77 battery passport."
  );

  return rows;
}
