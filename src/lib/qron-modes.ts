/**
 * QRON selectable generation modes / prompt templates.
 *
 * Aligned to live packs in src/lib/plans.ts (2026-10-24):
 *   - starter: $29 one-time / 100 generations
 *   - qron_launch: $19/mo / 100 generations/mo
 *   - creator: $99 one-time / 500 generations
 *
 * Modes are free selectable templates inside paid packs. Zero incremental
 * COGS if they reuse the existing image-gen pipeline. Self-serve: user picks
 * a mode on /generate, prompt seed is applied, generation consumes one credit.
 *
 * Not a new SKU. Do not invent traffic or conversion numbers.
 */

export type ModeId =
  | "stellar_seal"
  | "batch_verify"
  | "limited_drop"
  | "living_portal"
  | "compliance_log"
  | "partner_whitelabel";

export interface GenerationMode {
  id: ModeId;
  name: string;
  promptSeed: string;
  style: string;
  includedIn: Array<"starter" | "qron_launch" | "creator">;
  upgradeHint?: string;
}

export const QRON_MODES: Record<ModeId, GenerationMode> = {
  stellar_seal: {
    id: "stellar_seal",
    name: "Stellar Seal Certificate Portal",
    promptSeed:
      "Living QR portal for a Polygon NFT authenticity certificate. Show product photo, seal status, chain-of-custody timeline, and one-tap verify CTA. Dark luxury + metallic seal accent.",
    style:
      "high-contrast, certificate-grade typography, subtle holographic edge, premium dark palette",
    includedIn: ["starter", "qron_launch", "creator"],
    upgradeHint: "Unlock Stellar Seal templates with Starter Pack — $29 for 100 generations.",
  },
  batch_verify: {
    id: "batch_verify",
    name: "Batch Product Verification Mode",
    promptSeed:
      "QR that opens a multi-item scan sheet. Each row = SKU + photo + authenticity badge + last-scan timestamp. Optimized for warehouse or retail counter.",
    style: "clean table layout, status chips (Verified / Pending / Flagged), high scannability",
    includedIn: ["starter", "qron_launch", "creator"],
  },
  limited_drop: {
    id: "limited_drop",
    name: "Limited-Edition Drop Portal",
    promptSeed:
      "Time-gated living QR for a product drop. Countdown, scarcity counter, owner wallet check, and post-drop provenance feed.",
    style: "event-like high-energy but premium, countdown overlay, scarcity indicators",
    includedIn: ["starter", "qron_launch", "creator"],
  },
  living_portal: {
    id: "living_portal",
    name: "Living Brand Portal",
    promptSeed:
      "Scannable living QR that opens a brand story page with product gallery, editable redirect, and scan analytics teaser.",
    style: "brand-forward, mobile-first, clear primary CTA, L4 error correction safe",
    includedIn: ["starter", "qron_launch", "creator"],
  },
  compliance_log: {
    id: "compliance_log",
    name: "Compliance Audit Log Mode",
    promptSeed:
      "Every authentication writes an immutable log entry (timestamp, result, image hash, operator). Exportable CSV for the generation window.",
    style: "utilitarian dashboard, timestamped rows, export button, audit-ready",
    includedIn: ["qron_launch", "creator"],
  },
  partner_whitelabel: {
    id: "partner_whitelabel",
    name: "Partner White-Label Seal Mode",
    promptSeed:
      "Brand-locked seal colors and domain on the living QR. Still consumes standard generation credits. No extra portals.",
    style: "custom brand palette injection, locked logo placement, premium feel",
    includedIn: ["creator"],
  },
} as const;

export function modesForPlan(planId: "starter" | "qron_launch" | "creator" | "free"): GenerationMode[] {
  if (planId === "free") return [];
  return Object.values(QRON_MODES).filter((m) => m.includedIn.includes(planId));
}

export function applyMode(userPrompt: string, modeId: ModeId): string {
  const mode = QRON_MODES[modeId];
  if (!mode) return userPrompt;
  return `${mode.promptSeed}\n\nUser request: ${userPrompt}\nStyle: ${mode.style}`;
}
