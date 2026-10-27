export const PORTAL_MODES = {
  stellar_seal_certificate: {
    id: "stellar_seal_certificate",
    name: "Stellar Seal Certificate Portal",
    pack: "starter",
    promptSeed:
      "Living QR portal for a product authenticity claim. Show product photo, seal status, chain-of-custody timeline, and one-tap verify CTA. Dark luxury + metallic seal accent. A scannable QR is not an authenticity proof.",
    style: "high-contrast, certificate-grade typography, subtle holographic edge",
    visualConcept: "holographic seal on dark luxury background",
    pricingNote: "Uses 1 generation from $29 Starter (100) or $99 Creator (500)",
  },
  batch_product_verification: {
    id: "batch_product_verification",
    name: "Batch Product Verification Mode",
    pack: "starter",
    promptSeed:
      "QR that opens a multi-item scan sheet. Each row = SKU + photo + status chip (Verified / Pending / Flagged) + last-scan timestamp. Warehouse or retail counter layout.",
    style: "clean table + status chips",
    visualConcept: "status-chip table layout",
    pricingNote: "Uses 1 generation from $29 Starter or $99 Creator",
  },
  limited_edition_drop: {
    id: "limited_edition_drop",
    name: "Limited-Edition Drop Portal",
    pack: "starter",
    promptSeed:
      "Time-gated living QR for a product drop. Countdown, scarcity counter, and post-drop feed. Premium event styling.",
    style: "high-energy premium, countdown + scarcity meter",
    visualConcept: "countdown + scarcity meter",
    pricingNote: "Uses 1 generation from $29 Starter or $99 Creator",
  },
  strainchain_coa_jar: {
    id: "strainchain_coa_jar",
    name: "StrainChain COA Jar Portal",
    pack: "starter",
    promptSeed:
      "Living QR for a cannabis jar. Product photo, COA summary (totals recomputed from panel), seal status, chain-of-custody, verify CTA. Dark luxury + metallic green accent. Cannabis claims require licensed review. Not a METRC integration.",
    style: "jar hero, subtle holographic edge, status chips",
    visualConcept: "flux_strainchain style jar + COA overlay",
    pricingNote: "Uses 1 generation; passport checkout is separate $49",
  },
  govchain_contractor_seal: {
    id: "govchain_contractor_seal",
    name: "GovChain Contractor Seal Portal",
    pack: "starter",
    promptSeed:
      "Living QR for contractor pursue + seals. Photo, seal status, compliance timeline, one-tap verify. Neutral professional + metallic accent. No FedRAMP, FDA, or certification claims.",
    style: "clean certificate typography, status chips",
    visualConcept: "professional seal on neutral dark background",
    pricingNote: "Uses 1 generation from $29 Starter or $99 Creator",
  },
  api_first_verification: {
    id: "api_first_verification",
    name: "API-First Verification Mode",
    pack: "creator",
    promptSeed: "Headless verify path. No portal UI. Quota consumed on authentication call.",
    style: "none (API)",
    visualConcept: "none",
    pricingNote: "Consumes from Creator pack or x402 $0.05 USDC agent rail",
  },
  compliance_audit_log: {
    id: "compliance_audit_log",
    name: "Compliance Audit Log Mode",
    pack: "creator",
    promptSeed:
      "Every authentication writes an immutable log entry (timestamp, result, image hash, operator). Exportable CSV.",
    style: "structured log table",
    visualConcept: "audit trail export",
    pricingNote: "Uses generations from $99 Creator pack",
  },
  partner_white_label_seal: {
    id: "partner_white_label_seal",
    name: "Partner White-Label Seal Mode",
    pack: "creator",
    promptSeed:
      "Brand-locked seal colors and domain on generated portal. Still consumes pack generations. No extra portals.",
    style: "brand-locked colors",
    visualConcept: "custom seal accent",
    pricingNote: "Uses generations from $99 Creator pack",
  },
} as const;

export type PortalModeKey = keyof typeof PORTAL_MODES;
