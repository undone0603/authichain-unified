/**
 * AuthiChain DPP Importer File (MVP-1 slice).
 *
 * After paid DPP activation, the buyer should leave with a present-vs-missing
 * field list and data owners — not a certificate, not a passport, not a QR.
 * This module is pure: no I/O. Activation persists the JSON in funnel metadata
 * and returns it on the activate response.
 *
 * Field catalogue follows Regulation (EU) 2023/1542 Art. 77 / Annex XIII
 * public-layer wording already used by workers/authichain-com battery-gap-map.
 * Not legal advice.
 */

export const DPP_IMPORTER_FILE_SCHEMA = "AuthiChain DPP Importer File v0";

export const DPP_IMPORTER_FILE_DISCLAIMER =
  "Self-serve field list from answers you typed at activation. Not a battery passport, not a certificate, not legal advice, and not EU registry filing. Confirm against Regulation (EU) 2023/1542 and counsel. No unique identifier or Living QR is issued in this file.";

export type ImporterFieldStatus = "present" | "missing" | "restricted" | "out_of_scope";

export type ImporterFieldOwner =
  | "buyer"
  | "placing_on_market_operator"
  | "supplier"
  | "not_in_this_file";

export type ImporterField = {
  id: string;
  layer: string;
  item: string;
  status: ImporterFieldStatus;
  owner: ImporterFieldOwner;
  note: string;
  value?: string;
};

/** Optional pack figures from the free /battery-passport gap map (or typed at activation). */
export type ImporterPackFigures = {
  model?: string | null;
  statedWh?: number | null;
  ah?: number | null;
  nominalV?: number | null;
  cyclesLow?: number | null;
  cyclesHigh?: number | null;
};

export type DppImporterFile = {
  schema: typeof DPP_IMPORTER_FILE_SCHEMA;
  disclaimer: string;
  product: {
    categories: string;
    markets: string;
    labeling: string;
    pack?: {
      model: string | null;
      statedWh: number | null;
      ah: number | null;
      nominalV: number | null;
      cyclesLow: number | null;
      cyclesHigh: number | null;
    };
  };
  summary: {
    present: number;
    missing: number;
    restricted: number;
    out_of_scope: number;
  };
  fields: ImporterField[];
  qr: {
    status: "not_issued";
    note: string;
  };
  generated_at: string;
};

export type BuildDppImporterFileInput = {
  categories: string;
  markets: string;
  labeling: string;
  /** Typed Wh/Ah/V (and optional model/cycles) from gap map or activation. */
  pack?: ImporterPackFigures | null;
  /** ISO timestamp; defaults to now for production calls. */
  generatedAt?: string;
};

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function optionalFinite(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : null;
}

/** Normalize loose activate/API pack payload into ImporterPackFigures. */
export function parseImporterPackFigures(
  raw: unknown
): ImporterPackFigures | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const model =
    typeof o.model === "string"
      ? o.model.trim()
      : typeof o.pack_model === "string"
        ? o.pack_model.trim()
        : "";
  const statedWh = optionalFinite(o.statedWh ?? o.stated_wh ?? o.wh);
  const ah = optionalFinite(o.ah ?? o.rated_ah);
  const nominalV = optionalFinite(o.nominalV ?? o.nominal_v ?? o.volts);
  const cyclesLow = optionalFinite(o.cyclesLow ?? o.cycles_low);
  const cyclesHigh = optionalFinite(o.cyclesHigh ?? o.cycles_high);
  if (
    !model &&
    statedWh === null &&
    ah === null &&
    nominalV === null &&
    cyclesLow === null &&
    cyclesHigh === null
  ) {
    return null;
  }
  return {
    model: model || null,
    statedWh,
    ah,
    nominalV,
    cyclesLow,
    cyclesHigh,
  };
}

const PUBLIC = "Public (Art. 77 / Annex XIII)";
const INTERESTED = "Persons with a legitimate interest";
const AUTHORITIES = "Notified bodies / market surveillance / Commission";
const OUTSIDE = "Outside Art. 77";

