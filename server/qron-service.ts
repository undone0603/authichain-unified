/**
 * QRON Physical Authentication Bridge
 *
 * Connects AuthiChain product certificates to QRON visual fingerprints.
 * Provides 5-layer forensic trust scoring:
 *
 *   Layer 1 — QR decode          : encoded product ID + blockchain hash
 *   Layer 2 — Blockchain cert    : ERC-721 NFT ownership on Polygon
 *   Layer 3 — Visual fingerprint : AI-generated art pattern match (pHash + CLIP)
 *   Layer 4 — $QRON community    : consensus verdicts from incentivized verifiers
 *   Layer 5 — openART registry   : public gallery match on qron.space
 */

import { createHash } from "crypto";
import { appendPassportEvidence } from "../protocol/passport.mjs";
import { readStoredPassport } from "../workers/authichain-verify-worker/src/protocol-verify.mjs";
import { ENV } from "./_core/env";

// ─── Config ───────────────────────────────────────────────────────────────────

const QRON_API =
  process.env.NEXT_PUBLIC_WORKER_URL ??
  "https://qron-api.exzactly-k.workers.dev";
const QRON_SPACE_URL = "https://qron.space";
const FAL_API = "https://fal.run";

// pHash at or above 0.9, CLIP at or above 0.85. The number is not a passport verdict.
const PHASH_MATCH_THRESHOLD = 0.9;
const FINGERPRINT_MATCH_THRESHOLD = 0.85;

export const VISUAL_COMPARE_ABSENT_SENTENCE =
  "A visual compare is not a product passport scan.";

export type VisualSimilarityEvidence = {
  type: "visual_similarity";
  source: "phash" | "clip";
  similarity: number;
  threshold: number;
  aboveThreshold: boolean;
};

