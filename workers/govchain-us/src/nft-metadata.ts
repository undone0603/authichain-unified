/**
 * GET/HEAD /api/nft-metadata/:id for the five founder-held AuthiChainProduct
 * (ACPT) seals on Base.
 *
 * On-chain facts (Base 8453, read 2026-09-22):
 *   contract 0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F
 *   name/symbol AuthiChainProduct / ACPT, totalSupply 5
 *   mint selector 0x061a24ac
 *   every token still on deployer 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2
 *
 * Agency, fit_score, product hash, and tokenURI come from mint calldata
 * (Blockscout raw_input). Token 5 is DLA Aviation at Philadelphia — not a
 * guessed fifth agency. Slugs are the on-chain tokenURI hashes, not the
 * slightly mistyped prefixes in the standup note.
 *
 * These stay founder-held until the owner decides treasury/agency transfer.
 * This module does not mint, transfer, or verify the contract.
 */

export const ACPT_CONTRACT = "0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F";
export const ACPT_CHAIN = "base";
export const ACPT_CHAIN_ID = 8453;
export const ACPT_HOLDER = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
export const NFT_METADATA_ORIGIN = "https://govchain.us";

export type AcptSeal = {
  tokenId: number;
  slug: string;
  /** Full agency string from mint calldata. */
  agency: string;
  /** Short label derived from that calldata string — not a new agency. */
  shortAgency: string;
  fitScore: number;
  tx: string;
};

/**
 * The five 2026-09-19 gov-engine mints, keyed by the hex slug in tokenURI
 * (`https://govchain.us/api/nft-metadata/<slug>`). Order is tokenId 1..5.
 */
export const ACPT_SEALS: readonly AcptSeal[] = [
  {
    tokenId: 1,
    slug: "f18d4cca33764da1bb556a7918b7197c",
    agency:
      "DEPT OF DEFENSE.DEPT OF THE ARMY.US ARMY CORPS OF ENGINEERS.ENGINEER DIVISION NORTHWESTERN.ENDIST WALLA WALLA.US ARMY ENGINEER DISTRICT WALLA WAL",
    shortAgency: "Army Corps of Engineers — Walla Walla",
    fitScore: 85,
    tx: "0x3f5b5bbb428d5c06110f7af982e0256ebfbe3a991654e9073f5b684d2fc7e859",
  },
  {
    tokenId: 2,
    slug: "ec9bcb476407420d882f7ff1d7c27b4f",
    agency:
      "DEPT OF DEFENSE.DEFENSE LOGISTICS AGENCY.DLA MARITIME.DLA MARITIME MECHANICSBURG.SPRMM1 DLA MECHANICSBURG",
    shortAgency: "DLA Mechanicsburg (SPRMM1)",
    fitScore: 85,
    tx: "0xa07d0bbadcc958b3f6fc8d81acda16a54c4bcfdb5e86bd2ce186e27f5752ab3b",
  },
  {
    tokenId: 3,
    slug: "e5e916fa87a24cedab57f5cfe98fed39",
    agency:
      "DEPT OF DEFENSE.DEPT OF THE AIR FORCE.AIR FORCE MATERIEL COMMAND.AIR FORCE TEST CENTER.FA9101  AEDC PKP   PROCRMNT BR",
    shortAgency: "Air Force Test Center / AEDC PKP",
    fitScore: 85,
    tx: "0x7223ca3e8dbf22d5469857cdb39900720b562be967bba08578dbc98b6983180e",
  },
  {
    tokenId: 4,
    slug: "f4ea4f7968af4702864a6a41849e7eda",
    agency:
      "DEPT OF DEFENSE.DEPT OF THE NAVY.NAVSUP.NAVSUP WEAPON SYSTEMS SUPPORT.NAVSUP WSS MECHANICSBURG.NAVSUP WEAPON SYSTEMS SUPPORT MECH",
    shortAgency: "NAVSUP WSS Mechanicsburg",
    fitScore: 82,
    tx: "0x9ca111f1e3fb020ec949a809603974766b4d8a938aaa6a3168cca99d91f50b82",
  },
  {
    tokenId: 5,
    slug: "dc3889c65807442691049747fd06bc84",
    agency:
      "DEPT OF DEFENSE.DEFENSE LOGISTICS AGENCY.DLA AVIATION.DLA AVIATION PHILADELPHIA.DLA AVIATION AT PHILADELPHIA, PA",
    shortAgency: "DLA Aviation at Philadelphia, PA",
    fitScore: 85,
    tx: "0x5938e707ee8116d9a5cd03a4d0ce1345d98707af11c02b2051903ea792ea7705",
  },
];

const SEAL_BY_SLUG = new Map(ACPT_SEALS.map(seal => [seal.slug, seal]));

const SLUG_RE = /^[0-9a-f]{32}$/;