function present(
  id: string,
  item: string,
  value: string,
  note: string
): ImporterField {
  return {
    id,
    layer: PUBLIC,
    item,
    status: "present",
    owner: "buyer",
    value,
    note,
  };
}

function missing(
  id: string,
  item: string,
  owner: ImporterFieldOwner,
  note: string
): ImporterField {
  return {
    id,
    layer: PUBLIC,
    item,
    status: "missing",
    owner,
    note,
  };
}

function restricted(
  id: string,
  layer: string,
  item: string,
  note: string
): ImporterField {
  return {
    id,
    layer,
    item,
    status: "restricted",
    owner: "not_in_this_file",
    note,
  };
}

function outOfScope(id: string, item: string, note: string): ImporterField {
  return {
    id,
    layer: OUTSIDE,
    item,
    status: "out_of_scope",
    owner: "not_in_this_file",
    note,
  };
}

/**
 * Build the importer field file from activation intake.
 * Marks buyer-supplied activation answers present; Annex XIII public items
 * the buyer did not supply stay missing with an explicit owner.
 */
export function buildDppImporterFile(
  input: BuildDppImporterFileInput
): DppImporterFile {
  const categories = input.categories.trim();
  const markets = input.markets.trim();
  const labeling = input.labeling.trim();
  if (!categories || !markets || !labeling) {
    throw new Error("categories, markets, and labeling are required");
  }

  const pack = parseImporterPackFigures(input.pack ?? null);
  const typedNote =
    "Figure you typed (gap map or activation). Not verified against a test report.";

  const energyFields: ImporterField[] = [];
  if (pack?.model) {
    energyFields.push(
      present("model", "Battery model", pack.model, typedNote)
    );
  }
  if (finitePositive(pack?.statedWh ?? null)) {
    energyFields.push(
      present("energy", "Stated energy (Wh)", `${pack!.statedWh} Wh`, typedNote)
    );
  } else {
    energyFields.push(
      missing(
        "energy",
        "Stated energy (Wh)",
        "placing_on_market_operator",
        "Type Wh on /battery-passport or on activation; otherwise the operator must supply it."
      )
    );
  }
  if (finitePositive(pack?.ah ?? null)) {
    energyFields.push(
      present("capacity", "Rated capacity (Ah)", `${pack!.ah} Ah`, typedNote)
    );
  } else {
    energyFields.push(
      missing(
        "capacity",
        "Rated capacity (Ah)",
        "placing_on_market_operator",
        "Type Ah on /battery-passport or on activation; otherwise the operator must supply it."
      )
    );
  }
  if (finitePositive(pack?.nominalV ?? null)) {
    energyFields.push(
      present(
        "voltage",
        "Nominal voltage (V)",
        `${pack!.nominalV} V`,
        typedNote
      )
    );
  } else {
    energyFields.push(
      missing(
        "voltage",
        "Nominal voltage (V)",
        "placing_on_market_operator",
        "Type nominal V on /battery-passport or on activation; otherwise the operator must supply it."
      )
    );
  }
  const cyclesLow = pack?.cyclesLow ?? null;
  const cyclesHigh = pack?.cyclesHigh ?? null;
  if (cyclesLow !== null || cyclesHigh !== null) {
    const cycles =
      cyclesLow !== null && cyclesHigh !== null
        ? `${cyclesLow}–${cyclesHigh} cycles`
        : cyclesLow !== null
          ? `≥ ${cyclesLow} cycles`
          : `≤ ${cyclesHigh} cycles`;
    energyFields.push(
      present("cycles", "Expected lifetime in cycles", cycles, typedNote)
    );
  } else {
    energyFields.push(
      missing(
        "cycles",
        "Expected lifetime in cycles",
        "supplier",
        "Test-basis lifetime figures from the manufacturer or test lab."
      )
    );
  }

  const fields: ImporterField[] = [
    present(
      "activation_categories",
      "Product categories (activation intake)",
      categories,
      "From your activation form. Not verified against a catalogue."
    ),
    present(
      "activation_markets",
      "EU markets in scope (activation intake)",
      markets,
      "From your activation form. Confirms where you place or sell."
    ),
    present(
      "activation_labeling",
      "Current labeling / data state (activation intake)",
      labeling,
      "From your activation form. Describes what you already have on pack or in files."
    ),
    missing(
      "operator",
      "Operator identity, registered trade name and contact",
      "placing_on_market_operator",
      "The placing-on-market operator must supply name, registered trade name, postal and web contact."
    ),
    missing(
      "unique_id",
      "Unique battery identifier and passport identifier",
      "placing_on_market_operator",
      "No identifier is generated here. The operator issues the unique battery and passport IDs."
    ),
    missing(
      "manufacture",
      "Manufacturer, place and date of manufacture",
      "supplier",
      "Usually supplied by the cell or pack manufacturer."
    ),
    missing(
      "category",
      "Battery category, chemistry and weight",
      "placing_on_market_operator",
      "Map activation categories to the regulated battery category, chemistry and weight."
    ),
    ...energyFields,
    missing(
      "hazardous",
      "Hazardous substances and critical raw materials",
      "supplier",
      "Supplier and due-diligence data; not invented here."
    ),
    missing(
      "carbon",
      "Carbon footprint (where required for the category)",
      "placing_on_market_operator",
      "Required only for categories covered by the carbon-footprint rules."
    ),
    missing(
      "recycled",
      "Recycled and renewable content",
      "supplier",
      "Supplier declarations of recycled and renewable content shares."
    ),
    missing(
      "performance",
      "Power capability, internal resistance, round-trip efficiency, temperature range",
      "supplier",
      "Annex VII performance and durability figures."
    ),
    missing(
      "conformity",
      "EU declaration of conformity",
      "placing_on_market_operator",
      "Operator-held conformity declaration."
    ),
    missing(
      "due_diligence",
      "Supply-chain due diligence report",
      "placing_on_market_operator",
      "Operator due diligence policy and report."
    ),
    missing(
      "eol",
      "Separate collection, prevention and end-of-life information",
      "placing_on_market_operator",
      "Collection and end-of-life information for the pack."
    ),
    restricted(
      "composition",
      INTERESTED,
      "Detailed composition (materials in cathode, anode, electrolyte)",
      "Restricted to persons with a legitimate interest and the Commission. Not shown in this public field file."
    ),
    restricted(
      "dismantling",
      INTERESTED,
      "Dismantling information, part numbers and safety measures",
      "Restricted to repairers, remanufacturers and recyclers."
    ),
    restricted(
      "test_reports",
      AUTHORITIES,
      "Test reports proving compliance",
      "Restricted to notified bodies, market surveillance authorities and the Commission."
    ),
    restricted(
      "state_of_health",
      INTERESTED,
      "State of health and dynamic usage data",
      "Restricted; updated over the battery's life. Not a static activation artifact."
    ),
    outOfScope(
      "commercial",
      "Price, warranty and commercial terms",
      "Not part of the Art. 77 battery passport."
    ),
    outOfScope(
      "qr_living",
      "Living QR / QRON presentation",
      "QRON generation and binding is a later product stage. This file does not mint a QR."
    ),
  ];

  const summary = {
    present: fields.filter((f) => f.status === "present").length,
    missing: fields.filter((f) => f.status === "missing").length,
    restricted: fields.filter((f) => f.status === "restricted").length,
    out_of_scope: fields.filter((f) => f.status === "out_of_scope").length,
  };

  return {
    schema: DPP_IMPORTER_FILE_SCHEMA,
    disclaimer: DPP_IMPORTER_FILE_DISCLAIMER,
    product: {
      categories,
      markets,
      labeling,
      ...(pack
        ? {
            pack: {
              model: pack.model ?? null,
              statedWh: pack.statedWh ?? null,
              ah: pack.ah ?? null,
              nominalV: pack.nominalV ?? null,
              cyclesLow: pack.cyclesLow ?? null,
              cyclesHigh: pack.cyclesHigh ?? null,
            },
          }
        : {}),
    },
    summary,
    fields,
    qr: {
      status: "not_issued",
      note: "No Living QR is issued in this file. QRON binding is MVP-2.",
    },
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}
