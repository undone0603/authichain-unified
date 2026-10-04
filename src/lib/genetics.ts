/**
 * StrainChain genetics — cultivar dossier data layer.
 *
 * Source of record is `content/strainchain/<farm>/certificates.json`.
 * Totals are derived at render, never transcribed.
 *
 * Unlisted farms are omitted from listFarms(). getDossier() returns null
 * for them unless the caller passes an explicit gate: GENETICS_UNLISTED_PREVIEW=1
 * or a token that matches GENETICS_UNLISTED_TOKEN (at least 16 characters).
 * Public routes must not pass that gate.
 *
 * Withdrawn farms stay in listFarms() so tests can load the fixture, but
 * isPublicFarm() is false and no page, sitemap, or API may serve them.
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

/** The testing lab named on every certificate in a farm file. */
type Laboratory = {
  name: string;
  address: string;
  /** null when the certificate does not publish it (GTR's PREE CoAs). */
  license: string | null;
  accreditation: string | null;
  method: string;
};

type FarmFile = {
  updated: string;
  unlisted?: boolean;
  provenance_warning: string;
  laboratory: Laboratory;
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

export const UNLISTED_PREVIEW_ENV = "GENETICS_UNLISTED_PREVIEW";
export const UNLISTED_TOKEN_ENV = "GENETICS_UNLISTED_TOKEN";
export const MIN_UNLISTED_TOKEN_LENGTH = 16;
export const UNLISTED_CACHE_CONTROL = "private, no-store, max-age=0";
export const UNLISTED_ROBOTS_TAG = "noindex, nofollow";

export type UnlistedAccess = {
  token?: string | null;
  env?: Record<string, string | undefined>;
};

function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function readEnv(access?: UnlistedAccess): Record<string, string | undefined> {
  if (access?.env) return access.env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

/** True only for an explicit preview env or a long matching token. Default is deny. */
export function unlistedAccessGranted(access?: UnlistedAccess): boolean {
  const env = readEnv(access);
  if (env[UNLISTED_PREVIEW_ENV] === "1") return true;
  const expected = env[UNLISTED_TOKEN_ENV];
  const presented = access?.token?.trim() ?? "";
  if (!expected || expected.length < MIN_UNLISTED_TOKEN_LENGTH || !presented) {
    return false;
  }
  return constantTimeEqual(presented, expected);
}

const FARMS: Record<string, FarmFile> = {
  "mendo-love-farms": mendoRaw as FarmFile,
  "gtr-seeds": gtrRaw as FarmFile,
};

/**
 * Farms whose library is withdrawn from every public surface. The data stays
 * in the repo as a reconciliation fixture for the recompute tests, but no
 * page, sitemap, or API may serve it.
 *
 * mendo-love-farms: the breeder declined on 2026-09-21. A declined breeder
 * cannot anchor the public demo (decision D2 in
 * docs/strategy/strainchain-genetics-passport.md: the record is theirs, and
 * revoke is first-class).
 */
const WITHDRAWN_FARMS = new Set<string>(["mendo-love-farms"]);

/** Fixture index. Unlisted private samples are omitted; withdrawn farms remain. */
export function listFarms(): string[] {
  return Object.keys(FARMS).filter(slug => !FARMS[slug].unlisted);
}

export function farmIsUnlisted(slug: string): boolean {
  return Boolean(FARMS[slug]?.unlisted);
}

/** True only for farms that may appear on a public page or API. */
export function isPublicFarm(farmSlug: string): boolean {
  const data = FARMS[farmSlug];
  if (!data || data.unlisted) return false;
  return !WITHDRAWN_FARMS.has(farmSlug);
}

export function listPublicFarms(): string[] {
  return listFarms().filter(isPublicFarm);
}

export function getDossier(
  farmSlug: string,
  access?: UnlistedAccess
): Dossier | null {
  const data = FARMS[farmSlug];
  if (!data) return null;
  if (data.unlisted && !unlistedAccessGranted(access)) return null;
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
  thcvRank: number | null;
  totalCultivars: number;
}

function edgeParents(e: LineageEdge): string[] {
  if (e.parents) return e.parents;
  return e.parent ? [e.parent] : [];
}

export function getCultivar(
  farmSlug: string,
  cultivarSlug: string,
  access?: UnlistedAccess
): CultivarView | null {
  const d = getDossier(farmSlug, access);
  if (!d) return null;
  const cultivar = d.cultivars.find(c => toSlug(c.id) === cultivarSlug);
  if (!cultivar) return null;

  const certificates = d.certificates
    .filter(c => cultivar.coa_ids.includes(c.coa_id))
    .sort((a, b) => b.collected.localeCompare(a.collected));

  const peakByCultivar = new Map(
    d.cultivars.map(c => {
      const peaks = d.certificates
        .filter(cert => c.coa_ids.includes(cert.coa_id))
        .map(cert => cert.derived.totalThcvPct)
        .filter((n): n is number => n != null);
      return [c.id, peaks.length ? Math.max(...peaks) : null] as const;
    })
  );
  const peaks = certificates
    .map(c => c.derived.totalThcvPct)
    .filter((n): n is number => n != null);
  const ratios = certificates
    .map(c => c.derived.ratio)
    .filter((n): n is number => n != null);

  const ranked = [...peakByCultivar.entries()].sort(
    ([aId, aPeak], [bId, bPeak]) => {
      if (aPeak == null) return bPeak == null ? aId.localeCompare(bId) : 1;
      if (bPeak == null) return -1;
      return bPeak - aPeak;
    }
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
    thcvRank:
      peakByCultivar.get(cultivar.id) == null
        ? null
        : ranked.findIndex(([id]) => id === cultivar.id) + 1,
    totalCultivars: d.cultivars.length,
  };
}

export function timeline(
  farmSlug: string,
  access?: UnlistedAccess
): DerivedCertificate[] {
  const d = getDossier(farmSlug, access);
  if (!d) return [];
  return [...d.certificates].sort((a, b) =>
    a.collected.localeCompare(b.collected)
  );
}
