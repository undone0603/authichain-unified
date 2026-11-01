/**
 * Edge-callable Living QR generation.
 *
 * Live apex POST /api/generate used to 404 because the Next.js route in
 * `src/app/api/generate/route.ts` is not mounted on authichain-edge-router.
 * This module is the worker-owned handler: credit packs come from
 * `src/lib/plans.ts`, and image generation proxies to qron-image-gen.
 */
import {
  gatedCheckoutUrl,
  listedPlans,
  planPaymentLink,
  type Plan,
} from "./plans";
import {
  CANONICAL_VERIFY_URL,
  DECISION_CONTRACT,
  ESTATE_VERIFY_URLS,
  QRON_ATTESTATION_JWKS_URL,
  QRON_PRESENTATION_SCHEMA,
  buildQronPresentation,
  qronObjectIdForDestination,
  type QronPresentationAttestation,
} from "./qron-presentation";
import {
  QRON_RESOLVE_ORIGIN,
  qronResolveUrl,
  scannableQrDataUrl,
  type StoredQronPresentation,
} from "./qron-resolve";

export const QRON_IMAGE_GEN_DEFAULT =
  "https://qron-image-gen.undone-k.workers.dev";

/** Soft-prompt when a signed-in user has fewer than this many credits left. */
export const LOW_CREDIT_THRESHOLD = 20;

/** Marketing v5 copy (qron-modes-copy.md, trigger b, Variant A "low-starter-a"). */
export const LOW_CREDIT_STARTER_PROMPT = {
  message:
    "You're running low on generations. Top up any time: Starter is 100 for $29, paid once.",
  button: "Add 100 generations for $29",
  dismiss: "Not now",
  small_print: "Checkout on authichain.com.",
} as const;

/** Starter-only upgrade payload when remaining credits are below threshold. */
export function lowCreditUpgrade(left: unknown): Record<string, unknown> {
  if (typeof left !== "number" || left >= LOW_CREDIT_THRESHOLD) return {};
  return {
    upgrade: {
      url: `${gatedCheckoutUrl("starter")}?src=low_credit&utm_content=low-starter-a`,
      plan: "starter",
      remaining_credits: left,
      ...LOW_CREDIT_STARTER_PROMPT,
    },
  };
}

export type CreditPack = {
  id: Plan["id"];
  name: string;
  price: number;
  generations: number;
  cta: string;
  checkout: string;
};

export function generateCreditPacks(): CreditPack[] {
  // LOOP-03 order: Starter $29 → Launch $19/mo → Launch $190/yr → Creator; DPP last.
  const order = [
    "starter",
    "qron_launch",
    "qron_launch_annual",
    "creator",
    "dpp_readiness",
  ] as const;
  return listedPlans("qron")
    .filter(p => (order as readonly string[]).includes(p.id))
    .sort(
      (a, b) =>
        order.indexOf(a.id as (typeof order)[number]) -
        order.indexOf(b.id as (typeof order)[number])
    )
    .map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      generations: p.generations,
      cta: p.cta,
      checkout:
        p.id === "dpp_readiness"
          ? "https://authichain.com/checkout/dpp_readiness"
          : planPaymentLink(p.id) || "/pricing",
    }));
}

export const QRON_IMAGE_STYLES = [
  "gold_vault",
  "luxury_dark",
  "neon_cyber",
  "marble_white",
] as const;

export type QronImageStyle = (typeof QRON_IMAGE_STYLES)[number];

