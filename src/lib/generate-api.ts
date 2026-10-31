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
  // LOOP-03 order: Starter $29 → Creator; DPP last. QRON Launch is unlisted
  // (listed:false in plans.ts), so listedPlans() drops it; its id stays in
  // `order` only so the sort is stable if it is ever relisted.
  const order = ["starter", "qron_launch", "creator", "dpp_readiness"] as const;
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
            ? "You've used your 5 free generations. Keep going with Starter: 100 more for $29, paid once. No subscription, and pack credits never expire unless you start a subscription."
            : "Free samples are paused for today. Try again later, or get Starter now: 100 generations for $29, paid once. No subscription, and pack credits never expire unless you start a subscription.",
          code: used ? "FREE_SAMPLE_USED" : "FREE_SAMPLE_PAUSED",
          packs,
          pricing: "/pricing",
          // Same shape as the low-credit prompt (#2050): existing Starter only.
          upgrade: {
            url: SAMPLE_EXHAUSTED_STARTER_URL,
            plan: "starter",
            label: "Starter Pack: 100 generations for $29, paid once",
          },
        },
      };
    }
  }

  const credit = anonymous
    ? {
        ok: true as boolean,
        remaining: undefined as number | undefined,
        error: undefined as string | undefined,
      }
    : await opts.checkCredit(opts.userId!);
  if (!credit.ok) {
    return {
      status: 403,
      body: {
        message: credit.error || "Generation limit reached",
        code: "LIMIT_REACHED",
        packs,
        pricing: "/pricing",
      },
    };
  }

  const mode =
    typeof opts.body.mode === "string" && opts.body.mode.trim()
      ? opts.body.mode.trim()
      : "static";
  const presetId =
    typeof opts.body.presetId === "string" ? opts.body.presetId.trim() : "";
  const style = parseQronImageStyle(opts.body.style);

  const objectId = qronObjectIdForDestination(targetUrl);
  const resolveUrl = qronResolveUrl(objectId);

  try {
    const generated = await opts.generateImage({
      // Free samples are never attested, so encode the destination directly
      // (a resolve_url would scan to presentation_not_found).
      targetUrl: anonymous ? targetUrl : resolveUrl,
      prompt,
      mode,
      ...(presetId ? { presetId } : {}),
      ...(style ? { style } : {}),
    });
    if (!generated.imageUrl) {
      return { status: 502, body: { message: "No image returned" } };
    }
    const deducted = anonymous
      ? { ok: false, remaining: undefined }
      : await opts.deductCredit(opts.userId!);
    let bind: QronPresentationAttestation | null = null;
    // Free-sample images are not bound to an issuer attestation.
    if (opts.bindAttestation && opts.userId) {
      try {
        bind = await opts.bindAttestation({
          destinationUrl: targetUrl,
          imageUrl: generated.imageUrl,
          objectId,
          userId: opts.userId,
        });
      } catch {
        bind = null;
      }
    }

    const presentation = buildQronPresentation({
      destinationUrl: targetUrl,
      imageUrl: generated.imageUrl,
      mode,
      prompt,
      jws: bind?.jws,
      kid: bind?.kid,
      jwksUrl: bind?.jwks_url,
    });
    const qrDataUrl = await scannableQrDataUrl(
      anonymous ? targetUrl : presentation.resolve_url
    );
    if (bind && opts.rememberPresentation) {
      try {
        await opts.rememberPresentation({
          object_id: presentation.object_id,
          destination_url: targetUrl,
          resolve_url: presentation.resolve_url,
          jws: bind.jws,
          kid: bind.kid,
          jwks_url: bind.jwks_url,
        });
      } catch {
        // Generate still returns. A scan 404s until a later bind stores the JWS.
      }
    }
    const remaining = deducted.ok ? deducted.remaining : credit.remaining;
    return {
      status: 200,
      body: {
        qron: {
          imageUrl: generated.imageUrl,
          destinationUrl: targetUrl,
          qrDataUrl,
          resolveUrl: anonymous ? null : presentation.resolve_url,
          prompt,
          mode,
          objectId: presentation.object_id,
        },
        ...(anonymous ? {} : { presentation }),
        remaining_credits: remaining,
        ...(anonymous ? { free_sample: true } : {}),
        ...(anonymous ? {} : lowCreditUpgrade(remaining)),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 502,
      body: {
        message:
          "AI generation engine is temporarily unavailable. Try again in 60s.",
        detail: message,
      },
    };
  }
}

