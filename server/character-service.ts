/**
 * AuthiCharacter Generation Service — OpenArt Protocol Edition
 * 
 * Integrates: Protocol-grade prompt builder (7 archetypes),
 * 7-dimension scoring (protocol_fit, thumbnail_clarity, premium_feel,
 * silhouette, trust_symbolism, mint_readiness, ui_compatibility),
 * mint-prep pipeline, agent creation, QRON reward distribution.
 */
import { getDb } from "./db";
import {
  characterGenerations, characterAssets, protocolAgents,
  verificationClaims, consensusResults, qronRewardLedger,
  checkpointBatches,
  type InsertCharacterGeneration, type InsertCharacterAsset,
  type InsertProtocolAgent,
} from "../drizzle/schema";
import { eq, desc, sql, and, count } from "drizzle-orm";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import crypto from "crypto";

// ─── Archetype Definitions (7 archetypes from OpenArt protocol) ────────────
const ARCHETYPES = {
  guardian: {
    name: "Guardian",
    description: "Protects brand integrity and product authenticity",
    color: "#3B82F6",
    baseXP: 100,
    featureScopes: ["verify", "protect", "alert"],
    visual: {
      role: "shield-bearing protector",
      armor: "crystalline blockchain plates with glowing verification sigils",
      weapon: "luminous shield projecting holographic authenticity seals",
      aura: "steady blue-gold radiance of unwavering trust",
      environment: "fortified gateway between physical and digital realms",
    },
  },
  archivist: {
    name: "Archivist",
    description: "Records and preserves provenance data on-chain",
    color: "#8B5CF6",
    baseXP: 80,
    featureScopes: ["record", "archive", "query"],
    visual: {
      role: "ancient scholar of digital provenance",
      armor: "robes woven from data-stream fabric with golden chain links",
      weapon: "floating holographic scrolls containing immutable records",
      aura: "soft violet glow of accumulated knowledge",
      environment: "vast library of crystallized blockchain ledgers",
    },
  },
  sentinel: {
    name: "Sentinel",
    description: "Monitors supply chain integrity in real-time",
    color: "#EF4444",
    baseXP: 120,
    featureScopes: ["monitor", "detect", "respond"],
    visual: {
      role: "vigilant watchtower entity",
      armor: "sensor-mesh plating with pulsing IoT nodes",
      weapon: "radar-like scanning eyes that pierce deception",
      aura: "crimson alert pulses radiating outward",
      environment: "elevated observation post overlooking global supply networks",
    },
  },
  scout: {
    name: "Scout",
    description: "Discovers counterfeits and maps threat networks",
    color: "#10B981",
    baseXP: 90,
    featureScopes: ["scan", "discover", "map"],
    visual: {
      role: "agile reconnaissance operative",
      armor: "stealth-mesh cloak with network mapping trails",
      weapon: "magnifying lens eye revealing hidden patterns",
      aura: "emerald traces of discovered connections",
      environment: "shadowy marketplace where fakes hide among genuine goods",
    },
  },
  arbiter: {
    name: "Arbiter",
    description: "Resolves disputes and renders consensus verdicts",
    color: "#F59E0B",
    baseXP: 150,
    featureScopes: ["judge", "resolve", "settle"],
    visual: {
      role: "judicial figure of absolute fairness",
      armor: "consensus-weave robes with embedded voting nodes",
      weapon: "balanced scales of verification and gavel of finality",
      aura: "golden symmetry of impartial judgment",
      environment: "grand tribunal hall where truth is determined by consensus",
    },
  },
  merchant: {
    name: "Merchant",
    description: "Facilitates authentic commerce and value exchange",
    color: "#EC4899",
    baseXP: 110,
    featureScopes: ["trade", "certify", "price"],
    visual: {
      role: "master trader of verified goods",
      armor: "merchant vestments threaded with smart-contract filigree",
      weapon: "authentication stamp that brands genuine articles",
      aura: "warm rose-gold shimmer of trusted commerce",
      environment: "bustling digital bazaar where every item bears proof of origin",
    },
  },
  explorer: {
    name: "Explorer",
    description: "Charts new authentication frontiers and protocols",
    color: "#06B6D4",
    baseXP: 95,
    featureScopes: ["discover", "pioneer", "integrate"],
    visual: {
      role: "frontier pathfinder of new verification domains",
      armor: "adaptive exploration suit with multi-protocol interfaces",
      weapon: "compass that points toward undiscovered authentication methods",
      aura: "cyan trails of newly charted protocol paths",
      environment: "edge of the known verification network, peering into unexplored chains",
    },
  },
} as const;

