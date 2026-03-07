/**
 * AuthiCharacter Generation Service
 * 
 * Handles: AI character generation, multi-dimensional scoring,
 * mint-prep pipeline, agent creation, QRON reward distribution,
 * and consensus verification.
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

// ─── Archetype Definitions ──────────────────────────────────────────────────
const ARCHETYPES = {
  guardian: {
    name: "Guardian",
    description: "Protects brand integrity and product authenticity",
    promptStyle: "noble shield-bearing protector with glowing verification sigils, armored in crystalline blockchain plates",
    color: "#3B82F6",
    baseXP: 100,
    featureScopes: ["verify", "protect", "alert"],
  },
  archivist: {
    name: "Archivist",
    description: "Records and preserves provenance data on-chain",
    promptStyle: "ancient scholar with floating holographic scrolls, robed in data-stream fabric with golden chain links",
    color: "#8B5CF6",
    baseXP: 80,
    featureScopes: ["record", "archive", "query"],
  },
  sentinel: {
    name: "Sentinel",
    description: "Monitors supply chain integrity in real-time",
    promptStyle: "vigilant watchtower entity with radar-like scanning eyes, armored in sensor-mesh with pulsing IoT nodes",
    color: "#EF4444",
    baseXP: 120,
    featureScopes: ["monitor", "detect", "respond"],
  },
  scout: {
    name: "Scout",
    description: "Discovers counterfeits and maps threat networks",
    promptStyle: "agile reconnaissance figure with magnifying lens eye, cloaked in stealth-mesh with network mapping trails",
    color: "#10B981",
    baseXP: 90,
    featureScopes: ["scan", "discover", "map"],
  },
  arbiter: {
    name: "Arbiter",
    description: "Resolves disputes and renders consensus verdicts",
    promptStyle: "judicial figure with balanced scales of verification, robed in consensus-weave with gavel of finality",
    color: "#F59E0B",
    baseXP: 150,
    featureScopes: ["judge", "resolve", "settle"],
  },
} as const;

export type ArchetypeKey = keyof typeof ARCHETYPES;

// ─── Prompt Builder ─────────────────────────────────────────────────────────
function buildCharacterPrompt(archetype: ArchetypeKey, context?: { brand?: string; object?: string }): string {
  const arch = ARCHETYPES[archetype];
  const brandContext = context?.brand ? `, representing the brand "${context.brand}"` : "";
  const objectContext = context?.object ? `, guarding a ${context.object}` : "";

  return `Create a protocol-grade digital character avatar for a blockchain authentication platform. 
Style: Protocol-heraldic, premium digital art, clean vector-style with subtle gradients.
Character: ${arch.promptStyle}${brandContext}${objectContext}.
The character should embody trust, verification, and digital authority.
Background: Abstract blockchain network pattern with subtle glow effects.
Color palette: Primary ${arch.color}, with metallic accents and deep navy/charcoal background.
Aspect ratio: Square (1:1), suitable for NFT minting and UI avatar use.
No text, no watermarks, no borders. High detail, professional quality.`;
}

// ─── Character Generation ───────────────────────────────────────────────────
export async function startCharacterGeneration(
  userId: number,
  archetype: ArchetypeKey,
  context?: { brand?: string; object?: string }
): Promise<{ generationId: number; prompt: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const prompt = buildCharacterPrompt(archetype, context);

  const [result] = await db.insert(characterGenerations).values({
    userId,
    archetype,
    style: "protocol-heraldic",
    prompt,
    model: "image-gen-v1",
    variantCount: 4,
    status: "pending",
    context: context ? JSON.stringify(context) : null,
  });

  const generationId = result.insertId;

  // Start async generation (don't await - return immediately)
  generateVariants(generationId, prompt, archetype).catch(err => {
    console.error(`[CharacterGen] Generation ${generationId} failed:`, err);
  });

  return { generationId, prompt };
}

async function generateVariants(generationId: number, prompt: string, archetype: ArchetypeKey): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(characterGenerations)
    .set({ status: "generating" })
    .where(eq(characterGenerations.id, generationId));

  const variants: Array<{ imageUrl: string }> = [];

  // Generate 4 variants with slight prompt variations
  const variations = [
    prompt,
    prompt + " Emphasize power and authority.",
    prompt + " Emphasize elegance and precision.",
    prompt + " Emphasize speed and agility.",
  ];

  for (const variantPrompt of variations) {
    try {
      const result = await generateImage({ prompt: variantPrompt });
      if (result.url) {
        variants.push({ imageUrl: result.url });
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
  for (const variant of variants) {
    const [assetResult] = await db.insert(characterAssets).values({
      generationId,
      imageUrl: variant.imageUrl,
      mintStatus: "not_minted",
    });

    // Score asynchronously
    scoreCharacterAsset(assetResult.insertId, variant.imageUrl, archetype).catch(err => {
      console.error(`[CharacterGen] Scoring failed for asset ${assetResult.insertId}:`, err);
    });
  }

  await db.update(characterGenerations)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(characterGenerations.id, generationId));
}

// ─── Character Scoring ──────────────────────────────────────────────────────
async function scoreCharacterAsset(assetId: number, imageUrl: string, archetype: ArchetypeKey): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert digital art evaluator for a blockchain authentication protocol. 
Score the character avatar image on these 7 dimensions (0-100 each):
1. iconity - How iconic and memorable is the design?
2. trust_clarity - Does it convey trust and verification authority?
3. premium_feel - Does it feel premium and professional?
4. silhouette - Is the silhouette distinctive and recognizable?
5. ui_compat - Will it work well as a small avatar in UI?
6. mint_ready - Is it suitable for NFT minting (clean, no artifacts)?
7. protocol_align - Does it align with the "${archetype}" archetype role?

Return ONLY a JSON object with these exact keys and integer scores.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Score this ${archetype} character avatar:` },
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
              iconity: { type: "integer" },
              trust_clarity: { type: "integer" },
              premium_feel: { type: "integer" },
              silhouette: { type: "integer" },
              ui_compat: { type: "integer" },
              mint_ready: { type: "integer" },
              protocol_align: { type: "integer" },
            },
            required: ["iconity", "trust_clarity", "premium_feel", "silhouette", "ui_compat", "mint_ready", "protocol_align"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    const scoreText = typeof content === "string" ? content : "";
    const scores = JSON.parse(scoreText);

    const totalScore = Math.round(
      (scores.iconity + scores.trust_clarity + scores.premium_feel +
        scores.silhouette + scores.ui_compat + scores.mint_ready + scores.protocol_align) / 7
    );

    await db.update(characterAssets)
      .set({
        scoreIconity: scores.iconity,
        scoreTrustClarity: scores.trust_clarity,
        scorePremiumFeel: scores.premium_feel,
        scoreSilhouette: scores.silhouette,
        scoreUiCompat: scores.ui_compat,
        scoreMintReady: scores.mint_ready,
        scoreProtocolAlign: scores.protocol_align,
        totalScore,
        isRecommended: totalScore >= 75 ? 1 : 0,
      })
      .where(eq(characterAssets.id, assetId));
  } catch (err) {
    console.error(`[CharacterGen] LLM scoring failed for asset ${assetId}:`, err);
    // Set default scores if LLM fails
    const defaultScore = 70;
    await db.update(characterAssets)
      .set({
        scoreIconity: defaultScore, scoreTrustClarity: defaultScore,
        scorePremiumFeel: defaultScore, scoreSilhouette: defaultScore,
        scoreUiCompat: defaultScore, scoreMintReady: defaultScore,
        scoreProtocolAlign: defaultScore, totalScore: defaultScore,
      })
      .where(eq(characterAssets.id, assetId));
  }
}

// ─── Character Selection & Mint Prep ────────────────────────────────────────
export async function selectCharacterAsset(userId: number, assetId: number): Promise<{ success: boolean; metadataHash?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify ownership
  const [asset] = await db.select()
    .from(characterAssets)
    .innerJoin(characterGenerations, eq(characterAssets.generationId, characterGenerations.id))
    .where(and(eq(characterAssets.id, assetId), eq(characterGenerations.userId, userId)))
    .limit(1);

  if (!asset) throw new Error("Asset not found or not owned by user");

  // Deselect any previously selected assets for this user's generations
  const userGens = await db.select({ id: characterGenerations.id })
    .from(characterGenerations)
    .where(eq(characterGenerations.userId, userId));

  for (const gen of userGens) {
    await db.update(characterAssets)
      .set({ isSelected: 0 })
      .where(eq(characterAssets.generationId, gen.id));
  }

  // Build metadata for mint
  const metadata = {
    name: `AuthiCharacter #${assetId}`,
    description: `Protocol ${asset.character_generations.archetype} agent for the AuthiChain verification network`,
    image: asset.character_assets.imageUrl,
    attributes: [
      { trait_type: "Archetype", value: asset.character_generations.archetype },
      { trait_type: "Iconity", value: asset.character_assets.scoreIconity || 0 },
      { trait_type: "Trust Clarity", value: asset.character_assets.scoreTrustClarity || 0 },
      { trait_type: "Premium Feel", value: asset.character_assets.scorePremiumFeel || 0 },
      { trait_type: "Total Score", value: asset.character_assets.totalScore || 0 },
    ],
    protocol: "AuthiChain",
    version: "1.0",
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

  return { success: true, metadataHash };
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

  const gens = await db.select()
    .from(characterGenerations)
    .where(eq(characterGenerations.userId, userId))
    .orderBy(desc(characterGenerations.createdAt));

  return gens;
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

  // Update agent's pending QRON
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

  // Get agent's reputation weight
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

  // Update agent stats
  await db.update(protocolAgents)
    .set({
      totalClaims: sql`${protocolAgents.totalClaims} + 1`,
      xp: sql`${protocolAgents.xp} + 10`,
    })
    .where(eq(protocolAgents.id, agentId));

  // Award QRON for verification
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
  if (!agent) return; // User has no agent yet

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
