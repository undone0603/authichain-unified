/**
 * The published microsite packs, as one source of truth.
 *
 * These are the only product-shaped records AuthiChain has actually
 * published: each one is live at /m/<slug> and listed in
 * content/microsites/manifest.json. `query_provenance` resolves against
 * this list, and /mcp/install renders it.
 *
 * Deliberately excluded: content/strainchain/gtr-seeds and
 * content/strainchain/mendo-love-farms. Both are marked `"unlisted": true`
 * and hold CoA figures transcribed from named growers' lab PDFs. They are
 * not public and must not be resolvable through a public tool.
 *
 * A pack is a *published restatement*, not an attestation. Nothing here
 * asserts a physical product was inspected — see PACK_LIMIT.
 */

export const PACK_LIMIT =
  "A published pack is a restatement of a document, not an attestation and not a re-audit. " +
  "It carries no signature check. For a cryptographic verdict use verify_record.";

export type PublishedPack = {
  slug: string;
  /** What the pack is about, in the words of its own published page. */
  name: string;
  note: string;
  /** Other ids that resolve to this pack, from the manifest aliases. */
  aliases: readonly string[];
};

export const PUBLISHED_PACKS: readonly PublishedPack[] = [
  {
    slug: "bat-2026-001",
    name: "Insulin Vial 100IU",
    note: "Batch BAT-2026-001, EU market, verdict PASS. Public restatement of MVCL_Certificate_BAT-2026-001.pdf.",
    aliases: ["insulin-vial"],
  },
  {
    slug: "trumark",
    name: "TruMark seal",
    note: "The scan seal surface. Routes to a genetics passport or EU DPP readiness.",
    aliases: [],
  },
  {
    slug: "musa",
    name: "Made in America origin claim",
    note: "Substantiating a Made in USA origin claim with a signed per-unit record.",
    aliases: ["made-in-america"],
  },
  {
    slug: "strainchain",
    name: "StrainChain genetics",
    note: "Public genetics passport hub. Private cultivar libraries are not listed.",
    aliases: [],
  },
] as const;

export function packUrl(slug: string): string {
  return `https://authichain.com/m/${slug}`;
}

/**
 * Resolve an asset id to a published pack. Matching is case- and
 * separator-insensitive because an agent will pass "BAT-2026-001" where
 * the slug is "bat-2026-001".
 */
export function findPublishedPack(raw: unknown): PublishedPack | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (!key) return null;
  for (const pack of PUBLISHED_PACKS) {
    if (pack.slug === key || pack.aliases.includes(key)) return pack;
  }
  return null;
}