export type ArchetypeKey = keyof typeof ARCHETYPES;

// ─── Protocol-Grade Prompt Builder (from OpenArt spec) ─────────────────────
function buildCharacterPrompt(
  archetype: ArchetypeKey,
  context?: { brand?: string; object?: string; colorway?: string; mood?: string }
): { prompt: string; negativePrompt: string } {
  const arch = ARCHETYPES[archetype];
  const v = arch.visual;

  const brandLine = context?.brand
    ? `\nBrand affiliation: "${context.brand}" — incorporate subtle brand-aligned elements.`
    : "";
  const objectLine = context?.object
    ? `\nGuarding/representing: ${context.object}.`
    : "";
  const colorLine = context?.colorway
    ? `\nColor direction: ${context.colorway}.`
    : `\nPrimary color: ${arch.color}, with metallic accents and deep navy/charcoal background.`;
  const moodLine = context?.mood
    ? `\nMood: ${context.mood}.`
    : "\nMood: authoritative yet approachable, premium yet accessible.";

  const prompt = `Premium futuristic heraldic concept art of a protocol-grade digital character.

ROLE: ${v.role}
ARMOR/ATTIRE: ${v.armor}
SIGNATURE ELEMENT: ${v.weapon}
AURA: ${v.aura}
SETTING: ${v.environment}
${brandLine}${objectLine}${colorLine}${moodLine}

STYLE REQUIREMENTS:
- Clean vector-inspired digital art with subtle gradients
- Protocol-heraldic aesthetic: blockchain motifs, verification symbols, trust iconography
- Suitable for NFT minting: no text, no watermarks, no borders
- Square 1:1 aspect ratio, high detail, professional quality
- Character should embody trust, verification, and digital authority
- Background: abstract blockchain network pattern with subtle glow effects`;

  const negativePrompt = `text, watermark, signature, logo, border, frame, low quality, blurry, 
deformed, ugly, amateur, cartoon, anime, chibi, pixel art, voxel, 
photorealistic human face, photograph, stock photo, clip art,
violent, gore, nsfw, offensive symbols, real brand logos`;

  return { prompt, negativePrompt };
}

// ─── Character Generation ───────────────────────────────────────────────────
export async function startCharacterGeneration(
  userId: number,
  archetype: ArchetypeKey,
  context?: { brand?: string; object?: string; colorway?: string; mood?: string }
): Promise<{ generationId: number; prompt: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { prompt, negativePrompt } = buildCharacterPrompt(archetype, context);

  const [result] = await db.insert(characterGenerations).values({
    userId,
    archetype,
    style: "premium futuristic heraldic concept art",
    colorway: context?.colorway || null,
    mood: context?.mood || null,
    prompt,
    negativePrompt,
    provider: "built-in",
    providerModel: "image-gen-v1",
    variantCount: 4,
    status: "pending",
    context: context ? JSON.stringify(context) : null,
  });

  const generationId = result.insertId;

  // Start async generation (don't await - return immediately)
  generateVariants(generationId, prompt, archetype, userId).catch(err => {
    console.error(`[CharacterGen] Generation ${generationId} failed:`, err);
  });

  return { generationId, prompt };
}