export type QronGenerateResponse = {
  success?: boolean;
  image?: { data_url?: string; base64?: string; content_type?: string };
  downloadUrl?: string;
  previewUrl?: string;
  error?: string;
};

export function parseQronImageStyle(
  value: string | undefined
): QronImageStyle | undefined {
  const style = typeof value === "string" ? value.trim() : "";
  return (QRON_IMAGE_STYLES as readonly string[]).includes(style)
    ? (style as QronImageStyle)
    : undefined;
}

export async function proxyQronImageGen(opts: {
  targetUrl: string;
  prompt: string;
  style?: string;
  fetchImpl?: typeof fetch;
  workerUrl?: string;
}): Promise<{ imageUrl: string }> {
  const worker = (
    opts.workerUrl ||
    process.env.QRON_WORKER_URL ||
    QRON_IMAGE_GEN_DEFAULT
  ).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl || fetch;
  const style = parseQronImageStyle(opts.style);
  const res = await fetchImpl(`${worker}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${opts.prompt}. Scannable QR code that encodes ${opts.targetUrl}`,
      ...(style ? { style } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as QronGenerateResponse;
  if (!res.ok) {
    throw new Error(data.error || `qron-image-gen HTTP ${res.status}`);
  }
  const imageUrl =
    data.image?.data_url ||
    data.downloadUrl ||
    data.previewUrl ||
    (data.image?.base64
      ? `data:${data.image.content_type || "image/png"};base64,${data.image.base64}`
      : "");
  if (!imageUrl) throw new Error("qron-image-gen returned no image");
  return { imageUrl };
}

export async function resolveGenerateUserId(opts: {
  request: Request;
  supabaseUrl?: string;
  supabaseKey?: string;
}): Promise<string | null> {
  const token = extractAccessToken(opts.request);
  if (!token || !opts.supabaseUrl || !opts.supabaseKey) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(opts.supabaseUrl, opts.supabaseKey);
    const { data } = await supabase.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

const BASE64_PREFIX = "base64-";
const AUTH_TOKEN_CHUNK = /^(.*(?:-auth-token|sb-access-token))\.(0|[1-9]\d*)$/;

function parseCookieHeader(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    let raw = part.slice(eq + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      raw = raw.slice(1, -1);
    }
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    if (value) cookies.set(name, value);
  }
  return cookies;
}

function combineCookieChunks(
  cookies: Map<string, string>,
  key: string
): string | null {
  const whole = cookies.get(key);
  if (whole) return whole;
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = cookies.get(`${key}.${i}`);
    if (!chunk) break;
    parts.push(chunk);
  }
  return parts.length > 0 ? parts.join("") : null;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      normalized.length % 4 === 0
        ? ""
        : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function accessTokenFromCookieValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("eyJ")) return trimmed;

  let payload = trimmed;
  if (trimmed.startsWith(BASE64_PREFIX)) {
    const decoded = decodeBase64Url(trimmed.slice(BASE64_PREFIX.length));
    if (!decoded) return null;
    payload = decoded;
  }

  try {
    const parsed = JSON.parse(payload) as {
      access_token?: string;
      currentSession?: { access_token?: string };
    };
    const token = parsed.access_token || parsed.currentSession?.access_token;
    return token || null;
  } catch {
    return null;
  }
}

function authCookieKeys(cookies: Map<string, string>): string[] {
  const keys = new Set<string>();
  for (const name of cookies.keys()) {
    if (name === "sb-access-token" || name.endsWith("-auth-token")) {
      keys.add(name);
      continue;
    }
    const chunk = name.match(AUTH_TOKEN_CHUNK);
    if (chunk) keys.add(chunk[1]);
  }
  return [...keys];
}

/**
 * Read a Supabase access token from Authorization or cookies.
 *
 * Live `@supabase/ssr` sessions are stored as `base64-<base64url(JSON)>` on
 * `sb-<ref>-auth-token`, often split into `.0` / `.1` chunks. A JWT-only or
 * raw-JSON parser misses those cookies and signed-in generate stays 401.
 */
export function extractAccessToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookieHeader(request.headers.get("cookie") || "");
  for (const key of authCookieKeys(cookies)) {
    const combined = combineCookieChunks(cookies, key);
    if (!combined) continue;
    const token = accessTokenFromCookieValue(combined);
    if (token) return token;
  }
  return null;
}
