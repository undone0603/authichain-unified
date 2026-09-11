/**
 * StrainChain genetics — cultivar dossier data layer.
 *
 * Source of record is `content/strainchain/<farm>/certificates.json`, a
 * reconciliation of a breeder's certificates of analysis. See
 * `content/strainchain/mendo-love-farms/reconciliation.md` for how that file
 * came to exist and what it does and does not establish.
 *
 * The central idea here: **totals are derived, never trusted.** Cannabis CoAs
 * report acidic and neutral cannabinoids separately (THCVA vs THCV), and the
 * headline "total THCV" is a decarboxylation-weighted sum the lab computes.
 * Transcribing that headline invites exactly the class of error found in the
 * first prototype pass — a published figure that no longer matches the panel
 * printed beneath it. So every total on a rendered page is recomputed from raw
 * mg/g here, and any certificate whose published total disagrees is surfaced as
 * a discrepancy rather than silently overwritten in either direction.
 */

import raw from "../../content/strainchain/mendo-love-farms/certificates.json";

/** THC (314.46 g/mol) / THCA (358.47 g/mol). The standard decarb factor. */
export const DECARB = 0.877;

/** Tolerance on a derived-vs-published comparison, in absolute weight %. */
const TOLERANCE_PCT = 0.01;

export type Provenance =
  "confirmed_in_writing" | "inferred" | "claimed" | "none";

export type ArithmeticCheck =
  "pass" | "fail" | "not_possible_without_raw_values";

export interface Cannabinoids {
  THCVA?: number;
  THCV?: number;
  THCA?: number;
  d9_THC?: number;
  CBGA?: number;
  CBG?: number;
  CBCA?: number;
  CBDVA?: number;
}

export interface Certificate {
  coa_id: string;
  cultivar: string;
  sample_name_on_coa: string;
  collected: string;
  batch?: string;
  matrix?: string;
  sample_mass_g?: number;
  moisture_pct?: number;
  amendment_of?: string;
  cannabinoids_pct: Cannabinoids | null;
  cannabinoids_note?: string;
  totals_pct: Record<string, number | null>;
  ratio_thcv_thc: number;
  terpenes_pct?: Record<string, number>;
  terpenes_total_pct?: number;
  terpenes_tested_count?: number;
  arithmetic_check: ArithmeticCheck;
  breeder_claimed_ratio?: number;
  open_question?: string;
}

export interface Cultivar {
  id: string;
  role: string;
  description?: string;
  coa_ids: string[];
  /** null when no certificate exists for this cultivar yet. */
  peak_total_thcv_pct: number | null;
  awards?: {
    name: string;
    year: number;
    provenance: Provenance;
    evidence: string;
  }[];
}

export interface LineageEdge {
  parent?: string | null;
  parents?: string[];
  child: string;
  relation: string;
  provenance: Provenance;
  evidence: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  blocks: string;
}

/** A certificate with its totals recomputed from the raw panel. */
export interface DerivedCertificate extends Certificate {
  derived: {
    /** null when the panel was never captured, so nothing can be recomputed. */
    totalThcvPct: number | null;
    totalThcPct: number | null;
    ratio: number | null;
    /** Set when a derived total disagrees with the published one. */
    mismatch: null | {
      field: "thcv" | "thc";
      published: number;
      derived: number;
      /** Δ9-THC implied by the published total but absent from the panel. */
      impliedMissingPct?: number;
    };
  };
}

function sum(...xs: (number | undefined)[]): number {
  return xs.reduce<number>((a, x) => a + (x ?? 0), 0);
}