async function generateVariants(
  generationId: number, prompt: string, archetype: ArchetypeKey, userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(characterGenerations)
    .set({ status: "generating" })
    .where(eq(characterGenerations.id, generationId));

  const variants: Array<{ imageUrl: string; variantPrompt: string }> = [];

  // Generate 4 variants with slight prompt variations (OpenArt pattern)
  const variations = [
    prompt,
    prompt + "\nEmphasis: power and authority, imposing presence.",
    prompt + "\nEmphasis: elegance and precision, refined details.",
    prompt + "\nEmphasis: dynamic energy and agility, motion lines.",
  ];

  for (const variantPrompt of variations) {
    try {
      const result = await generateImage({ prompt: variantPrompt });
      if (result.url) {
        variants.push({ imageUrl: result.url, variantPrompt });
      }
    } catch (err) {
      console.error(`[CharacterGen] Variant generation failed:`, err);
    }
  }

  if (variants.length === 0) {
    await db.update(characterGenerations)
      .set({ status: "failed" })
      .where(eq(characterGenerations.id, generationId));
    return;
  }

  // Insert assets and score them
  let bestScore = -1;
  let bestAssetId: number | null = null;

  for (const variant of variants) {
    const [assetResult] = await db.insert(characterAssets).values({
      generationId,
      userId,
      imageUrl: variant.imageUrl,
      prompt: variant.variantPrompt,
      mintStatus: "not_minted",
    });

    const assetId = assetResult.insertId;

    // Score and track best
    try {
      const score = await scoreCharacterAsset(assetId, variant.imageUrl, archetype);
      if (score > bestScore) {
        bestScore = score;
        bestAssetId = assetId;
      }
    } catch (err) {
      console.error(`[CharacterGen] Scoring failed for asset ${assetId}:`, err);
    }
  }

  // Mark best asset as recommended
  if (bestAssetId) {
    await db.update(characterAssets)
      .set({ isRecommended: 1 })
      .where(eq(characterAssets.id, bestAssetId));
  }

  await db.update(characterGenerations)
    .set({
      status: "completed",
      completedAt: new Date(),
      bestAssetId,
    })
    .where(eq(characterGenerations.id, generationId));
}

// ─── 7-Dimension Character Scoring (OpenArt Protocol) ──────────────────────
async function scoreCharacterAsset(
  assetId: number, imageUrl: string, archetype: ArchetypeKey
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert digital art evaluator for the AuthiChain protocol.
Score the character avatar on these 7 dimensions (0.0 to 10.0 scale, one decimal):

1. protocol_fit — Does the character embody the "${archetype}" role within a blockchain authentication protocol?
2. thumbnail_clarity — Is the character recognizable and impactful at 64×64 thumbnail size?
3. premium_feel — Does the art feel premium, polished, and worth minting as an NFT?
4. silhouette — Is the silhouette distinctive and instantly recognizable?
5. trust_symbolism — Does the design incorporate trust, verification, and authority symbols?
6. mint_readiness — Is the image clean (no artifacts, text, watermarks) and ready for on-chain minting?
7. ui_compatibility — Will it work well as an avatar in dashboards, leaderboards, and mobile UI?

Return ONLY a JSON object with these exact keys and float scores (e.g., 7.5).`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Score this ${archetype} character avatar for the AuthiChain protocol:` },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "character_score",
          strict: true,
          schema: {
            type: "object",
            properties: {
              protocol_fit: { type: "number" },
              thumbnail_clarity: { type: "number" },
              premium_feel: { type: "number" },
              silhouette: { type: "number" },
              trust_symbolism: { type: "number" },
              mint_readiness: { type: "number" },
              ui_compatibility: { type: "number" },
            },
            required: ["protocol_fit", "thumbnail_clarity", "premium_feel", "silhouette", "trust_symbolism", "mint_readiness", "ui_compatibility"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    const scoreText = typeof content === "string" ? content : "";
    const scores = JSON.parse(scoreText);

    // Calculate weighted total (out of 10)
    const totalScore = (
      scores.protocol_fit * 0.20 +
      scores.thumbnail_clarity * 0.15 +
      scores.premium_feel * 0.20 +
      scores.silhouette * 0.10 +
      scores.trust_symbolism * 0.15 +
      scores.mint_readiness * 0.10 +
      scores.ui_compatibility * 0.10
    );

    const roundedTotal = Math.round(totalScore * 100) / 100;

    await db.update(characterAssets)
      .set({
        protocolFitScore: String(scores.protocol_fit),
        thumbnailClarityScore: String(scores.thumbnail_clarity),
        premiumFeelScore: String(scores.premium_feel),
        silhouetteScore: String(scores.silhouette),
        trustSymbolismScore: String(scores.trust_symbolism),
        mintReadinessScore: String(scores.mint_readiness),
        uiCompatibilityScore: String(scores.ui_compatibility),
        totalScore: String(roundedTotal),
        // Also fill legacy integer scores (0-100 scale) for backward compat
        scoreIconity: Math.round(scores.protocol_fit * 10),
        scoreTrustClarity: Math.round(scores.trust_symbolism * 10),
        scorePremiumFeel: Math.round(scores.premium_feel * 10),
        scoreSilhouette: Math.round(scores.silhouette * 10),
        scoreUiCompat: Math.round(scores.ui_compatibility * 10),
        scoreMintReady: Math.round(scores.mint_readiness * 10),
        scoreProtocolAlign: Math.round(scores.protocol_fit * 10),
      })
      .where(eq(characterAssets.id, assetId));

    return roundedTotal;
  } catch (err) {
    console.error(`[CharacterGen] LLM scoring failed for asset ${assetId}:`, err);
    // Set default scores if LLM fails
    const defaultScore = "7.0";
    await db.update(characterAssets)
      .set({
        protocolFitScore: defaultScore, thumbnailClarityScore: defaultScore,
        premiumFeelScore: defaultScore, silhouetteScore: defaultScore,
        trustSymbolismScore: defaultScore, mintReadinessScore: defaultScore,
        uiCompatibilityScore: defaultScore, totalScore: defaultScore,
        scoreIconity: 70, scoreTrustClarity: 70, scorePremiumFeel: 70,
        scoreSilhouette: 70, scoreUiCompat: 70, scoreMintReady: 70,
        scoreProtocolAlign: 70,
      })
      .where(eq(characterAssets.id, assetId));
    return 7.0;
  }
}

