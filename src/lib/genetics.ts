/**
 * StrainChain genetics — cultivar dossier data layer.
 *
 * Source of record is `content/strainchain/<farm>/certificates.json`.
 * Totals are derived at render, never transcribed.
 *
 * Unlisted farms (private samples) load through getDossier() so a direct
 * /genetics/<slug> URL can render, but listFarms() omits them from the
 * public index. Workers must also send noindex on those URLs.
 */

import mendoRaw from "../../content/strainchain/mendo-love-farms/certificates.json";
import gtrRaw from "../../content/strainchain/gtr-seeds/certificates.json";

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
  d8_THC?: number;
  CBGA?: number;
  CBG?: number;
  CBCA?: number;
  CBDVA?: number;
  CBDA?: number;
  CBD?: number;
  CBN?: number;
  CBC?: number;
  CBDV?: number;
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
  source_pdf?: string;
  source_pdf_sha256?: string;
  verified_against_pdf?: string;
}

export interface Cultivar {
  id: string;
  role: string;
  description?: string;
  coa_ids: string[];
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

export interface DerivedCertificate extends Certificate {
  derived: {
    totalThcvPct: number | null;
    totalThcPct: number | null;
    ratio: number | null;
    mismatch: null | {
      field: "thcv" | "thc";
      published: number;
      derived: number;
      impliedMissingPct?: number;
    };
  };
}

type FarmFile = {
  updated: string;
  unlisted?: boolean;
  provenance_warning: string;
  laboratory: unknown;
  party_of_record: {
    name: string;
    address: string;
    cultivator_disclosure: string;
  };
  cultivars: unknown[];
  certificates: unknown[];
  lineage_edges: unknown[];
  open_questions_for_breeder: unknown[];
};

function sum(...xs: (number | undefined)[]): number {
  return xs.reduce<number>((a, x) => a + (x ?? 0), 0);
}

function round(n: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Recomputes total THCV and total THC from the acidic/neutral pair.
 * Returns null for a total when that pair is absent — never print 0.000%
 * for a compound the panel did not measure.
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

  const hasThcv = c.THCV != null || c.THCVA != null;
  const hasThc = c.d9_THC != null || c.THCA != null;
  const totalThcv = hasThcv ? round(sum(c.THCV) + sum(c.THCVA) * DECARB) : null;
  const totalThc = hasThc ? round(sum(c.d9_THC) + sum(c.THCA) * DECARB) : null;

  const publishedThcv = cert.totals_pct.thcv ?? null;
  const publishedThc = cert.totals_pct.thc ?? null;

  let mismatch: DerivedCertificate["derived"]["mismatch"] = null;
  if (
    hasThcv &&
    publishedThcv != null &&
    totalThcv != null &&
    Math.abs(publishedThcv - totalThcv) > TOLERANCE_PCT
  ) {
    mismatch = { field: "thcv", published: publishedThcv, derived: totalThcv };
  } else if (
    hasThc &&
    publishedThc != null &&
    totalThc != null &&
    Math.abs(publishedThc - totalThc) > TOLERANCE_PCT
  ) {
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
      ratio:
        totalThcv != null && totalThc != null && totalThc > 0
          ? round(totalThcv / totalThc, 2)
          : null,
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
  laboratory: FarmFile["laboratory"];
  updated: string;
  unlisted: boolean;
  provenanceWarning: string;
  cultivars: Cultivar[];
  certificates: DerivedCertificate[];
  lineage: LineageEdge[];
  openQuestions: OpenQuestion[];
}

export function toSlug(cultivarId: string): string {
  return cultivarId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const FARMS: Record<string, FarmFile> = {
  "mendo-love-farms": mendoRaw as FarmFile,
  "gtr-seeds": gtrRaw as FarmFile,
};

/** Public index only. Unlisted private samples are omitted. */
export function listFarms(): string[] {
  return Object.keys(FARMS).filter(slug => !FARMS[slug].unlisted);
}

export function farmIsUnlisted(slug: string): boolean {
  return Boolean(FARMS[slug]?.unlisted);
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
    unlisted: Boolean(data.unlisted),
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
  peakThcvPct: number | null;
  peakRatio: number | null;
  parentEdges: LineageEdge[];
  childEdges: LineageEdge[];
  openQuestions: OpenQuestion[];
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

export function timeline(farmSlug: string): DerivedCertificate[] {
  const d = getDossier(farmSlug);
  if (!d) return [];
  return [...d.certificates].sort((a, b) =>
    a.collected.localeCompare(b.collected)
  );
}
