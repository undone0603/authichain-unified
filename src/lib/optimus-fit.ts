/**
 * Optimus fit on the existing DPP kernel.
 *
 * One identity and evidence shape for a robot, a battery, or a supplier lot.
 * Regulation (EU) 2023/1542 Article 77 is evaluated only for a battery, and
 * only from figures the operator supplied. Unknown class, unknown capacity,
 * or an unrecorded EU placing is not a duty. Commercial fields and restricted
 * evidence stay off the public record.
 *
 * This is not a Tesla passport and not legal advice.
 */

export const ART77_CITATION = "Regulation (EU) 2023/1542, Art. 77";
export const ART77_DATE = "2027-02-18";
/** Industrial batteries are inside Article 77 only above this capacity, in kWh. */
export const INDUSTRIAL_ART77_KWH = 2;

export const OPTIMUS_DOES_NOT_CLAIM =
  "This record is not a Tesla Optimus passport, not a filed EU battery passport, and not a statement that any Optimus unit must carry one. Article 77 is recorded only when the operator supplied a battery class, the capacity rule for that class, and an EU placing or putting into service.";

export type OptimusSubjectKind = "robot" | "battery" | "supplier_lot";

export type BatteryClass =
  "lmt" | "ev" | "industrial" | "portable" | "sli" | "unknown";

const SUPPORTED_BATTERY_CLASSES: ReadonlySet<string> = new Set([
  "lmt",
  "ev",
  "industrial",
  "portable",
  "sli",
  "unknown",
]);

type ResolvedBatteryClass = BatteryClass | "unsupported";

function resolvedBatteryClass(value: unknown): ResolvedBatteryClass {
  if (value == null) return "unknown";
  if (typeof value !== "string") return "unsupported";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "unknown";
  if (SUPPORTED_BATTERY_CLASSES.has(trimmed)) return trimmed as BatteryClass;
  return "unsupported";
}

export type EvidenceKind =
  "document" | "test_report" | "declaration" | "certificate";

export type EvidenceAudience = "public" | "restricted";

export interface OptimusEvidence {
  id: string;
  kind: EvidenceKind;
  /** Lowercase or mixed hex SHA-256 of the operator's file. The file is not fetched. */
  sha256: string;
  audience: EvidenceAudience;
}

/** Operator commercial data. Never copied onto the public record. */
export interface OptimusCommercial {
  unitCost?: number;
  currency?: string;
  supplierName?: string;
}

export interface OptimusSubject {
  kind: OptimusSubjectKind;
  /** Operator-supplied serial, lot, or model id. Never invented here. */
  identifier?: string | null;
  model?: string | null;
  batteryClass?: BatteryClass;
  /** Capacity in kWh. Omitted or null means unknown. */
  capacityKwh?: number | null;
  placedOnEuMarket?: boolean | null;
  putIntoServiceInEu?: boolean | null;
  /** Identifier of a battery subject assessed on its own. Not expanded here. */
  batteryIdentifier?: string | null;
  evidence?: OptimusEvidence[];
  commercial?: OptimusCommercial | null;
}

export type BatteryDutyState =
  | "art77"
  | "not_a_battery"
  | "not_on_eu_market"
  | "below_threshold"
  | "class_out"
  | "unknown";

export interface BatteryDuty {
  applies: boolean;
  state: BatteryDutyState;
  reason: string;
  /** Existing readiness category. Null when this subject is not a battery. */
  categoryId: "battery_passport" | "battery_other" | null;
  citation?: typeof ART77_CITATION;
  date?: typeof ART77_DATE;
}

export interface OptimusPublicEvidence {
  id: string;
  kind: EvidenceKind;
  sha256: string;
}

export interface OptimusFit {
  identity: {
    kind: OptimusSubjectKind;
    key: string | null;
    missing: string[];
  };
  batteryDuty: BatteryDuty;
  publicRecord: {
    kind: OptimusSubjectKind;
    identifier: string | null;
    model: string | null;
    batteryIdentifier: string | null;
    evidence: OptimusPublicEvidence[];
  };
  doesNotClaim: string;
}

const SHA256_HEX = /^[0-9a-fA-F]{64}$/;

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function onEuMarket(subject: OptimusSubject): boolean | null {
  if (
    subject.placedOnEuMarket === true ||
    subject.putIntoServiceInEu === true
  ) {
    return true;
  }
  if (
    subject.placedOnEuMarket === false &&
    subject.putIntoServiceInEu !== true
  ) {
    return false;
  }
  return null;
}