// ─── Character Selection (from uploaded select route) ──────────────────────
export async function selectCharacterAsset(
  userId: number, assetId: number
): Promise<{ success: boolean; metadataHash?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership
  const [asset] = await db.select()
    .from(characterAssets)
    .innerJoin(characterGenerations, eq(characterAssets.generationId, characterGenerations.id))
    .where(and(eq(characterAssets.id, assetId), eq(characterGenerations.userId, userId)))
    .limit(1);

  if (!asset) throw new Error("Asset not found or not owned by user");

  // Deselect ALL previously selected assets for this user (OpenArt pattern)
  const userGens = await db.select({ id: characterGenerations.id })
    .from(characterGenerations)
    .where(eq(characterGenerations.userId, userId));

  for (const gen of userGens) {
    await db.update(characterAssets)
      .set({ isSelected: 0 })
      .where(eq(characterAssets.generationId, gen.id));
  }

  // Build NFT metadata
  const arch = ARCHETYPES[asset.character_generations.archetype as ArchetypeKey];
  const metadata = {
    name: `AuthiCharacter #${assetId} — ${arch?.name || asset.character_generations.archetype}`,
    description: `Protocol ${asset.character_generations.archetype} agent for the AuthiChain verification network. ${arch?.description || ""}`,
    image: asset.character_assets.imageUrl,
    external_url: "https://authichain-gpea3uhe.manus.space",
    attributes: [
      { trait_type: "Archetype", value: arch?.name || asset.character_generations.archetype },
      { trait_type: "Protocol Fit", value: parseFloat(asset.character_assets.protocolFitScore || "0"), display_type: "number" },
      { trait_type: "Thumbnail Clarity", value: parseFloat(asset.character_assets.thumbnailClarityScore || "0"), display_type: "number" },
      { trait_type: "Premium Feel", value: parseFloat(asset.character_assets.premiumFeelScore || "0"), display_type: "number" },
      { trait_type: "Silhouette", value: parseFloat(asset.character_assets.silhouetteScore || "0"), display_type: "number" },
      { trait_type: "Trust Symbolism", value: parseFloat(asset.character_assets.trustSymbolismScore || "0"), display_type: "number" },
      { trait_type: "Mint Readiness", value: parseFloat(asset.character_assets.mintReadinessScore || "0"), display_type: "number" },
      { trait_type: "UI Compatibility", value: parseFloat(asset.character_assets.uiCompatibilityScore || "0"), display_type: "number" },
      { trait_type: "Total Score", value: parseFloat(asset.character_assets.totalScore || "0"), display_type: "number" },
    ],
    protocol: "AuthiChain",
    version: "2.0",
  };

  const metadataJson = JSON.stringify(metadata);
  const metadataHash = crypto.createHash("sha256").update(metadataJson).digest("hex");
  const imageHash = crypto.createHash("sha256").update(asset.character_assets.imageUrl).digest("hex");

  // Upload metadata to S3
  const { url: metadataUri } = await storagePut(
    `character-metadata/${assetId}-${metadataHash.slice(0, 8)}.json`,
    Buffer.from(metadataJson),
    "application/json"
  );

  // Mark selected
  await db.update(characterAssets)
    .set({
      isSelected: 1,
      selectedAt: new Date(),
      metadataUri,
      metadataHash,
      imageHash,
      mintStatus: "preparing",
    })
    .where(eq(characterAssets.id, assetId));

  // Update generation status
  await db.update(characterGenerations)
    .set({ status: "selected", selectedAssetId: assetId })
    .where(eq(characterGenerations.id, asset.character_assets.generationId));

  return { success: true, metadataHash };
}

