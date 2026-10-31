/**
 * QRON selectable generation modes (visual style templates).
 *
 * Modes are free style presets inside the existing packs: each generation
 * costs 1 normal credit (1 generation = 1 credit). Not a new SKU. Live paid
 * path: Starter Pack, 100 generations for $29, paid once.
 *
 * Seeds and styles describe visual style only. No feature promises.
 */

export type ModeId = "stellar_seal" | "batch_verify" | "limited_drop";

export interface GenerationMode {
  id: ModeId;
  name: string;
  promptSeed: string;
  style: string;
}

/**
 * Display names for the three selectable modes. ONE place to rename them
 * (Marketing, 2026-10-24: Stellar Art, Batch Create, Limited Drop). The ids
 * below are internal only and never shown to buyers.
 */
export const MODE_DISPLAY_NAMES = {
  stellar_seal: "Stellar Art",
  batch_verify: "Batch Create",
  limited_drop: "Limited Drop",
} as const;

export type SelectableModeId = ModeId;

/** URL slugs for ?mode=<slug> on /generate (per Marketing copy). */
export const MODE_SLUGS: Record<SelectableModeId, string> = {
  stellar_seal: "stellar-art",
  batch_verify: "batch-create",
  limited_drop: "limited-drop",
};

export const SELECTABLE_MODE_IDS = Object.keys(MODE_DISPLAY_NAMES) as SelectableModeId[];

/** Starter Pack checkout (existing live path; no new SKU). */
export const STARTER_CHECKOUT_URL = "https://authichain.com/checkout/starter";

export const QRON_MODES: Record<ModeId, GenerationMode> = {
  stellar_seal: {
    id: "stellar_seal",
    name: MODE_DISPLAY_NAMES.stellar_seal,
    promptSeed:
      "Art-styled QR for one hero product or design: starfield and metallic accents woven around the code.",
    style: "high-contrast, premium dark palette, subtle holographic edge, keep modules scannable",
  },
  batch_verify: {
    id: "batch_verify",
    name: MODE_DISPLAY_NAMES.batch_verify,
    promptSeed:
      "Clean, consistent QR art meant to look uniform across a set of products.",
    style: "minimal geometric pattern, neutral palette, high scannability",
  },
  limited_drop: {
    id: "limited_drop",
    name: MODE_DISPLAY_NAMES.limited_drop,
    promptSeed:
      "QR art styled for a time-limited release or drop event.",
    style: "high-energy but premium, bold color accents, keep modules scannable",
  },
};

/** Modes are available to every visitor, including free samples. */
export function modesForPlan(_planId: "starter" | "creator" | "free"): GenerationMode[] {
  return Object.values(QRON_MODES);
}

export function applyMode(userPrompt: string, modeId: ModeId): string {
  const mode = QRON_MODES[modeId];
  if (!mode) return userPrompt;
  return `${mode.promptSeed}\n\nUser request: ${userPrompt}\nStyle: ${mode.style}`;
}

/**
 * Parses a selectable mode from an id ("stellar_seal") or slug
 * ("stellar-art"). Anything else (including render modes like "static")
 * returns null, so callers keep their existing behavior.
 */
export function parseSelectableMode(value: unknown): SelectableModeId | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  for (const id of SELECTABLE_MODE_IDS) {
    if (v === id || v === MODE_SLUGS[id]) return id;
  }
  return null;
}

/** /generate link that preselects a mode, with UTM tags. */
export function modeGenerateUrl(
  id: SelectableModeId | null,
  utm: { source: string; medium: string; campaign: string; content?: string },
  base = "https://qron.space/generate",
): string {
  const u = new URL(base);
  if (id) u.searchParams.set("mode", MODE_SLUGS[id]);
  u.searchParams.set("utm_source", utm.source);
  u.searchParams.set("utm_medium", utm.medium);
  u.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content) u.searchParams.set("utm_content", utm.content);
  return u.toString();
}
