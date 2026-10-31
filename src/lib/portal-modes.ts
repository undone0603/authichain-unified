export const PORTAL_MODES = {
  // QRON Launch Pack modes (one of 3 portals; consume 1 generation)
  stellar_seal_certificate: {
    id: "stellar_seal_certificate",
    name: "Stellar Seal Certificate Portal",
    pack: "launch_pack",
    promptSeed: "Living QR portal for a Polygon NFT authenticity certificate. Show product photo, seal status, chain-of-custody timeline, and one-tap verify CTA. Dark luxury + metallic seal accent.",
    style: "high-contrast, certificate-grade typography, subtle holographic edge",
    visualConcept: "holographic seal on dark luxury background",
    pricingIdea: "counts as 1 of 3 portals; upsell Studio for regen",
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
  // AuthiChain Starter modes (consume from existing 100/500 gen or seal quota)
  api_first_verification: {
    id: "api_first_verification",
    name: "API-First Verification Mode",
    pack: "b2b_starter",
    promptSeed: "Headless /verify calls only; no portal UI. Quota consumed on authentication.",
    style: "none (API)",
    visualConcept: "none",
  },
  compliance_audit_log: {
    id: "compliance_audit_log",
    name: "Compliance Audit Log Mode",
    pack: "b2b_starter",
    promptSeed: "Every authentication writes an immutable log entry (timestamp, result, image hash, operator). Exportable CSV for the 500-call window.",
    style: "structured log table",
    visualConcept: "audit trail export",
  },
  partner_white_label_seal: {
    id: "partner_white_label_seal",
    name: "Partner White-Label Seal Mode",
    pack: "b2b_starter",
    promptSeed: "Starter plan with brand-locked seal colors and domain. Still 500 authentications; no extra portals.",
    style: "brand-locked colors",
    visualConcept: "custom seal accent",
  },
} as const;

export type PortalModeKey = keyof typeof PORTAL_MODES;

export function isPortalMode(mode: string): mode is PortalModeKey {
  return mode in PORTAL_MODES;
}

export function getPortalMode(mode: string) {
  return isPortalMode(mode) ? PORTAL_MODES[mode] : undefined;
}