function batteryDuty(subject: OptimusSubject): BatteryDuty {
  if (subject.kind !== "battery") {
    const attached = clean(subject.batteryIdentifier);
    return {
      applies: false,
      state: "not_a_battery",
      categoryId: null,
      reason: attached
        ? `A ${subject.kind === "robot" ? "robot" : "supplier lot"} is not a battery. Assess battery ${attached} as its own subject before Article 77 can apply.`
        : `A ${subject.kind === "robot" ? "robot" : "supplier lot"} is not a battery. Article 77 is not applied to it.`,
    };
  }

  const market = onEuMarket(subject);
  if (market === null) {
    return {
      applies: false,
      state: "unknown",
      categoryId: null,
      reason:
        "EU placing and putting into service are unrecorded. Article 77 is not treated as applying.",
    };
  }
  if (market === false) {
    return {
      applies: false,
      state: "not_on_eu_market",
      categoryId: null,
      reason:
        "The operator recorded that this battery is not placed on the EU market and not put into service there.",
    };
  }

  const batteryClass = resolvedBatteryClass(subject.batteryClass);
  if (batteryClass === "unknown") {
    return {
      applies: false,
      state: "unknown",
      categoryId: null,
      reason:
        "Battery class is unknown. LMT, EV, and industrial are not assumed.",
    };
  }
  if (batteryClass === "unsupported") {
    return {
      applies: false,
      state: "unknown",
      categoryId: null,
      reason:
        "Battery class is not a supported value. Article 77 is not treated as applying. LMT, EV, and industrial are not assumed.",
    };
  }
  if (batteryClass === "portable" || batteryClass === "sli") {
    return {
      applies: false,
      state: "class_out",
      categoryId: "battery_other",
      reason: `A ${batteryClass} battery is outside Article 77. Other Battery Regulation duties may still phase in.`,
    };
  }
  if (batteryClass === "lmt" || batteryClass === "ev") {
    return {
      applies: true,
      state: "art77",
      categoryId: "battery_passport",
      citation: ART77_CITATION,
      date: ART77_DATE,
      reason: `Operator supplied class ${batteryClass} and an EU placing or putting into service. Article 77 has no 2 kWh floor for this class.`,
    };
  }
  if (batteryClass !== "industrial") {
    return {
      applies: false,
      state: "unknown",
      categoryId: null,
      reason:
        "Battery class is not a supported value. Article 77 is not treated as applying. LMT, EV, and industrial are not assumed.",
    };
  }

  const capacity = subject.capacityKwh;
  if (
    typeof capacity !== "number" ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return {
      applies: false,
      state: "unknown",
      categoryId: null,
      reason:
        "Industrial class is recorded, but capacity is missing or not a positive number of kWh. Article 77 is not treated as applying.",
    };
  }
  if (capacity <= INDUSTRIAL_ART77_KWH) {
    return {
      applies: false,
      state: "below_threshold",
      categoryId: "battery_other",
      reason: `Industrial capacity ${capacity} kWh is not above ${INDUSTRIAL_ART77_KWH} kWh.`,
    };
  }
  return {
    applies: true,
    state: "art77",
    categoryId: "battery_passport",
    citation: ART77_CITATION,
    date: ART77_DATE,
    reason: `Industrial capacity ${capacity} kWh is above ${INDUSTRIAL_ART77_KWH} kWh and the operator recorded an EU placing or putting into service.`,
  };
}

function publicEvidence(
  evidence: OptimusEvidence[] | undefined
): OptimusPublicEvidence[] {
  if (!evidence) return [];
  const out: OptimusPublicEvidence[] = [];
  for (const item of evidence) {
    if (item.audience !== "public") continue;
    const id = clean(item.id);
    if (!id || !SHA256_HEX.test(item.sha256)) continue;
    out.push({ id, kind: item.kind, sha256: item.sha256.toLowerCase() });
  }
  return out;
}

export function fitOptimus(subject: OptimusSubject): OptimusFit {
  const identifier = clean(subject.identifier);
  const missing: string[] = [];
  if (!identifier) missing.push("identifier");

  const duty = batteryDuty(subject);
  if (subject.kind === "battery" && duty.state === "unknown") {
    const batteryClass = resolvedBatteryClass(subject.batteryClass);
    if (batteryClass === "unknown" || batteryClass === "unsupported")
      missing.push("batteryClass");
    if (onEuMarket(subject) === null) missing.push("euMarket");
    if (
      batteryClass === "industrial" &&
      (typeof subject.capacityKwh !== "number" ||
        !Number.isFinite(subject.capacityKwh) ||
        subject.capacityKwh <= 0)
    ) {
      missing.push("capacityKwh");
    }
  }

  return {
    identity: {
      kind: subject.kind,
      key: identifier ? `optimus:${subject.kind}:${identifier}` : null,
      missing,
    },
    batteryDuty: duty,
    publicRecord: {
      kind: subject.kind,
      identifier,
      model: clean(subject.model),
      batteryIdentifier: clean(subject.batteryIdentifier),
      evidence: publicEvidence(subject.evidence),
    },
    doesNotClaim: OPTIMUS_DOES_NOT_CLAIM,
  };
}
