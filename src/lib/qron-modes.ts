export const PORTAL_MODES = {
  stellar_seal_certificate: {
    id: "stellar_seal_certificate",
    name: "Stellar Seal Certificate Portal",
    pack: "launch_pack",
    promptSeed: "Living QR portal for a Polygon NFT authenticity certificate. Show product photo, holographic seal status, chain-of-custody timeline, and one-tap verify CTA. Dark luxury + metallic seal accent.",
    style: "high-contrast, certificate-grade typography, subtle holographic edge",
    visualConcept: "holographic seal on dark luxury background",
  },
  batch_product_verification: {
    id: "batch_product_verification",
    name: "Batch Product Verification Mode",
    pack: "launch_pack",
    promptSeed: "QR that opens a multi-item scan sheet. Each row = SKU + photo + authenticity badge + last-scan timestamp. Optimized for warehouse or retail counter.",
    style: "clean table + status chips (Verified / Pending / Flagged)",
    visualConcept: "status-chip table layout",
  },
  limited_edition_drop: {
    id: "limited_edition_drop",
    name: "Limited-Edition Drop Portal",
    pack: "launch_pack",
    promptSeed: "Time-gated living QR for a product drop. Countdown, scarcity counter, owner wallet check, and post-drop provenance feed.",
    style: "event-like, high-energy but still premium",
    visualConcept: "countdown + scarcity meter",
  },
  stellar_seal_luxury_unbox: {
    id: "stellar_seal_luxury_unbox",
    name: "Stellar Seal Luxury Unbox",
    pack: "launch_pack",
    promptSeed: "Cinematic unboxing sequence. Hero product photo, floating holographic Stellar Seal, ownership transfer timeline, one-tap verify. Dark metallic + soft gold accents.",
    style: "high-contrast cinematic, holographic seal edge, premium serif + sans",
    visualConcept: "unboxing still with floating holographic seal",
  },
  chain_of_custody_timeline: {
    id: "chain_of_custody_timeline",
    name: "Chain-of-Custody Timeline Portal",
    pack: "launch_pack",
    promptSeed: "Immutable vertical timeline of custody events. Each node: timestamp, actor, image hash, Stellar Seal status. For collectors and secondary market.",
    style: "clean vertical timeline + status badges",
    visualConcept: "timeline with seal checkpoints",
  },
} as const;

export type PortalModeKey = keyof typeof PORTAL_MODES;
