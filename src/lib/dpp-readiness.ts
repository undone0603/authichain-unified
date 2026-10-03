/**
 * Free EU Digital Product Passport readiness check. Pure: no I/O.
 * Shared by the /dpp-check page and the free `dpp_readiness_check` MCP tool.
 *
 * Truth rules: only the battery passport has a fixed legal date. Everything
 * else is "expected" (ESPR Working Plan 2025–2030 targets, not law until a
 * delegated act is adopted). Not legal advice.
 */

export type DppCategory =
  | "battery_passport"
  | "battery_other"
  | "textiles"
  | "iron_steel"
  | "aluminium"
  | "tyres"
  | "furniture"
  | "mattresses"
  | "electronics"
  | "toys"
  | "construction"
  | "detergents"
  | "other";

export type ObligationStatus = "law" | "expected" | "none";

export interface CategoryInfo {
  id: DppCategory;
  label: string;
  status: ObligationStatus;
  /** ISO date, only when status is "law". */
  date?: string;
  when: string;
  source: string;
}

export const DPP_CATEGORIES: readonly CategoryInfo[] = [
  {
    id: "battery_passport",
    label: "EV, LMT (e-bike, e-scooter) or industrial battery over 2 kWh",
    status: "law",
    date: "2027-02-18",
    when: "Battery passport required from 18 February 2027.",
    source: "Regulation (EU) 2023/1542, Art. 77",
  },
  {
    id: "battery_other",
    label: "Other battery (portable, SLI, industrial up to 2 kWh)",
    status: "expected",
    when: "No battery passport, but QR-code labelling and other Battery Regulation duties are phasing in.",
    source: "Regulation (EU) 2023/1542",
  },
  {
    id: "textiles",
    label: "Textiles, apparel or footwear",
    status: "expected",
    when: "Delegated act targeted around 2027; passport duties expected about 18 months after adoption.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "iron_steel",
    label: "Iron and steel",
    status: "expected",
    when: "First ESPR delegated act in the working plan, targeted around 2026; duties apply after a transition period.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "aluminium",
    label: "Aluminium",
    status: "expected",
    when: "Delegated act targeted around 2027.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "tyres",
    label: "Tyres",
    status: "expected",
    when: "Delegated act targeted around 2027.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "furniture",
    label: "Furniture",
    status: "expected",
    when: "Delegated act targeted around 2028.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "mattresses",
    label: "Mattresses",
    status: "expected",
    when: "Delegated act targeted around 2029.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "electronics",
    label: "Electronics and ICT",
    status: "expected",
    when: "Covered by horizontal ESPR measures (repairability, recycled content) in the working plan; no passport date set yet.",
    source: "ESPR (EU) 2024/1781, Working Plan 2025–2030",
  },
  {
    id: "toys",
    label: "Toys",
    status: "expected",
    when: "The new EU Toy Safety Regulation requires a digital product passport after its transition period.",
    source: "EU Toy Safety Regulation (replacing Directive 2009/48/EC)",
  },
  {
    id: "construction",
    label: "Construction products",
    status: "expected",
    when: "Digital product passport phased in by product family under the revised Construction Products Regulation.",
    source: "Regulation (EU) 2024/3110",
  },
  {
    id: "detergents",
    label: "Detergents and cleaning products",
    status: "expected",
    when: "Revised Detergents Regulation adds a digital label and product passport.",
    source: "EU Detergents Regulation revision",
  },
  {
    id: "other",
    label: "Something else",
    status: "none",
    when: "No EU digital product passport scheduled for this category yet.",
    source: "ESPR (EU) 2024/1781",
  },
] as const;

export interface ReadinessQuestion {
  id: QuestionId;
  weight: number;
  question: string;
  gap: string;
}

export type QuestionId =
  | "unique_id"
  | "supplier_data"
  | "footprint"
  | "data_host"
  | "market_role"
  | "data_owner";

export const DPP_QUESTIONS: readonly ReadinessQuestion[] = [
  {
    id: "unique_id",
    weight: 20,
    question:
      "Each product (or model or batch) has a unique identifier, such as a GS1 GTIN with serial.",
    gap: "Assign a unique product identifier (GS1 GTIN plus serial or batch) for every product the passport will cover.",
  },
  {
    id: "supplier_data",
    weight: 20,
    question: "You can get material and substance data from your suppliers.",
    gap: "Ask suppliers for material composition and substances of concern in a structured format.",
  },
  {
    id: "market_role",
    weight: 15,
    question:
      "You know who places the product on the EU market (you, an importer or an EU representative).",
    gap: "Name the economic operator responsible for the passport. Obligations sit with whoever places the product on the EU market.",
  },
  {
    id: "footprint",
    weight: 15,
    question:
      "You have carbon or environmental footprint data for the product.",
    gap: "Start a carbon or environmental footprint record for the product using the method your category's rules will reference.",
  },
  {
    id: "data_host",
    weight: 15,
    question:
      "You have a public web location where product data could be published behind a QR code.",
    gap: "Set up a stable public URL per product that a QR code can resolve to, with access control for restricted data.",
  },
  {
    id: "data_owner",
    weight: 15,
    question: "A named person owns product compliance data.",
    gap: "Name one owner for passport data so updates and supplier requests have a single point of contact.",
  },
] as const;