export type NftMetadataJson = {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
} as const;

const SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=86400, s-maxage=2592000",
  "Access-Control-Allow-Origin": "*",
  "x-content-type-options": "nosniff",
} as const;

export function isNftMetadataPath(pathname: string): boolean {
  return (
    pathname === "/api/nft-metadata" ||
    pathname.startsWith("/api/nft-metadata/")
  );
}

export function lookupAcptSeal(id: string): AcptSeal | undefined {
  const slug = id.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return undefined;
  return SEAL_BY_SLUG.get(slug);
}

export function nftMetadataUrl(slug: string): string {
  return `${NFT_METADATA_ORIGIN}/api/nft-metadata/${slug}`;
}

export function nftMetadataImageUrl(slug: string): string {
  return `${nftMetadataUrl(slug)}/image`;
}

export function renderAcptMetadata(seal: AcptSeal): NftMetadataJson {
  return {
    name: `AuthiChain Product #${seal.tokenId} — ${seal.shortAgency}`,
    description:
      "GovChain DoD/DLA pilot seal. Source: gov-engine. AuthiChainProduct (ACPT) ERC-721 on Base; founder-held, not a public drop.",
    image: nftMetadataImageUrl(seal.slug),
    external_url: NFT_METADATA_ORIGIN,
    attributes: [
      { trait_type: "agency", value: seal.agency },
      { trait_type: "fit_score", value: seal.fitScore },
      { trait_type: "source", value: "gov-engine" },
      { trait_type: "brand", value: "GovChain" },
      { trait_type: "token_id", value: seal.tokenId },
      { trait_type: "contract", value: ACPT_CONTRACT },
      { trait_type: "chain", value: ACPT_CHAIN },
      { trait_type: "tx", value: seal.tx },
      { trait_type: "product_hash", value: seal.slug },
    ],
  };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, c => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    if (c === '"') return "&quot;";
    return "&apos;";
  });
}

/**
 * Same-origin seal mark. Palette matches the existing govchain.us favicon
 * (`#05060b` / `#3b82f6` / `#facc15`) so we do not invent a new hosted PNG.
 */
export function renderAcptSealSvg(seal: AcptSeal): string {
  const label = escapeXml(`ACPT #${seal.tokenId}`);
  const agency = escapeXml(seal.shortAgency);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="36" fill="#05060b"/>
  <rect x="16" y="16" width="480" height="480" rx="28" fill="none" stroke="#3b82f6" stroke-width="8"/>
  <rect x="128" y="292" width="48" height="112" fill="#3b82f6" opacity="0.7"/>
  <rect x="232" y="220" width="48" height="184" fill="#3b82f6"/>
  <rect x="336" y="148" width="48" height="256" fill="#facc15"/>
  <text x="256" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#f0f9ff">${label}</text>
  <text x="256" y="448" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#7e93b8">${agency}</text>
</svg>`;
}

type ParsedNftPath =
  { kind: "metadata" | "image"; id: string } | { kind: "unknown"; id: string };

function parseNftMetadataPath(pathname: string): ParsedNftPath | null {
  if (!isNftMetadataPath(pathname)) return null;
  const rest = pathname.slice("/api/nft-metadata".length);
  if (rest === "" || rest === "/") return { kind: "unknown", id: "" };
  const parts = rest.replace(/^\//, "").split("/");
  const id = (parts[0] ?? "").toLowerCase();
  if (parts.length === 1) {
    return SLUG_RE.test(id) && SEAL_BY_SLUG.has(id)
      ? { kind: "metadata", id }
      : { kind: "unknown", id };
  }
  if (parts.length === 2 && parts[1] === "image") {
    return SLUG_RE.test(id) && SEAL_BY_SLUG.has(id)
      ? { kind: "image", id }
      : { kind: "unknown", id };
  }
  return { kind: "unknown", id };
}

function json(status: number, body: unknown, head: boolean): Response {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Serve GET/HEAD (and CORS OPTIONS) ERC-721 metadata for the five ACPT seals. */
export function tryHandleNftMetadata(request: Request): Response | null {
  const url = new URL(request.url);
  const parsed = parseNftMetadataPath(url.pathname);
  if (!parsed) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(405, { error: "method_not_allowed" }, false);
  }

  const head = request.method === "HEAD";
  if (parsed.kind === "unknown") {
    return json(404, { error: "not_found", id: parsed.id }, head);
  }

  const seal = SEAL_BY_SLUG.get(parsed.id);
  if (!seal) {
    return json(404, { error: "not_found", id: parsed.id }, head);
  }

  if (parsed.kind === "image") {
    return new Response(head ? null : renderAcptSealSvg(seal), {
      status: 200,
      headers: SVG_HEADERS,
    });
  }

  return json(200, renderAcptMetadata(seal), head);
}