function round(n: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Recomputes total THCV and total THC from the acidic/neutral pair.
 * Returns nulls when the panel is absent — an unverifiable certificate is
 * reported as unverifiable, never quietly promoted to verified.
 */
export function derive(cert: Certificate): DerivedCertificate {
  const c = cert.cannabinoids_pct;
  if (!c) {
    return {
      ...cert,
      derived: {
        totalThcvPct: null,
        totalThcPct: null,
        ratio: null,
        mismatch: null,
      },
    };
  }

  const totalThcv = round(sum(c.THCV) + sum(c.THCVA) * DECARB);
  const totalThc = round(sum(c.d9_THC) + sum(c.THCA) * DECARB);

  const publishedThcv = cert.totals_pct.thcv ?? null;
  const publishedThc = cert.totals_pct.thc ?? null;

  let mismatch: DerivedCertificate["derived"]["mismatch"] = null;
  if (
    publishedThcv != null &&
    Math.abs(publishedThcv - totalThcv) > TOLERANCE_PCT
  ) {
    mismatch = { field: "thcv", published: publishedThcv, derived: totalThcv };
  } else if (
    publishedThc != null &&
    Math.abs(publishedThc - totalThc) > TOLERANCE_PCT
  ) {
    // The common cause is a Δ9-THC row that never made it into the panel:
    // the published total is right, the transcription is short a compound.
    mismatch = {
      field: "thc",
      published: publishedThc,
      derived: totalThc,
      impliedMissingPct: round(publishedThc - totalThc),
    };
  }

  return {
    ...cert,
    derived: {
      totalThcvPct: totalThcv,
      totalThcPct: totalThc,
      ratio: totalThc > 0 ? round(totalThcv / totalThc, 2) : null,
      mismatch,
    },
  };
}

export interface Dossier {
  farm: {
    slug: string;
    name: string;
    address: string;
    cultivatorDisclosure: string;
  };
  laboratory: typeof raw.laboratory;
  updated: string;
  provenanceWarning: string;
  cultivars: Cultivar[];
  certificates: DerivedCertificate[];
  lineage: LineageEdge[];
  openQuestions: OpenQuestion[];
}

/** Turns a cultivar id into its URL segment: "VT-26" → "vt-26". */
export function toSlug(cultivarId: string): string {
  return cultivarId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const FARMS: Record<string, typeof raw> = {
  "mendo-love-farms": raw as typeof raw,
};

export function listFarms(): string[] {
  return Object.keys(FARMS);
}

export function getDossier(farmSlug: string): Dossier | null {
  const data = FARMS[farmSlug];
  if (!data) return null;
  return {
    farm: {
      slug: farmSlug,
      name: data.party_of_record.name,
      address: data.party_of_record.address,
      cultivatorDisclosure: data.party_of_record.cultivator_disclosure,
    },
    laboratory: data.laboratory,
    updated: data.updated,
    provenanceWarning: data.provenance_warning,
    cultivars: data.cultivars as unknown as Cultivar[],
    certificates: (data.certificates as unknown as Certificate[]).map(derive),
    lineage: data.lineage_edges as unknown as LineageEdge[],
    openQuestions: data.open_questions_for_breeder as unknown as OpenQuestion[],
  };
}

export interface CultivarView {
  cultivar: Cultivar;
  slug: string;
  certificates: DerivedCertificate[];
  /** Highest derived total THCV across this cultivar's certificates. */
  peakThcvPct: number | null;
  /** Best THCV:THC ratio across this cultivar's certificates. */
  peakRatio: number | null;
  /** Lineage edges where this cultivar is the child. */
  parentEdges: LineageEdge[];
  /** Lineage edges where this cultivar is a parent. */
  childEdges: LineageEdge[];
  /** Open questions naming this cultivar. */
  openQuestions: OpenQuestion[];
  /** Rank by peak THCV across the whole farm, 1-indexed. */
  thcvRank: number;
  totalCultivars: number;
}

function edgeParents(e: LineageEdge): string[] {
  if (e.parents) return e.parents;
  return e.parent ? [e.parent] : [];
}

export function getCultivar(
  farmSlug: string,
  cultivarSlug: string
): CultivarView | null {
  const d = getDossier(farmSlug);
  if (!d) return null;
  const cultivar = d.cultivars.find(c => toSlug(c.id) === cultivarSlug);
  if (!cultivar) return null;

  const certificates = d.certificates
    .filter(c => cultivar.coa_ids.includes(c.coa_id))
    .sort((a, b) => b.collected.localeCompare(a.collected));

  const peaks = certificates
    .map(c => c.derived.totalThcvPct ?? c.totals_pct.thcv ?? null)
    .filter((n): n is number => n != null);
  const ratios = certificates
    .map(c => c.derived.ratio ?? c.ratio_thcv_thc ?? null)
    .filter((n): n is number => n != null);

  // Rank across the farm on the same basis the dossier displays.
  // A cultivar with no certificate has no measured peak and ranks last, rather
  // than producing NaN in the comparator and an unstable order.
  const ranked = [...d.cultivars].sort(
    (a, b) => (b.peak_total_thcv_pct ?? -1) - (a.peak_total_thcv_pct ?? -1)
  );

  const q = d.openQuestions.filter(
    o => o.question.includes(cultivar.id) || o.blocks.includes(cultivar.id)
  );

  return {
    cultivar,
    slug: cultivarSlug,
    certificates,
    peakThcvPct: peaks.length ? Math.max(...peaks) : null,
    peakRatio: ratios.length ? Math.max(...ratios) : null,
    parentEdges: d.lineage.filter(e => e.child === cultivar.id),
    childEdges: d.lineage.filter(e => edgeParents(e).includes(cultivar.id)),
    openQuestions: q,
    thcvRank: ranked.findIndex(c => c.id === cultivar.id) + 1,
    totalCultivars: d.cultivars.length,
  };
}

/** Every certificate on the farm, oldest first — the family's chemistry over time. */
export function timeline(farmSlug: string): DerivedCertificate[] {
  const d = getDossier(farmSlug);
  if (!d) return [];
  return [...d.certificates].sort((a, b) =>
    a.collected.localeCompare(b.collected)
  );
}
