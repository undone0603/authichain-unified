/**
 * Prior-art fingerprint for a cultivar's reconciled record.
 *
 * Why this exists: the research behind decision D3 found that the cannabis
 * genetics registry which survived — Kannapedia — did so because registration
 * is *protective*. A breeder registers to establish that they held this
 * chemistry and this lineage on this date, not to donate it. That is a thing a
 * breeder wants to own. "A nice page for your strain" is not.
 *
 * This module produces the hash half of that. It reuses `canonicalize` from
 * @authichain/verifier — key-sorted deterministic JSON, already the basis of
 * every digest the attestation validator accepts — so a fingerprint computed
 * here is the same shape the rest of the estate already checks
 * (`sha256:[A-Fa-f0-9]{64}`).
 *
 * What a fingerprint establishes, and what it does not, is stated on the page
 * rather than left to the reader. Unanchored it proves only that a record with
 * exactly this content produces this digest — it carries no date and no third
 * party. Anchoring is what would add time, and that needs signing keys this
 * environment does not have.
 */
import { createHash } from "node:crypto";
import { canonicalize } from "@authichain/verifier";
import type { CultivarView } from "./genetics";

export interface Fingerprint {
  /** `sha256:<64 hex>` — the format the attestation validator enforces. */
  digest: `sha256:${string}`;
  /** The exact bytes hashed. Kept so a third party can recompute rather than trust. */
  canonical: string;
  /** Plain-language inventory of what went into the hash. */
  covers: string[];
  proves: string;
  doesNotProve: string;
  anchored: false;
}

/**
 * The subset of a cultivar's record that the fingerprint covers.
 *
 * Deliberately excludes anything volatile — the dossier's `updated` date, file
 * paths, rendering state — so recomputing an unchanged record yields an
 * unchanged digest. Certificates are sorted by CoA id rather than trusted in
 * array order, so a reordering upstream cannot change the hash while the facts
 * stay the same.
 */
function subject(view: CultivarView, farmSlug: string) {
  return {
    farm: farmSlug,
    cultivar: view.cultivar.id,
    certificates: [...view.certificates]
      .sort((a, b) => a.coa_id.localeCompare(b.coa_id))
      .map(c => ({
        coa_id: c.coa_id,
        collected: c.collected,
        sample_name_on_coa: c.sample_name_on_coa,
        // The raw panel, not the derived totals: totals are a function of the
        // panel, so hashing both would let a transcription error hide behind a
        // recomputation that agrees with it.
        cannabinoids_pct: c.cannabinoids_pct,
        terpenes_pct: c.terpenes_pct ?? null,
      })),
    lineage: [...view.parentEdges]
      .map(e => ({
        parents: (e.parents ?? (e.parent ? [e.parent] : [])).slice().sort(),
        relation: e.relation,
        // Provenance is part of the claim. A record asserting confirmed
        // parentage is a different record from one asserting an inference,
        // even with identical parents.
        provenance: e.provenance,
      }))
      .sort((a, b) => a.parents.join().localeCompare(b.parents.join())),
  };
}

export function fingerprintCultivar(
  view: CultivarView,
  farmSlug: string
): Fingerprint {
  const canonical = canonicalize(subject(view, farmSlug) as never);
  const hex = createHash("sha256").update(canonical, "utf8").digest("hex");

  const certCount = view.certificates.length;
  const covers = [
    `${certCount} certificate${certCount === 1 ? "" : "s"}, by CoA id, date and sample name`,
    "the raw cannabinoid panel from each certificate",
    view.certificates.some(c => c.terpenes_pct)
      ? "the terpene panel where one exists"
      : "no terpene panel is on file for this cultivar",
    `${view.parentEdges.length} lineage relation${view.parentEdges.length === 1 ? "" : "s"}, each with how it is known`,
  ];

  return {
    digest: `sha256:${hex}`,
    canonical,
    covers,
    proves:
      "That a record with exactly this content produces this digest. Change any covered value — a figure, a date, a parentage claim, or how that parentage is known — and the digest changes.",
    doesNotProve:
      "Nothing about when this record existed, and nothing about whether the chemistry or the lineage is true. It is a checksum over what the breeder supplied, not an endorsement of it, and it carries no timestamp until it is anchored.",
    anchored: false,
  };
}