// ─── Mint Prep (from uploaded mint-prep route) ─────────────────────────────
export async function prepareMint(userId: number, assetId: number): Promise<{
  success: boolean;
  metadataUri: string;
  metadataHash: string;
  imageHash: string;
  imageUrl: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership and selection
  const [asset] = await db.select()
    .from(characterAssets)
    .innerJoin(characterGenerations, eq(characterAssets.generationId, characterGenerations.id))
    .where(and(
      eq(characterAssets.id, assetId),
      eq(characterGenerations.userId, userId),
      eq(characterAssets.isSelected, 1)
    ))
    .limit(1);

  if (!asset) throw new Error("Asset not found, not owned, or not selected");

  // Ensure metadata is ready
  if (!asset.character_assets.metadataUri || !asset.character_assets.metadataHash) {
    throw new Error("Asset metadata not prepared — select the asset first");
  }

  // Update mint status to queued
  await db.update(characterAssets)
    .set({ mintStatus: "queued" })
    .where(eq(characterAssets.id, assetId));

  // Update generation to mint_ready
  await db.update(characterGenerations)
    .set({ status: "mint_ready" })
    .where(eq(characterGenerations.id, asset.character_assets.generationId));

  return {
    success: true,
    metadataUri: asset.character_assets.metadataUri,
    metadataHash: asset.character_assets.metadataHash,
    imageHash: asset.character_assets.imageHash || "",
    imageUrl: asset.character_assets.imageUrl,
  };
}

// ─── Agent Creation ─────────────────────────────────────────────────────────
export async function createProtocolAgent(
  userId: number,
  characterAssetId: number,
  name: string,
  agentType: ArchetypeKey
): Promise<{ agentId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const arch = ARCHETYPES[agentType];

  const [result] = await db.insert(protocolAgents).values({
    userId,
    characterAssetId,
    name,
    agentType,
    status: "active",
    level: 1,
    xp: arch.baseXP,
    reputationScore: 100,
    featureScopes: JSON.stringify(arch.featureScopes),
    policyConfig: JSON.stringify({ autoVerify: false, minConfidence: 70 }),
  });

  return { agentId: result.insertId };
}

// ─── Agent Stats & Queries ──────────────────────────────────────────────────
export async function getAgentByUser(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [agent] = await db.select()
    .from(protocolAgents)
    .where(and(eq(protocolAgents.userId, userId), eq(protocolAgents.status, "active")))
    .orderBy(desc(protocolAgents.createdAt))
    .limit(1);

  return agent || null;
}

export async function getAgentLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(protocolAgents)
    .where(eq(protocolAgents.status, "active"))
    .orderBy(desc(protocolAgents.reputationScore), desc(protocolAgents.xp))
    .limit(limit);
}

export async function getGenerationStatus(generationId: number) {
  const db = await getDb();
  if (!db) return null;

  const [gen] = await db.select()
    .from(characterGenerations)
    .where(eq(characterGenerations.id, generationId))
    .limit(1);

  if (!gen) return null;

  const assets = await db.select()
    .from(characterAssets)
    .where(eq(characterAssets.generationId, generationId))
    .orderBy(desc(characterAssets.totalScore));

  return { ...gen, assets };
}

export async function getUserGenerations(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(characterGenerations)
    .where(eq(characterGenerations.userId, userId))
    .orderBy(desc(characterGenerations.createdAt));
}

export async function getUserCharacterAssets(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    asset: characterAssets,
    generation: characterGenerations,
  })
    .from(characterAssets)
    .innerJoin(characterGenerations, eq(characterAssets.generationId, characterGenerations.id))
    .where(eq(characterGenerations.userId, userId))
    .orderBy(desc(characterAssets.totalScore));
}

// ─── QRON Rewards ───────────────────────────────────────────────────────────
export async function awardQRON(
  agentId: number,
  userId: number,
  amount: string,
  reason: "verification_reward" | "consensus_participation" | "accuracy_bonus" | "streak_bonus" | "referral_reward" | "staking_yield" | "penalty",
  referenceType?: string,
  referenceId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(qronRewardLedger).values({
    agentId,
    userId,
    amount,
    reason,
    referenceType,
    referenceId,
    status: "pending",
  });

  await db.update(protocolAgents)
    .set({
      qronPending: sql`${protocolAgents.qronPending} + ${amount}`,
    })
    .where(eq(protocolAgents.id, agentId));
}

