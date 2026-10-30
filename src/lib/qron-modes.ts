// src/lib/qron-modes.ts
// Modes map to live packs in src/lib/plans.ts.
// Live listed packs: starter ($29/100 one-time), creator ($99/500 one-time).
// qron_launch ($19/mo) and qron_launch_annual ($190/yr) exist in Stripe but listed: false.
// Do not gate modes on unlisted SKUs. Do not invent $39 or $199/mo.

export type ModePack = "free" | "starter" | "creator";

export const QRON_MODES = {
  stellar_seal_certificate: {
    id: "stellar_seal_certificate",
    name: "Stellar Seal Certificate Portal",
    pack: "starter" as ModePack,
    promptSeed:
      "Living QR portal for a product authenticity claim. Show product photo, holographic Stellar Seal, chain-of-custody timeline with timestamps, and one-tap verify CTA. Dark navy/black background, metallic gold accents, certificate-grade typography, subtle glassmorphism.",
    style: "high-contrast certificate typography, holographic edge, metallic seal",
    visualConcept: "holographic seal + vertical timeline on dark luxury canvas",
  },
  batch_product_verification: {
    id: "batch_product_verification",
    name: "Batch Product Verification",
    pack: "starter" as ModePack,
    promptSeed:
      "QR that opens a multi-item scan sheet. Each row: SKU + photo thumbnail + status chip (Verified / Pending / Flagged) + last-scan timestamp. Clean table optimized for warehouse tablet or retail counter.",
    style: "clean data table + colored status chips",
    visualConcept: "status-chip table layout",
  },
  limited_edition_drop: {
    id: "limited_edition_drop",
    name: "Limited-Edition Drop Portal",
    pack: "starter" as ModePack,
    promptSeed:
      "Time-gated living QR for a product drop. Large countdown, scarcity meter, simple claim or wallet check, post-drop provenance note. High-energy but premium, metallic accents.",
    style: "event landing, bold countdown typography, metallic accents",
    visualConcept: "countdown + scarcity meter",
  },
  patriotic_made_in_usa_seal: {
    id: "patriotic_made_in_usa_seal",
    name: "Patriotic Made-in-USA Seal",
    pack: "starter" as ModePack,
    promptSeed:
      "Scannable QRON seal with American flag pattern woven into QR matrix, golden eagle silhouette, MADE IN USA border, product photo, verification status and green checkmark CTA. Premium embossed look.",
    style: "patriotic red-white-blue + gold, high-contrast, commercial product photography",
    visualConcept: "flag-woven QR matrix + eagle seal on product",
  },
  collector_provenance_feed: {
    id: "collector_provenance_feed",
    name: "Collector Provenance Feed",
    pack: "creator" as ModePack,
    promptSeed:
      "Living QR for collectibles. Owner check, sequential provenance feed of past authentications, scarcity counter, transfer history. Dark luxury + metallic accents.",
    style: "feed/timeline layout, status chips, premium typography",
    visualConcept: "scarcity meter + chronological ownership feed",
  },
  white_label_brand_seal: {
    id: "white_label_brand_seal",
    name: "White-Label Brand Seal",
    pack: "starter" as ModePack,
    promptSeed:
      "Brand-locked seal portal: custom accent colors, logo placement, product photo + simple verify CTA. Clean certificate layout.",
    style: "brand-locked colors, clean certificate layout",
    visualConcept: "custom color seal on product hero",
  },
} as const;

export type QronModeId = keyof typeof QRON_MODES;

export function isQronModeId(value: unknown): value is QronModeId {
  return typeof value === "string" && value in QRON_MODES;
}

export function modePrompt(modeId: QronModeId, userPrompt?: string): string {
  const m = QRON_MODES[modeId];
  const user = userPrompt?.trim();
  return user ? `${m.promptSeed}\n\nUser request: ${user}` : m.promptSeed;
}

export function modeCards() {
  return Object.values(QRON_MODES).map(m => ({
    id: m.id,
    title: m.name,
    subtitle: m.visualConcept,
    pack: m.pack,
    promptSeed: m.promptSeed,
  }));
}
