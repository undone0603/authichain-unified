/**
 * Battery chemistry profiles — which chemistry-dependent EU Battery
 * Regulation obligations reach a battery, for the gap report and the
 * /battery-passport/non-lithium explainer.
 *
 * Pure data and functions: no I/O.
 *
 * Truth rules:
 * - Only three obligations depend on chemistry here, each tied to the article
 *   that sets its scope: supply-chain due diligence (Art. 48, Annex X point 1:
 *   cobalt, natural graphite, lithium, nickel), recycled content (Art. 8:
 *   cobalt, lead, lithium, nickel in active materials) and the carbon footprint
 *   declaration (Art. 7, phased by category; batteries with exclusively
 *   external storage, i.e. flow batteries, come last).
 * - The battery passport itself (Art. 77, from 18 Feb 2027 for LMT, EV and
 *   industrial batteries over 2 kWh) applies to every chemistry.
 * - Where the trigger depends on the exact composition (e.g. sodium-ion
 *   cathodes), the status is "check", never a guess.
 * - Dates are dated facts, not advice. Due diligence moved to 18 Aug 2027 by
 *   Regulation (EU) 2025/1561. Not legal advice.
 */

export type ChemistryId =
  | "lithium_ion"
  | "lead_acid"
  | "nickel_zinc"
  | "sodium_ion"
  | "zinc"
  | "iron_air"
  | "iron_flow"
  | "vanadium_flow";

export type Applicability = "applies" | "phased" | "not_triggered" | "check";

export type ChemistryRowId = "due_diligence" | "recycled" | "carbon";

export interface ChemistryProfile {
  id: ChemistryId;
  label: string;
  examples: string;
  /** Annex X point 1 raw materials present: true, false, or depends on cathode. */
  annexXMaterials: boolean | "depends";
  /** Art. 8 metals (cobalt, lead, lithium, nickel) in active materials. */
  art8Metals: boolean | "depends";
  /** Energy stored in external tanks (flow batteries). */
  externalStorage: boolean;
}

export interface ChemistryRow {
  id: ChemistryRowId;
  item: string;
  status: Applicability;
  note: string;
}

export const DUE_DILIGENCE_FROM = "2027-08-18";
export const RECYCLED_DOCS_FROM = "2028-08-18";
export const RECYCLED_SHARES_FROM = "2031-08-18";
export const CARBON_INDUSTRIAL_FROM = "2026-02-18";
export const CARBON_EXTERNAL_FROM = "2030-08-18";

export const CHEMISTRY_PROFILES: Record<ChemistryId, ChemistryProfile> = {
  lithium_ion: {
    id: "lithium_ion",
    label: "Lithium-ion (LFP, NMC, LMFP)",
    examples: "EV, LMT and stationary lithium packs",
    annexXMaterials: true,
    art8Metals: true,
    externalStorage: false,
  },
  lead_acid: {
    id: "lead_acid",
    label: "Lead-acid",
    examples: "Motive power, UPS and deep-cycle lead batteries",
    annexXMaterials: false,
    art8Metals: true,
    externalStorage: false,
  },
  nickel_zinc: {
    id: "nickel_zinc",
    label: "Nickel-zinc",
    examples: "Nickel-zinc UPS and backup systems",
    annexXMaterials: true,
    art8Metals: true,
    externalStorage: false,
  },
  sodium_ion: {
    id: "sodium_ion",
    label: "Sodium-ion",
    examples: "Sodium-ion stationary and LMT packs",
    annexXMaterials: "depends",
    art8Metals: "depends",
    externalStorage: false,
  },
  zinc: {
    id: "zinc",
    label: "Zinc-based (zinc-air, zinc-halide)",
    examples: "Zinc stationary storage modules",
    annexXMaterials: false,
    art8Metals: false,
    externalStorage: false,
  },
  iron_air: {
    id: "iron_air",
    label: "Iron-air",
    examples: "Multi-day iron-air storage systems",
    annexXMaterials: false,
    art8Metals: false,
    externalStorage: false,
  },
  iron_flow: {
    id: "iron_flow",
    label: "Iron flow",
    examples: "Iron-salt flow batteries with external electrolyte tanks",
    annexXMaterials: false,
    art8Metals: false,
    externalStorage: true,
  },
  vanadium_flow: {
    id: "vanadium_flow",
    label: "Vanadium flow",
    examples: "Vanadium redox flow batteries",
    annexXMaterials: false,
    art8Metals: false,
    externalStorage: true,
  },
};

export const CHEMISTRY_IDS = Object.keys(CHEMISTRY_PROFILES) as ChemistryId[];

export function isChemistryId(x: unknown): x is ChemistryId {
  return typeof x === "string" && x in CHEMISTRY_PROFILES;
}

function dueDiligence(p: ChemistryProfile): ChemistryRow {
  const item = "Supply-chain due diligence (Art. 48)";
  if (p.annexXMaterials === "depends") {
    return {
      id: "due_diligence",
      item,
      status: "check",
      note: "Depends on the cathode. Art. 48 covers cobalt, natural graphite, lithium and nickel (Annex X point 1); check the bill of materials.",
    };
  }
  if (p.annexXMaterials) {
    return {
      id: "due_diligence",
      item,
      status: "phased",
      note: `Applies from ${DUE_DILIGENCE_FROM} (postponed by Regulation (EU) 2025/1561).`,
    };
  }
  return {
    id: "due_diligence",
    item,
    status: "not_triggered",
    note: "No cobalt, natural graphite, lithium or nickel, the raw materials Art. 48 covers (Annex X point 1). Confirm the bill of materials.",
  };
}

function recycled(p: ChemistryProfile): ChemistryRow {
  const item = "Recycled content (Art. 8)";
  if (p.externalStorage) {
    return {
      id: "recycled",
      item,
      status: "not_triggered",
      note: "Art. 8 excludes industrial batteries with exclusively external storage.",
    };
  }
  if (p.art8Metals === "depends") {
    return {
      id: "recycled",
      item,
      status: "check",
      note: "Depends on the cathode. Art. 8 covers cobalt, lead, lithium and nickel in active materials.",
    };
  }
  if (p.art8Metals) {
    return {
      id: "recycled",
      item,
      status: "phased",
      note: `Documentation from ${RECYCLED_DOCS_FROM}; minimum shares from ${RECYCLED_SHARES_FROM}.`,
    };
  }
  return {
    id: "recycled",
    item,
    status: "not_triggered",
    note: "No cobalt, lead, lithium or nickel in active materials, the metals Art. 8 covers.",
  };
}

function carbon(p: ChemistryProfile): ChemistryRow {
  return {
    id: "carbon",
    item: "Carbon footprint declaration (Art. 7)",
    status: "phased",
    note: p.externalStorage
      ? `Exclusively external storage comes last: ${CARBON_EXTERNAL_FROM} or 12 months after the delegated act, whichever is later.`
      : `Rechargeable industrial over 2 kWh: ${CARBON_INDUSTRIAL_FROM} or 12 months after the delegated act, whichever is later.`,
  };
}

/** The three chemistry-dependent rows for one chemistry. */
export function chemistryRows(id: ChemistryId): ChemistryRow[] {
  const p = CHEMISTRY_PROFILES[id];
  return [dueDiligence(p), recycled(p), carbon(p)];
}

export const APPLICABILITY_LABEL: Record<Applicability, string> = {
  applies: "Applies",
  phased: "Applies later",
  not_triggered: "Not triggered",
  check: "Check composition",
};