export async function getAgentRewards(agentId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(qronRewardLedger)
    .where(eq(qronRewardLedger.agentId, agentId))
    .orderBy(desc(qronRewardLedger.createdAt))
    .limit(limit);
}

// ─── Network Stats ──────────────────────────────────────────────────────────
export async function getNetworkStats() {
  const db = await getDb();
  if (!db) return {
    totalAgents: 0, totalVerifications: 0, totalConsensus: 0,
    totalQRONDistributed: "0", totalCheckpoints: 0,
    agentsByType: [], recentActivity: [],
  };

  const [agentCount] = await db.select({ count: count() }).from(protocolAgents);
  const [verifyCount] = await db.select({ count: count() }).from(verificationClaims);
  const [consensusCount] = await db.select({ count: count() }).from(consensusResults);
  const [checkpointCount] = await db.select({ count: count() }).from(checkpointBatches);

  const [qronSum] = await db.select({
    total: sql<string>`COALESCE(SUM(${qronRewardLedger.amount}), 0)`,
  }).from(qronRewardLedger);

  const agentsByType = await db.select({
    agentType: protocolAgents.agentType,
    count: count(),
  })
    .from(protocolAgents)
    .where(eq(protocolAgents.status, "active"))
    .groupBy(protocolAgents.agentType);

  const recentAgents = await db.select()
    .from(protocolAgents)
    .orderBy(desc(protocolAgents.createdAt))
    .limit(10);

  return {
    totalAgents: agentCount?.count || 0,
    totalVerifications: verifyCount?.count || 0,
    totalConsensus: consensusCount?.count || 0,
    totalQRONDistributed: qronSum?.total || "0",
    totalCheckpoints: checkpointCount?.count || 0,
    agentsByType,
    recentActivity: recentAgents,
  };
}

// ─── Verification & Consensus ───────────────────────────────────────────────
export async function submitVerificationClaim(
  agentId: number,
  productId: number,
  authenticationId: number | null,
  claimType: "authentic" | "counterfeit" | "inconclusive" | "needs_review",
  confidence: number,
  evidence?: Record<string, unknown>,
  reasoning?: string
): Promise<{ claimId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [agent] = await db.select()
    .from(protocolAgents)
    .where(eq(protocolAgents.id, agentId))
    .limit(1);

  const weight = agent?.reputationScore ? (agent.reputationScore / 100).toFixed(3) : "1.000";

  const [result] = await db.insert(verificationClaims).values({
    agentId,
    productId,
    authenticationId,
    claimType,
    confidence,
    evidence: evidence ? JSON.stringify(evidence) : null,
    reasoning,
    weight,
    status: "pending",
  });

  await db.update(protocolAgents)
    .set({
      totalClaims: sql`${protocolAgents.totalClaims} + 1`,
      xp: sql`${protocolAgents.xp} + 10`,
    })
    .where(eq(protocolAgents.id, agentId));

  await awardQRON(agentId, agent?.userId || 0, "0.50", "verification_reward", "claim", result.insertId);

  return { claimId: result.insertId };
}

/**
 * Reward user's agent for completing a verification (called from authenticate.analyze)
 */
export async function rewardAgentForVerification(userId: number, wasSuccessful: boolean) {
  const db = await getDb();
  if (!db) return;
  const [agent] = await db.select().from(protocolAgents).where(eq(protocolAgents.userId, userId)).limit(1);
  if (!agent) return;

  const xpReward = wasSuccessful ? 25 : 10;
  const qronReward = wasSuccessful ? "1.00" : "0.25";

  const updateSet: Record<string, any> = {
    totalVerifications: sql`${protocolAgents.totalVerifications} + 1`,
    xp: sql`${protocolAgents.xp} + ${xpReward}`,
  };
  if (wasSuccessful) {
    updateSet.successfulVerifications = sql`${protocolAgents.successfulVerifications} + 1`;
  }

  await db.update(protocolAgents)
    .set(updateSet)
    .where(eq(protocolAgents.id, agent.id));

  await awardQRON(agent.id, userId, qronReward, "verification_reward", "verification", 0);
  console.log(`[Agent XP] User ${userId} agent ${agent.id} earned ${xpReward} XP + ${qronReward} QRON`);
}

export { ARCHETYPES };