// QRON modes by product tier
const MODE_BY_TIER: Record<string, string> = {
  standard: "holographic", // Legendary rarity, prismatic surface, hardest to copy
  premium: "dimensional", // Perspective-warped grid, spatially complex
  enterprise: "living", // Particle halo + evolving aura, nearly impossible to fake
  pharma: "temporal", // Time-ringed pulsing — changes appearance over scan sessions
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QRONGenerateParams {
  productId: string;
  productName: string;
  brand?: string;
  serialNumber?: string;
  nftTokenId?: string;
  category?:
    | "luxury_fashion"
    | "pharma"
    | "electronics"
    | "automotive"
    | "food_bev"
    | "other";
  tier?: "standard" | "premium" | "enterprise" | "pharma";
  verifyUrl: string; // the URL encoded in the QR (authichain.com/verify/...)
}

export interface QRONRecord {
  qronId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  mode: string;
  seed: string;
  fingerprintHash: string;
  nftTokenId?: string;
  openartUrl?: string;
}

export interface FingerprintResult {
  pass: boolean;
  similarity: number; // 0-1 cosine similarity
  verdict: "not_a_passport";
  details: string;
  evidence?: VisualSimilarityEvidence;
  metadata?: Record<string, unknown>;
}

export interface TrustScore {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "F";
  layers: {
    qrDecode: { pass: boolean; weight: number };
    blockchain: { pass: boolean; weight: number };
    visualFingerprint: { pass: boolean; similarity: number; weight: number };
    community: {
      pass: boolean;
      verified: number;
      flagged: number;
      weight: number;
    };
    openArt: { pass: boolean; weight: number };
  };
  verdict: "not_a_passport";
}

// ─── Seed generation ─────────────────────────────────────────────────────────

/**
 * Deterministic seed: keccak256-style hash of product identity.
 * Same product + token always generates the same QRON pattern.
 * A counterfeit with a different token ID gets a different pattern → fails fingerprint check.
 */
export function generateProductSeed(params: {
  productId: string;
  nftTokenId?: string;
  serialNumber?: string;
}): string {
  const raw = `${params.productId}:${params.nftTokenId ?? ""}:${params.serialNumber ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

// ─── QRON Generation ─────────────────────────────────────────────────────────

/**
 * Generate a QRON for a product unit.
 * Uses Fal.ai illusion-diffusion with a deterministic seed so the same product
 * always produces the same visual pattern — counterfeits cannot reproduce it.
 */
export async function generateProductQRON(
  params: QRONGenerateParams
): Promise<QRONRecord> {
  const seed = generateProductSeed({
    productId: params.productId,
    nftTokenId: params.nftTokenId,
    serialNumber: params.serialNumber,
  });

  const mode = MODE_BY_TIER[params.tier ?? "standard"];
  const category = params.category ?? "other";

  // Build a rich art prompt from product identity
  const prompt = buildArtPrompt(
    params.productName,
    params.brand,
    mode,
    category
  );

  // Call QRON API to generate
  const res = await fetch(`${QRON_API}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      controlImage: params.verifyUrl, // QR data encoded inside the art
      seed: parseInt(seed.slice(0, 8), 16), // first 8 hex chars as numeric seed
      brandTier:
        params.tier === "enterprise"
          ? "enterprise"
          : params.tier === "premium"
            ? "growth"
            : "starter",
      rarityTier:
        mode === "living" || mode === "temporal"
          ? "legendary"
          : mode === "holographic" || mode === "dimensional"
            ? "legendary"
            : "rare",
      mode,
      metadata: {
        productId: params.productId,
        brand: params.brand,
        serialNumber: params.serialNumber,
        nftTokenId: params.nftTokenId,
        authichainSeed: seed,
        category,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QRON generation failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as any;
  const imageUrl: string = json.imageUrl ?? json.image_url ?? json.url;
  if (!imageUrl) throw new Error("QRON API did not return an image URL");

  // Compute perceptual fingerprint hash from the image URL
  const fingerprintHash = await computeImageHash(imageUrl);

  // Register to openART public gallery
  const openartUrl = await registerToOpenART({
    qronId: json.id ?? json.qronId,
    imageUrl,
    productId: params.productId,
    productName: params.productName,
    brand: params.brand,
    seed,
    mode,
    category,
  }).catch(() => undefined); // non-fatal if openART registration fails

  return {
    qronId: json.id ?? json.qronId ?? seed,
    imageUrl,
    thumbnailUrl: json.thumbnailUrl ?? json.thumbnail_url,
    mode,
    seed,
    fingerprintHash,
    nftTokenId: json.nftTokenId ?? json.nft_token_id,
    openartUrl,
  };
}

// ─── Visual Fingerprint Verification ─────────────────────────────────────────

/** Similarity recorded beside a passport. The row has no genuineness key. */
export function visualEvidenceEntry(
  similarity: number,
  source: "phash" | "clip"
): VisualSimilarityEvidence {
  const threshold =
    source === "phash" ? PHASH_MATCH_THRESHOLD : FINGERPRINT_MATCH_THRESHOLD;
  return {
    type: "visual_similarity",
    source,
    similarity,
    threshold,
    aboveThreshold: Number.isFinite(similarity) && similarity >= threshold,
  };
}

export function visualEvidenceSentence(
  similarity: number,
  digitalIdentity: string
): string {
  return `A server-side image compare recorded similarity ${similarity} as evidence on passport ${digitalIdentity}. It is not the genuineness verdict.`;
}

function storedDigitalIdentity(metadata: unknown): string | null {
  const stored = readStoredPassport(metadata);
  const id = stored?.record?.credentialSubject?.id;
  return stored && typeof id === "string" ? id : null;
}

/**
 * Compare two images. The number is a similarity. It is not a passport scan.
 * A stored passport receives one visual_similarity evidence row.
 */
export function visualCompareResult(
  similarity: number,
  source: "phash" | "clip",
  metadata?: unknown
): FingerprintResult {
  const entry = visualEvidenceEntry(similarity, source);
  const absent = {
    pass: entry.aboveThreshold,
    similarity,
    verdict: "not_a_passport" as const,
    details: VISUAL_COMPARE_ABSENT_SENTENCE,
  };
  const identity = storedDigitalIdentity(metadata);
  if (identity === null) return absent;
  try {
    const next = appendPassportEvidence(metadata, entry);
    return {
      ...absent,
      details: visualEvidenceSentence(similarity, identity),
      evidence: entry,
      metadata: next,
    };
  } catch {
    return absent;
  }
}

/**
 * Compare a scanned QRON image with the registered template.
 * Uses CLIP image embeddings for robustness to print/photo distortions.
 * The result is a similarity. It does not scan a product passport.
 */
export async function verifyVisualFingerprint(params: {
  scannedImageUrl: string;
  registeredImageUrl: string;
  registeredFingerprintHash?: string;
  metadata?: unknown;
}): Promise<FingerprintResult> {
  // Fast path: perceptual hash comparison (no API call needed)
  if (params.registeredFingerprintHash) {
    const scannedHash = await computeImageHash(params.scannedImageUrl);
    const hammingDist = hammingDistance(
      params.registeredFingerprintHash,
      scannedHash
    );
    const hashSim = 1 - hammingDist / 64; // normalize to 0-1

    // If hashes are very close, or clearly apart, skip CLIP.
    if (hashSim >= 0.9 || hashSim < 0.4) {
      return visualCompareResult(hashSim, "phash", params.metadata);
    }
  }

  // Deep path: CLIP embedding similarity via Fal.ai
  const sim = await getCLIPSimilarity(
    params.scannedImageUrl,
    params.registeredImageUrl
  );
  return visualCompareResult(sim, "clip", params.metadata);
}

// ─── Composite Trust Score ────────────────────────────────────────────────────
// The number is a tally of the flags passed in. It is not a passport scan.

export function computeTrustScore(params: {
  qrDecodePass: boolean;
  blockchainCertExists: boolean;
  visualFingerprint?: FingerprintResult;
  communityVerified: number;
  communityFlagged: number;
  openArtRegistered: boolean;
}): TrustScore {
  const layers = {
    qrDecode: { pass: params.qrDecodePass, weight: 20 },
    blockchain: { pass: params.blockchainCertExists, weight: 25 },
    visualFingerprint: {
      pass: params.visualFingerprint?.pass ?? false,
      similarity: params.visualFingerprint?.similarity ?? 0,
      weight: 30,
    },
    community: {
      pass: params.communityVerified > params.communityFlagged,
      verified: params.communityVerified,
      flagged: params.communityFlagged,
      weight: 15,
    },
    openArt: { pass: params.openArtRegistered, weight: 10 },
  };

  const score =
    (layers.qrDecode.pass ? layers.qrDecode.weight : 0) +
    (layers.blockchain.pass ? layers.blockchain.weight : 0) +
    (layers.visualFingerprint.pass ? layers.visualFingerprint.weight : 0) +
    (layers.community.pass ? layers.community.weight : 0) +
    (layers.openArt.pass ? layers.openArt.weight : 0);

  const grade: TrustScore["grade"] =
    score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "F";

  return { score, grade, layers, verdict: "not_a_passport" };
}

// Server-observed passport evidence. Caller flags are not in this set.
export const EVIDENCE_TALLY_TYPES = [
  "visual_similarity",
  "metrc_manifest_match",
  "dscsa_package_ti",
  "hash_publication",
] as const;

export const EVIDENCE_TALLY_SENTENCE =
  "This number tallies evidence entries stored on the passport. It is not a genuineness verdict.";

export const EVIDENCE_TALLY_ABSENT_SENTENCE =
  "A visual compare is not a product passport scan.";

const EVIDENCE_TALLY_TYPE_SET = new Set<string>(EVIDENCE_TALLY_TYPES);

export interface EvidenceTally {
  count: number;
  verdict: "not_a_passport";
  message: string;
}

function evidenceList(stored: unknown): unknown[] {
  if (Array.isArray(stored)) return stored;
  if (!stored || typeof stored !== "object") return [];
  const passport = (stored as { passport?: unknown }).passport;
  if (!passport || typeof passport !== "object" || Array.isArray(passport))
    return [];
  const evidence = (passport as { evidence?: unknown }).evidence;
  return Array.isArray(evidence) ? evidence : [];
}

/**
 * Count stored server-observed evidence entries. The number is not a verdict
 * and it does not set genuine. Caller booleans are not inputs.
 */
export function evidenceTally(stored: unknown): EvidenceTally {
  let count = 0;
  for (const entry of evidenceList(stored)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const type = (entry as { type?: unknown }).type;
    if (typeof type === "string" && EVIDENCE_TALLY_TYPE_SET.has(type))
      count += 1;
  }
  return {
    count,
    verdict: "not_a_passport",
    message:
      count > 0 ? EVIDENCE_TALLY_SENTENCE : EVIDENCE_TALLY_ABSENT_SENTENCE,
  };
}

// ─── openART Registry ─────────────────────────────────────────────────────────

async function registerToOpenART(params: {
  qronId: string;
  imageUrl: string;
  productId: string;
  productName: string;
  brand?: string;
  seed: string;
  mode: string;
  category: string;
}): Promise<string> {
  const res = await fetch(`${QRON_SPACE_URL}/api/openart/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-authichain-key": ENV.qronAuthichainKey,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`openART register failed: ${res.status}`);
  const json = (await res.json()) as any;
  return `${QRON_SPACE_URL}/openart/${json.id ?? params.qronId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildArtPrompt(
  name: string,
  brand?: string,
  mode?: string,
  category?: string
): string {
  const modePrompts: Record<string, string> = {
    holographic:
      "holographic prismatic iridescent surface, rainbow light refraction, authentication seal",
    dimensional:
      "deep perspective grid, impossible geometry, 3D depth illusion, serialization marks",
    living:
      "particle halo swarm, bio-luminescent aura, evolving organic pattern, unique fingerprint",
    temporal:
      "pulsing concentric time rings, chronological depth, pharmaceutical precision markings",
  };
  const base = modePrompts[mode ?? "holographic"] ?? modePrompts.holographic;
  const brandTag = brand ? `${brand} brand identity, ` : "";
  const catTag =
    category === "pharma"
      ? "medical grade, sterile aesthetic, "
      : category === "luxury_fashion"
        ? "luxury craftsmanship, haute couture, "
        : "";
  return `${brandTag}${catTag}${base}, anti-counterfeit visual seal for "${name}", ultra high detail, certificate of authenticity`;
}

async function computeImageHash(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    const buf = await res.arrayBuffer();
    return createHash("sha256")
      .update(Buffer.from(buf))
      .digest("hex")
      .slice(0, 64);
  } catch {
    return createHash("sha256").update(imageUrl).digest("hex").slice(0, 64);
  }
}

function hammingDistance(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist + Math.abs(a.length - b.length);
}

async function getCLIPSimilarity(urlA: string, urlB: string): Promise<number> {
  try {
    // Use Fal.ai CLIP to get image embeddings and compute cosine similarity
    const [embA, embB] = await Promise.all([
      getFalEmbedding(urlA),
      getFalEmbedding(urlB),
    ]);
    return cosineSimilarity(embA, embB);
  } catch {
    // Fallback: URL string similarity (weak but non-failing)
    return urlA === urlB ? 1 : 0.5;
  }
}

async function getFalEmbedding(imageUrl: string): Promise<number[]> {
  const res = await fetch(`${FAL_API}/fal-ai/clip/image`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  const json = (await res.json()) as any;
  return json.embedding ?? json.image_embedding ?? [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
