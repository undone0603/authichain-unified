/**
 * Edge-callable Living QR generation.
 *
 * Live apex POST /api/generate used to 404 because the Next.js route in
 * `src/app/api/generate/route.ts` is not mounted on authichain-edge-router.
 * This module is the worker-owned handler: credit packs come from
 * `src/lib/plans.ts`, and image generation proxies to qron-image-gen.
 */
import { listedPlans, planPaymentLink, type Plan } from "./plans";

export const QRON_IMAGE_GEN_DEFAULT =
  "https://qron-image-gen.undone-k.workers.dev";

export type CreditPack = {
  id: Plan["id"];
  name: string;
  price: number;
  generations: number;
  cta: string;
  checkout: string;
};

export function generateCreditPacks(): CreditPack[] {
  return listedPlans("qron")
    .filter(
      p => p.id === "starter" || p.id === "creator" || p.id === "dpp_readiness"
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
} {
  return {
    status: "ok",
    methods: ["POST"],
    backend: "qron-image-gen",
    worker: workerUrl || process.env.QRON_WORKER_URL || QRON_IMAGE_GEN_DEFAULT,
    auth: Boolean(opts?.authConfigured),
    packs: generateCreditPacks(),
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
}): Promise<GeneratePostResult> {
  const packs = generateCreditPacks();
  if (!opts.userId) {
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

  const credit = await opts.checkCredit(opts.userId);
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

  try {
    const generated = await opts.generateImage({
      targetUrl,
      prompt,
      mode,
      ...(presetId ? { presetId } : {}),
      ...(style ? { style } : {}),
    });
    if (!generated.imageUrl) {
      return { status: 502, body: { message: "No image returned" } };
    }
    const deducted = await opts.deductCredit(opts.userId);
    return {
      status: 200,
      body: {
        qron: {
          imageUrl: generated.imageUrl,
          destinationUrl: targetUrl,
          qrDataUrl: generated.imageUrl,
          prompt,
          mode,
        },
        remaining_credits: deducted.ok ? deducted.remaining : credit.remaining,
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
