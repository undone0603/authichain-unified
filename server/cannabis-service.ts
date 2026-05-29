/**
 * AuthiChain Cannabis Intelligence Service
 * Ported from Premium Branch to Unified Stack.
 * Calculates rarity scores and formats industrial metadata for 
 * Bitcoin L1 Inscriptions.
 */

export interface CannabinoidProfile {
  thc: number;
  thca: number;
  cbd: number;
  cbda: number;
  total: number;
}

export interface StrainMetadata {
  name: string;
  type: 'INDICA' | 'SATIVA' | 'HYBRID';
  genetics: string[];
  thcContent: number;
  cbdContent: number;
  harvestDate: string;
}

/**
 * Calculates a proprietary Rarity Score (0-100) for a strain.
 * Used to justify premium pricing for Michigan craft operators.
 */
export function calculateStrainRarity(metadata: StrainMetadata, profile: CannabinoidProfile): number {
  let score = 50; // Base score

  // THC Thresholds
  if (profile.thc > 30) score += 25;
  else if (profile.thc > 25) score += 15;
  else if (profile.thc > 20) score += 10;

  // CBD Rarity
  if (profile.cbd > 10) score += 20;

  // Genetics Complexity
  if (metadata.genetics.length > 2) score += 10;

  // Harvest Freshness (Bonus for recent harvests)
  const harvestTime = new Date(metadata.harvestDate).getTime();
  const now = new Date().getTime();
  if (now - harvestTime < 30 * 24 * 60 * 60 * 1000) {
    score += 5; // Freshness bonus
  }

  return Math.min(score, 100);
}

/**
 * Formats metadata for a Bitcoin L1 Inscription.
 * This is the "Truth Layer" payload.
 */
export function formatTruthLayerMetadata(metadata: StrainMetadata, profile: CannabinoidProfile) {
  const rarity = calculateStrainRarity(metadata, profile);
  
  return {
    inscription_type: "AuthiChain_StrainChain_v1",
    product: metadata.name,
    type: metadata.type,
    metrics: {
      thc: `${profile.thc}%`,
      cbd: `${profile.cbd}%`,
      rarity_score: `${rarity}/100`
    },
    blockchain_proof: {
      l1: "Bitcoin (Ordinals)",
      l2: "Polygon (NFT)",
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Gets the UI color associated with a strain type.
 */
export function getStrainColor(type: string) {
  const colors: Record<string, string> = {
    'INDICA': '#a855f7', // Purple
    'SATIVA': '#22c55e', // Green
    'HYBRID': '#f97316'  // Orange
  };
  return colors[type] || '#94a3b8';
}