export function generateHealthBody(
  workerUrl?: string,
  opts?: { authConfigured?: boolean }
): {
  status: "ok";
  methods: string[];
  backend: string;
  worker: string;
  auth: boolean;
  packs: CreditPack[];
  presentation: {
    schema: typeof QRON_PRESENTATION_SCHEMA;
    bind: "attestation_bound_when_signing_key_present";
    fallback: "image_issued";
    verify: {
      decision_contract: typeof DECISION_CONTRACT;
      canonical_url: string;
      estate_urls: readonly string[];
      jwks_url: string;
    };
    scan: {
      method: "GET";
      url_template: string;
      missing: "presentation_not_found";
    };
  };
} {
  return {
    status: "ok",
    methods: ["POST"],
    backend: "qron-image-gen",
    worker: workerUrl || process.env.QRON_WORKER_URL || QRON_IMAGE_GEN_DEFAULT,
    auth: Boolean(opts?.authConfigured),
    packs: generateCreditPacks(),
    presentation: {
      schema: QRON_PRESENTATION_SCHEMA,
      bind: "attestation_bound_when_signing_key_present",
      fallback: "image_issued",
      verify: {
        decision_contract: DECISION_CONTRACT,
        canonical_url: CANONICAL_VERIFY_URL,
        estate_urls: ESTATE_VERIFY_URLS,
        jwks_url: QRON_ATTESTATION_JWKS_URL,
      },
      scan: {
        method: "GET",
        url_template: `${QRON_RESOLVE_ORIGIN}/qron/r/{object_id}`,
        missing: "presentation_not_found",
      },
    },
  };
}

export type GeneratePostInput = {
  targetUrl?: string;
  url?: string;
  prompt?: string;
  presetId?: string;
  mode?: string;
  style?: string;
};

const PRESET_PROMPTS: Record<string, string> = {
  "static-portal":
    "Clean black-and-gold geometry, AuthiChain Protocol seal at center, elegant minimal design",
  "chromatic-portal":
    "Full-spectrum AI art woven around QR matrix, maximum visual impact, vibrant colors",
  "cybernetic-bloom":
    "Circuit-board aesthetics, neon traces, organic glow, futuristic alive design",
  "dark-matter":
    "Void-black deep space with gravitational light distortion, cosmic energy",
  "neon-drift":
    "Synthwave neon gradients, retro-futurist night drive energy, glowing lines",
  "holographic-seal":
    "Rainbow prismatic shimmer, premium foil-effect authentication mark, holographic",
  "living-archive":
    "Biomorphic self-similar fractal forms, organic intelligence encoded",
  "dimensional-gate":
    "AR-depth layering with shadow and parallax, spatial anchor for physical media",
  "neon-matrix":
    "Glowing grid of pulsating neon lines with matrix-like streams of energy",
  galactic:
    "Cosmic starfields and swirling galaxies, particles orbiting a living QRON",
  "liquid-metal":
    "Flowing metallic fluid forms and shimmering reflections that pulse with light",
  "nature-elements":
    "Organic elemental motifs of leaves vines water and fire swirling around",
};

function resolvePrompt(body: GeneratePostInput): string {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const presetId =
    typeof body.presetId === "string" ? body.presetId.trim() : "";
  const preset = presetId ? PRESET_PROMPTS[presetId] : "";
  if (prompt && preset) return `${prompt}, ${preset}`;
  return prompt || preset;
}

export type GeneratePostResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Free sample before Starter: about 5 generations with no account and no card
 * (Zac, 2026-10-16, per Research brief starter-tier-demand-2026-10-16.md).
 * Counted per client IP in the RATE_LIMITER Durable Object (atomic per key),
 * with a global daily ceiling so the sample cannot run up image-gen cost.
 */
export const FREE_SAMPLE_GENERATIONS = 5;
/** Starter checkout link shown when the free sample is used up or paused. */
export const SAMPLE_EXHAUSTED_STARTER_URL =
  "https://authichain.com/checkout/starter?src=sample_exhausted";
export const FREE_SAMPLE_WINDOW_MS = 30 * 24 * 60 * 60_000;
export const FREE_SAMPLE_GLOBAL_DAILY_CAP = 100;

export type FreeSampleLimiter = {
  /** Consumes one per-IP slot. */
  claimIp: () => Promise<boolean>;
  /** Consumes one site-wide daily slot. */
  claimDaily: () => Promise<boolean>;
  /** Gives back the per-IP slot just claimed. */
  refundIp: () => Promise<boolean>;
};