export interface DppReadinessInput {
  category: DppCategory;
  sellsInEu: boolean;
  answers: Partial<Record<QuestionId, boolean>>;
}

export type ReadinessBand = "not_started" | "partly_ready" | "mostly_ready";

export interface DppReadinessResult {
  score: number;
  band: ReadinessBand;
  bandLabel: string;
  category: CategoryInfo;
  inScope: boolean;
  daysUntilDeadline: number | null;
  gaps: string[];
  nextStep: string;
  disclaimer: string;
}

export const DPP_READINESS_DISCLAIMER =
  "Self-assessment from your own answers. Not legal advice. Dates marked expected are EU Commission targets, not adopted law.";

const BAND_LABELS: Record<ReadinessBand, string> = {
  not_started: "Not started",
  partly_ready: "Partly ready",
  mostly_ready: "Mostly ready",
};

export function categoryById(id: string): CategoryInfo | undefined {
  return DPP_CATEGORIES.find(c => c.id === id);
}

export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const end = Date.parse(`${isoDate}T00:00:00Z`);
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

export function scoreDppReadiness(
  input: DppReadinessInput,
  opts: {
    now?: Date;
    auditUrl?: string;
    auditPrice?: number;
    /** false while paid plans are on hold: the next step names no audit or price. */
    offerAudit?: boolean;
  } = {}
): DppReadinessResult {
  const category = categoryById(input.category) ?? categoryById("other")!;
  let score = 0;
  const gaps: string[] = [];
  for (const q of DPP_QUESTIONS) {
    if (input.answers[q.id] === true) score += q.weight;
    else gaps.push(q.gap);
  }
  const band: ReadinessBand =
    score >= 75 ? "mostly_ready" : score >= 40 ? "partly_ready" : "not_started";
  const inScope = input.sellsInEu && category.status !== "none";
  const days =
    inScope && category.status === "law" && category.date
      ? daysUntil(category.date, opts.now)
      : null;

  const price = opts.auditPrice ?? 299;
  const audit = opts.auditUrl ? ` (${opts.auditUrl})` : "";
  let nextStep: string;
  if (!input.sellsInEu) {
    nextStep =
      "No EU passport duty while you do not sell in the EU. If an EU buyer or importer asks for passport data, rerun this check.";
  } else if (category.status === "none") {
    nextStep =
      "No passport is scheduled for this category yet. Keep the identifier and supplier-data basics in place so you can move fast when one is.";
  } else if (opts.offerAudit === false) {
    nextStep =
      days !== null
        ? `${days} days left. Close the gaps above, starting with the data your suppliers must provide.`
        : "Obligations are expected, not yet law. Close the gaps above before your importers start asking.";
  } else if (days !== null) {
    nextStep = `${days} days left. The $${price} EU DPP Readiness audit turns these gaps into a written plan for your product line${audit}.`;
  } else {
    nextStep = `Obligations are expected, not yet law. The $${price} EU DPP Readiness audit maps your gaps against the draft rules before your importers start asking${audit}.`;
  }

  return {
    score,
    band,
    bandLabel: BAND_LABELS[band],
    category,
    inScope,
    daysUntilDeadline: days,
    gaps,
    nextStep,
    disclaimer: DPP_READINESS_DISCLAIMER,
  };
}

const TRUE_VALUES = new Set(["yes", "true", "1", "on"]);

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return typeof v === "string" && TRUE_VALUES.has(v.trim().toLowerCase());
}

/**
 * Reads a form submission or MCP arguments. Returns null when no category was
 * chosen, so the page can show the blank form.
 */
export function parseDppReadinessInput(
  get: (key: string) => unknown
): DppReadinessInput | null {
  const raw = get("category");
  if (typeof raw !== "string" || !categoryById(raw)) return null;
  const answers: Partial<Record<QuestionId, boolean>> = {};
  for (const q of DPP_QUESTIONS) answers[q.id] = truthy(get(q.id));
  const eu = get("sells_in_eu");
  return {
    category: raw as DppCategory,
    sellsInEu: eu === undefined || eu === null || eu === "" ? true : truthy(eu),
    answers,
  };
}