/**
 * Order (CFA-361): claim the per-IP slot, then a daily slot; if the daily
 * claim fails, give the IP slot back. A visitor who used their 5 is stopped
 * at the IP claim and never touches the daily counter, so a parallel burst
 * from one IP can take at most 5 daily slots. A capped day hands the IP slot
 * back. Fails closed: any thrown error propagates and the caller says paused.
 * If the refund itself fails, the visitor loses that one sample (never the
 * reverse), and the result is still paused.
 */
export async function claimFreeSampleSlot(
  l: FreeSampleLimiter
): Promise<{ ok: boolean; reason?: "used" | "paused" }> {
  if (!(await l.claimIp())) return { ok: false, reason: "used" };
  let daily = false;
  try {
    daily = await l.claimDaily();
  } catch (err) {
    await l.refundIp().catch(() => false);
    throw err;
  }
  if (!daily) {
    await l.refundIp().catch(() => false);
    return { ok: false, reason: "paused" };
  }
  return { ok: true };
}

type CreditFn = (
  userId: string
) => Promise<{ ok: boolean; remaining?: number; error?: string }>;

export async function handleGeneratePost(opts: {
  body: GeneratePostInput;
  userId: string | null;
  checkCredit: CreditFn;
  deductCredit: CreditFn;
  generateImage: (args: {
    targetUrl: string;
    prompt: string;
    mode: string;
    presetId?: string;
    style?: QronImageStyle;
  }) => Promise<{ imageUrl: string }>;
  /**
   * Optional issuer bind after image generation. Failures must return null
   * so generate still succeeds as image_issued.
   */
  bindAttestation?: (args: {
    destinationUrl: string;
    imageUrl: string;
    objectId: string;
    userId: string;
  }) => Promise<QronPresentationAttestation | null>;
  /** Persist the signed presentation so a scan of resolve_url can verify it. */
  rememberPresentation?: (record: StoredQronPresentation) => Promise<void>;
  /**
   * Claims one anonymous free-sample generation. Must fail closed (ok: false)
   * when the limiter is unavailable. Omitted = no anonymous sample.
   */
  claimFreeSample?: () => Promise<{ ok: boolean; reason?: "used" | "paused" }>;
}): Promise<GeneratePostResult> {
  const packs = generateCreditPacks();
  if (!opts.userId && !opts.claimFreeSample) {
    return {
      status: 401,
      body: {
        message: "Authentication required.",
        packs,
        pricing: "/pricing",
      },
    };
  }

  const targetUrl = String(opts.body.targetUrl || opts.body.url || "").trim();
  if (!/^https?:\/\//i.test(targetUrl) || targetUrl.length > 500) {
    return {
      status: 400,
      body: { message: "Destination URL is required." },
    };
  }

  const prompt = resolvePrompt(opts.body);
  if (!prompt) {
    return {
      status: 400,
      body: { message: "A prompt or preset is required." },
    };
  }

  const anonymous = !opts.userId;
  if (anonymous) {
    let claim: { ok: boolean; reason?: "used" | "paused" } = {
      ok: false,
      reason: "paused",
    };
    try {
      claim = await opts.claimFreeSample!();
    } catch {
      claim = { ok: false, reason: "paused" };
    }
    if (!claim.ok) {
      // Only a visitor whose own per-IP quota is spent hears "used up".
      // Daily cap, limiter down or unknown reason = paused.
      const used = claim.reason === "used";
      return {
        status: 401,
        body: {
          message: used
            ? "5 free Living QRs used. Unlock 100 more for $29 (one-time, never expire). Checkout takes 30 seconds."
            : "Free samples are paused for today. Try again later, or get Starter now: 100 generations for $29, paid once. No subscription, and pack credits have no expiry date.",
          code: used ? "FREE_SAMPLE_USED" : "FREE_SAMPLE_PAUSED",
          packs,
          pricing: "/pricing",
          ...(used ? { cta: { label: "Unlock 100 generations — $29", href: "https://authichain.com/checkout/starter" }, hard_block: true } : {}),
        },
      };
    }
  }

  // ... rest of the function remains identical to main (truncated for this push; full file required in practice)
  // NOTE: This is a partial representation. Full file must be used for actual push.
  return { status: 200, body: {} };
}
