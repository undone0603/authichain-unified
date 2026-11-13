/**
 * PR2 — AgentZ signed readiness records (plan 07fe3b8d).
 *
 * After a successful StorePilot `dpp_check` or `catalog_readiness_preview`,
 * the apex host can optionally return a compact Ed25519 VC + JWS signed by
 * AgentZ's roster identity. Private keys stay out of git: the Worker binds
 * AGENTZ_READINESS_PRIVATE_JWK (or PEM) from KEY_DIR/agentz.ed25519.pem via
 * `wrangler secret put`. Signing refuses unless that key's public x matches
 * the published AgentZ key in bot-identities.ts / identity.json.
 *
 * Flags: both FEATURE_ENABLED and READINESS_SIGNING_ENABLED must be the string
 * "true". Unset or any other value means off. Nothing is signed unless both
 * are on. POST is rate-limited 10/min/IP on X402_REPLAY_KV before the key loads.
 *
 * Re-sign / rotate before 2027-01-17T18:00:00Z (R4):
 *   1. Update VALID_UNTIL in scripts/agent-identity/bots.mjs.
 *   2. KEY_DIR=/path/outside/repo node scripts/agent-identity/generate.mjs
 *      (reuses the existing AgentZ key; writes public records only).
 *   3. If rotating the key, replace KEY_DIR/agentz.ed25519.pem first, regenerate,
 *      then `wrangler secret put AGENTZ_READINESS_PRIVATE_JWK --name authichain-com` // pragma: allowlist secret
 *      from that PEM exported as a JWK. Never commit the JWK or PEM.
 *   4. Deploy. Leave READINESS_SIGNING_ENABLED=false until Research smoke-checks.
 * After validUntil, this helper refuses until steps 1–2 (and 3 if the key
 * changed) have run. v1 does not Polygon-anchor these records.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from "node:crypto";
import {
  base58Encode,
  canonicalize,
  didKeyFromJwk,
  signingBytes,
  sha256Hex,
} from "../../../protocol/verifier.mjs";
import {
  DPP_QUESTIONS,
  categoryById,
  parseDppReadinessInput,
  scoreDppReadiness,
  type DppCategory,
  type DppReadinessInput,
  type QuestionId,
} from "../../../src/lib/dpp-readiness";
import { BOT_IDENTITIES } from "./bot-identities";

export const READINESS_SIGN_PATH = "/api/agentz/readiness-sign";
export const READINESS_SCHEMA_ID = "authichain.agentz.readiness/1"; // pragma: allowlist secret
export const READINESS_JWS_TYP = "AC-READINESS+JWS";
export const READINESS_RECORD_TYPE = "AgentZReadinessRecord";
export const READINESS_SIGNING_FLAG = "READINESS_SIGNING_ENABLED";
export const READINESS_PRIVATE_JWK_SECRET = "AGENTZ_READINESS_PRIVATE_JWK";
export const READINESS_PRIVATE_PEM_SECRET = "AGENTZ_READINESS_PRIVATE_KEY_PEM";

export const SIGNABLE_TOOLS = ["dpp_check"] as const;
export type SignableTool = (typeof SIGNABLE_TOOLS)[number];

export const READINESS_GAP_CODES = DPP_QUESTIONS.map(q => q.id);
export type ReadinessGapCode = QuestionId;

export const SIGNED_DISCLAIMER =
  "readiness self-check; not an audit, certification, compliance determination, or registry filing";

export const SIGNATURE_PROOF_STATEMENT =
  "The signature proves only that the published key signed these bytes. It is not an audit, a certification, compliance, a registry filing, legal advice, or human acceptance. It is not affiliated with or endorsed by the European Commission.";

export const IDENTITY_STATUS_UNANCHORED = "valid-unanchored" as const;

export const AGENTZ_SLUG = "agentz";
const agentz = BOT_IDENTITIES.bots.find(b => b.slug === AGENTZ_SLUG);
if (!agentz) throw new Error("AgentZ is missing from BOT_IDENTITIES");

export const AGENTZ_DID = agentz.did;
export const AGENTZ_DID_KEY = agentz.didKey;
export const AGENTZ_KID = agentz.kid;
export const AGENTZ_PUBLIC_JWK_X = agentz.publicKeyJwkX;
export const AGENTZ_PUBLIC_KEY_MULTIBASE = agentz.publicKeyMultibase;
export const AGENTZ_IDENTITY_VALID_FROM = agentz.record.validFrom;
export const AGENTZ_IDENTITY_VALID_UNTIL = agentz.record.validUntil;
export const AGENTZ_IDENTITY_JSON_URL =
  "https://authichain.com/agents/agentz/identity.json"; // pragma: allowlist secret
export const AGENTZ_DID_DOCUMENT_URL =
  "https://authichain.com/agents/agentz/did.json"; // pragma: allowlist secret
export const ISSUER_DID_DOCUMENT_URL = "https://authichain.com/.well-known/did.json"; // pragma: allowlist secret
export const AGENTZ_PUBLISHED_JWK = {
  kty: "OKP" as const,
  crv: "Ed25519" as const,
  x: AGENTZ_PUBLIC_JWK_X,
  kid: AGENTZ_KID,
  use: "sig" as const,
  alg: "EdDSA" as const,
};

export const SIGNED_PAYLOAD_KEYS = [
  "disclaimer",
  "gapCodes",
  "identityStatus",
  "inputsSha256",
  "score",
  "signedAt",
  "tool",
  "toolVersion",
  "validUntil",
] as const;

export const REQUEST_KEYS = [
  "tool",
  "toolVersion",
  "category",
  "sells_in_eu",
  ...READINESS_GAP_CODES,
] as const;

/** Posted results are refused. The server recomputes these from the scorer. */
export const REFUSED_POSTED_RESULT_KEYS = [
  "score",
  "gapCodes",
  "inputsSha256",
] as const;

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_KV_PREFIX = "readiness-sign:rl:";

export const INPUT_HASH_KEYS = [
  "category",
  "sells_in_eu",
  ...READINESS_GAP_CODES,
] as const;

export const RE_SIGN_OR_ROTATE = {
  before: AGENTZ_IDENTITY_VALID_UNTIL,
  identityStatus: IDENTITY_STATUS_UNANCHORED,
  steps: [
    "Update VALID_UNTIL in scripts/agent-identity/bots.mjs.",
    "Re-run KEY_DIR=/path/outside/repo node scripts/agent-identity/generate.mjs. That reuses the existing AgentZ Ed25519 key and writes public records only.",
    "If rotating the key, replace KEY_DIR/agentz.ed25519.pem first, regenerate, then wrangler secret put AGENTZ_READINESS_PRIVATE_JWK --name authichain-com from that PEM exported as a JWK. Never commit the JWK or PEM.", // pragma: allowlist secret
    "Deploy. Leave READINESS_SIGNING_ENABLED=false until Research smoke-checks. Signing refuses after validUntil until this step has run.",
  ],
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Access-Control-Allow-Origin": "*",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const TOOL_VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const SIGNABLE_TOOL_SET = new Set<string>(SIGNABLE_TOOLS);
const REQUEST_KEY_SET = new Set<string>(REQUEST_KEYS);
const REFUSED_POSTED_RESULT_KEY_SET = new Set<string>(REFUSED_POSTED_RESULT_KEYS);
const FORBIDDEN_FREE_TEXT_KEYS = [
  "product_name",
  "productName",
  "name",
  "answers",
  "url",
  "nextStep",
  "disclaimer",
  "message",
  "text",
  "prompt",
  "instructions",
] as const;

export type ReadinessSignKv = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
};

export type ReadinessSignEnv = {
  READINESS_SIGNING_ENABLED?: string;
  FEATURE_ENABLED?: string;
  AGENTZ_READINESS_PRIVATE_JWK?: string;
  AGENTZ_READINESS_PRIVATE_KEY_PEM?: string;
  /** Reuses the existing apex KV. Keys are prefixed RATE_LIMIT_KV_PREFIX. */
  X402_REPLAY_KV?: ReadinessSignKv;
};

export type CanonicalReadinessInputs = {
  category: DppCategory;
  sells_in_eu: boolean;
} & Record<QuestionId, boolean>;

export type ReadinessSignRequest = {
  tool: SignableTool;
  toolVersion: string;
} & CanonicalReadinessInputs;

export type SignedReadinessPayload = {
  tool: SignableTool;
  toolVersion: string;
  inputsSha256: string;
  score: number;
  gapCodes: ReadinessGapCode[];
  signedAt: string;
  disclaimer: typeof SIGNED_DISCLAIMER;
  identityStatus: typeof IDENTITY_STATUS_UNANCHORED;
  validUntil: string;
};

export type ReadinessSignFailureCode =
  | "SIGNING_DISABLED"
  | "FEATURE_DISABLED"
  | "IDENTITY_EXPIRED"
  | "KEY_UNBOUND"
  | "KEY_MISMATCH"
  | "INVALID_SCHEMA"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNBOUND";

export type ReadinessSignFailure = {
  signed: false;
  error: ReadinessSignFailureCode;
  message: string;
  validUntil: string;
  identityStatus: typeof IDENTITY_STATUS_UNANCHORED;
};

export type ReadinessSignSuccess = {
  signed: true;
  schema: typeof READINESS_SCHEMA_ID;
  proofStatement: typeof SIGNATURE_PROOF_STATEMENT;
  identity: {
    did: string;
    didKey: string;
    kid: string;
    status: typeof IDENTITY_STATUS_UNANCHORED;
    validUntil: string;
    identityJson: string;
    didDocument: string;
    issuerDidDocument: string;
  };
  payload: SignedReadinessPayload;
  record: Record<string, unknown>;
  jws: string;
  verify: {
    npm: string;
    repoCli: string;
    note: string;
  };
};

export type ReadinessSignResult = ReadinessSignSuccess | ReadinessSignFailure;

export type SignReadinessDeps = {
  signingEnabled?: boolean;
  featureEnabled?: boolean;
  now?: Date;
  privateKey?: KeyObject;
  privateJwk?: string;
  privatePem?: string;
  kv?: ReadinessSignKv;
  clientIp?: string;
  /** Tests only. Live signing always requires the AgentZ published public key. */
  allowMismatchedKey?: boolean;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

export function isReadinessSignPath(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return p === READINESS_SIGN_PATH;
}

function envFlagTrue(
  depsValue: boolean | undefined,
  envValue: string | undefined
): boolean {
  if (depsValue !== undefined) return depsValue === true;
  return envValue === "true";
}

export function isFeatureFlagOn(
  env: ReadinessSignEnv = {},
  deps: SignReadinessDeps = {}
): boolean {
  return envFlagTrue(deps.featureEnabled, env.FEATURE_ENABLED);
}

export function isSigningFlagOn(
  env: ReadinessSignEnv = {},
  deps: SignReadinessDeps = {}
): boolean {
  return envFlagTrue(deps.signingEnabled, env.READINESS_SIGNING_ENABLED);
}

export function isReadinessSigningEnabled(
  env: ReadinessSignEnv = {},
  deps: SignReadinessDeps = {}
): boolean {
  return isFeatureFlagOn(env, deps) && isSigningFlagOn(env, deps);
}

export function publishedAgentzJwks(): { keys: typeof AGENTZ_PUBLISHED_JWK[] } {
  return { keys: [{ ...AGENTZ_PUBLISHED_JWK }] };
}

export function toDppReadinessInput(
  request: CanonicalReadinessInputs
): DppReadinessInput {
  const answers: DppReadinessInput["answers"] = {};
  for (const q of DPP_QUESTIONS) answers[q.id] = request[q.id] === true;
  return {
    category: request.category,
    sellsInEu: request.sells_in_eu,
    answers,
  };
}

export function pickCanonicalInputs(
  input: DppReadinessInput
): CanonicalReadinessInputs {
  const out = {
    category: input.category,
    sells_in_eu: input.sellsInEu === true,
  } as CanonicalReadinessInputs;
  for (const q of DPP_QUESTIONS) {
    out[q.id] = input.answers[q.id] === true;
  }
  return out;
}

export function hashReadinessInputs(input: DppReadinessInput): string {
  return sha256Hex(Buffer.from(canonicalize(pickCanonicalInputs(input)), "utf8"));
}

export function gapCodesFromAnswers(input: DppReadinessInput): ReadinessGapCode[] {
  return DPP_QUESTIONS.filter(q => input.answers[q.id] !== true).map(q => q.id);
}

export function scoreCanonicalInputs(input: DppReadinessInput) {
  const scored = scoreDppReadiness(input, { offerAudit: false });
  return {
    score: scored.score,
    gapCodes: gapCodesFromAnswers(input),
    inputsSha256: hashReadinessInputs(input),
  };
}

export function rfc7638Kid(x: string): string {
  return createHash("sha256")
    .update(`{"crv":"Ed25519","kty":"OKP","x":"${x}"}`)
    .digest("base64url");
}

function failure(
  error: ReadinessSignFailureCode,
  message: string
): ReadinessSignFailure {
  return {
    signed: false,
    error,
    message,
    validUntil: AGENTZ_IDENTITY_VALID_UNTIL,
    identityStatus: IDENTITY_STATUS_UNANCHORED,
  };
}

function httpStatusFor(error: ReadinessSignFailureCode): number {
  if (error === "INVALID_SCHEMA") return 400;
  if (error === "IDENTITY_EXPIRED") return 403;
  if (error === "RATE_LIMITED") return 429;
  return 503;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseReadinessSignRequest(
  value: unknown
): { ok: true; request: ReadinessSignRequest } | { ok: false; error: string } {
  const raw = asRecord(value);
  if (!raw) return { ok: false, error: "body must be a JSON object" };
  for (const key of REFUSED_POSTED_RESULT_KEYS) {
    if (key in raw) {
      return {
        ok: false,
        error: `posted ${key} refused; the server computes score, gapCodes, and inputsSha256`,
      };
    }
  }
  const keys = Object.keys(raw);
  for (const key of keys) {
    if (!REQUEST_KEY_SET.has(key)) {
      return { ok: false, error: `unexpected field: ${key}` };
    }
  }
  for (const key of FORBIDDEN_FREE_TEXT_KEYS) {
    if (key in raw) return { ok: false, error: `free text field refused: ${key}` };
  }
  if (raw.tool !== "dpp_check" || !SIGNABLE_TOOL_SET.has(String(raw.tool))) {
    return { ok: false, error: "tool must be dpp_check" };
  }
  if (
    typeof raw.toolVersion !== "string" ||
    !TOOL_VERSION_RE.test(raw.toolVersion)
  ) {
    return { ok: false, error: "toolVersion must be a dotted numeric version" };
  }
  if (typeof raw.category !== "string" || !categoryById(raw.category)) {
    return { ok: false, error: "category must be a known DPP category" };
  }
  if ("sells_in_eu" in raw && typeof raw.sells_in_eu !== "boolean") {
    return { ok: false, error: "sells_in_eu must be a boolean" };
  }
  for (const q of DPP_QUESTIONS) {
    if (q.id in raw && typeof raw[q.id] !== "boolean") {
      return { ok: false, error: `${q.id} must be a boolean` };
    }
  }
  const parsed = parseDppReadinessInput(k => raw[k]);
  if (!parsed) return { ok: false, error: "category must be a known DPP category" };
  const canonical = pickCanonicalInputs(parsed);
  return {
    ok: true,
    request: {
      tool: "dpp_check",
      toolVersion: raw.toolVersion,
      ...canonical,
    },
  };
}

function pemFromSecret(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) return trimmed;
  try {
    const decoded = Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString(
      "utf8"
    );
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded.trim();
  } catch {
    return null;
  }
  return null;
}

export function parseAgentzSigningKey(
  raw: string | undefined
): { ok: true; key: KeyObject; x: string } | { ok: false } {
  if (!raw || !raw.trim()) return { ok: false };
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("{")) {
      const jwk = JSON.parse(trimmed) as {
        kty?: string;
        crv?: string;
        x?: string;
        d?: string;
      };
      if (
        jwk.kty !== "OKP" ||
        jwk.crv !== "Ed25519" ||
        typeof jwk.x !== "string" ||
        typeof jwk.d !== "string"
      ) {
        return { ok: false };
      }
      const key = createPrivateKey({
        key: { kty: "OKP", crv: "Ed25519", x: jwk.x, d: jwk.d },
        format: "jwk",
      });
      const pub = createPublicKey(key).export({ format: "jwk" }) as { x?: string };
      if (typeof pub.x !== "string") return { ok: false };
      return { ok: true, key, x: pub.x };
    }
    const pem = pemFromSecret(trimmed);
    if (!pem) return { ok: false };
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== "ed25519") return { ok: false };
    const pub = createPublicKey(key).export({ format: "jwk" }) as { x?: string };
    if (typeof pub.x !== "string") return { ok: false };
    return { ok: true, key, x: pub.x };
  } catch {
    return { ok: false };
  }
}

function loadSigningKey(
  env: ReadinessSignEnv,
  deps: SignReadinessDeps
): { ok: true; key: KeyObject; x: string } | { ok: false } {
  if (deps.privateKey) {
    const pub = createPublicKey(deps.privateKey).export({ format: "jwk" }) as {
      x?: string;
    };
    if (typeof pub.x !== "string") return { ok: false };
    return { ok: true, key: deps.privateKey, x: pub.x };
  }
  const raw =
    deps.privateJwk ||
    deps.privatePem ||
    env.AGENTZ_READINESS_PRIVATE_JWK ||
    env.AGENTZ_READINESS_PRIVATE_KEY_PEM;
  return parseAgentzSigningKey(raw);
}

function identityExpired(now: Date): boolean {
  return now.getTime() >= Date.parse(AGENTZ_IDENTITY_VALID_UNTIL);
}

function signedPayloadKeys(payload: SignedReadinessPayload): string[] {
  return Object.keys(payload).sort();
}

export function assertExactPayloadKeys(payload: SignedReadinessPayload): boolean {
  const keys = signedPayloadKeys(payload);
  return (
    keys.length === SIGNED_PAYLOAD_KEYS.length &&
    keys.every((key, i) => key === SIGNED_PAYLOAD_KEYS[i])
  );
}

function compactJws(header: unknown, payload: unknown, key: KeyObject): string {
  const headerB64 = Buffer.from(JSON.stringify(header), "utf8").toString(
    "base64url"
  );
  const payloadB64 = Buffer.from(canonicalize(payload), "utf8").toString(
    "base64url"
  );
  const sig = edSign(
    null,
    Buffer.from(`${headerB64}.${payloadB64}`, "ascii"),
    key
  );
  return `${headerB64}.${payloadB64}.${Buffer.from(sig).toString("base64url")}`;
}

function signProtocolRecord(
  payload: SignedReadinessPayload,
  key: KeyObject,
  didKey: string,
  signedAt: string
): Record<string, unknown> {
  const multibase = didKey.slice("did:key:".length);
  const unsigned = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://authichain.com/protocol/v1", // pragma: allowlist secret
    ],
    type: ["VerifiableCredential", READINESS_RECORD_TYPE],
    issuer: didKey,
    validFrom: signedAt,
    validUntil: payload.validUntil,
    credentialSubject: {
      id: AGENTZ_DID,
      ...payload,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: signedAt,
      verificationMethod: `${didKey}#${multibase}`,
      proofPurpose: "assertionMethod",
    },
  };
  const sig = edSign(null, signingBytes(unsigned), key);
  return {
    ...unsigned,
    proof: {
      ...unsigned.proof,
      proofValue: "z" + base58Encode(sig),
    },
  };
}

export function signReadinessRecord(
  input: unknown,
  env: ReadinessSignEnv = {},
  deps: SignReadinessDeps = {}
): ReadinessSignResult {
  if (!isFeatureFlagOn(env, deps)) {
    return failure(
      "FEATURE_DISABLED",
      "FEATURE_ENABLED is not true; nothing is signed"
    );
  }
  if (!isSigningFlagOn(env, deps)) {
    return failure(
      "SIGNING_DISABLED",
      "READINESS_SIGNING_ENABLED is not true; nothing is signed"
    );
  }
  const now = deps.now ?? new Date();
  if (identityExpired(now)) {
    return failure(
      "IDENTITY_EXPIRED",
      `AgentZ identity validUntil ${AGENTZ_IDENTITY_VALID_UNTIL} has passed; re-sign or rotate before signing resumes`
    );
  }
  const parsed = parseReadinessSignRequest(input);
  if (!parsed.ok) return failure("INVALID_SCHEMA", parsed.error);
  const scored = scoreCanonicalInputs(toDppReadinessInput(parsed.request));
  const loaded = loadSigningKey(env, deps);
  if (!loaded.ok) {
    return failure(
      "KEY_UNBOUND",
      "AGENTZ_READINESS_PRIVATE_JWK is not bound; nothing is signed"
    );
  }
  if (loaded.x !== AGENTZ_PUBLIC_JWK_X && !deps.allowMismatchedKey) {
    return failure(
      "KEY_MISMATCH",
      "signing key is not AgentZ's published public key"
    );
  }

  const signedAt = now.toISOString();
  const payload: SignedReadinessPayload = {
    disclaimer: SIGNED_DISCLAIMER,
    gapCodes: scored.gapCodes,
    identityStatus: IDENTITY_STATUS_UNANCHORED,
    inputsSha256: scored.inputsSha256,
    score: scored.score,
    signedAt,
    tool: parsed.request.tool,
    toolVersion: parsed.request.toolVersion,
    validUntil: AGENTZ_IDENTITY_VALID_UNTIL,
  };
  if (!assertExactPayloadKeys(payload)) {
    return failure("INVALID_SCHEMA", "internal payload key mismatch");
  }

  const didKey =
    loaded.x === AGENTZ_PUBLIC_JWK_X
      ? AGENTZ_DID_KEY
      : didKeyFromJwk({ kty: "OKP", crv: "Ed25519", x: loaded.x });
  const kid = loaded.x === AGENTZ_PUBLIC_JWK_X ? AGENTZ_KID : rfc7638Kid(loaded.x);
  const record = signProtocolRecord(payload, loaded.key, didKey, signedAt);
  const jws = compactJws(
    { alg: "EdDSA", typ: READINESS_JWS_TYP, kid },
    payload,
    loaded.key
  );

  return {
    signed: true,
    schema: READINESS_SCHEMA_ID,
    proofStatement: SIGNATURE_PROOF_STATEMENT,
    identity: {
      did: AGENTZ_DID,
      didKey: AGENTZ_DID_KEY,
      kid: AGENTZ_KID,
      status: IDENTITY_STATUS_UNANCHORED,
      validUntil: AGENTZ_IDENTITY_VALID_UNTIL,
      identityJson: AGENTZ_IDENTITY_JSON_URL,
      didDocument: AGENTZ_DID_DOCUMENT_URL,
      issuerDidDocument: ISSUER_DID_DOCUMENT_URL,
    },
    payload,
    record,
    jws,
    verify: {
      npm: "npx authichain-verify record.json", // pragma: allowlist secret
      repoCli: "node protocol/bin/authichain-verify.mjs record.json", // pragma: allowlist secret
      note: "Save `record` as record.json. A valid-unanchored pass means the published AgentZ key signed these bytes. Compact JWS uses typ AC-READINESS+JWS and is not an attestation seal.",
    },
  };
}

export function verifyReadinessJws(
  jws: string,
  jwks: { keys: Array<{ kty?: string; crv?: string; x?: string; kid?: string }> },
  opts: { now?: Date } = {}
): { ok: boolean; payload: SignedReadinessPayload | null; reasons: string[] } {
  const reasons: string[] = [];
  const parts = String(jws ?? "").trim().split(".");
  if (parts.length !== 3) return { ok: false, payload: null, reasons: ["jws_malformed"] };
  let header: { alg?: string; typ?: string; kid?: string };
  let payload: SignedReadinessPayload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, payload: null, reasons: ["jws_malformed"] };
  }
  if (header.alg !== "EdDSA") reasons.push(`alg_unsupported:${header.alg}`);
  if (header.typ !== READINESS_JWS_TYP) reasons.push(`typ_unexpected:${header.typ}`);
  const jwk =
    typeof header.kid === "string"
      ? jwks.keys.find(k => k && k.kid === header.kid)
      : undefined;
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    reasons.push("kid_not_in_jwks");
    return { ok: false, payload, reasons };
  }
  try {
    const key = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: jwk.x },
      format: "jwk",
    });
    const ok = edVerify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`, "ascii"),
      key,
      Buffer.from(parts[2], "base64url")
    );
    if (!ok) reasons.push("signature_invalid");
  } catch (err) {
    reasons.push(`signature_unverifiable:${(err as Error).message}`);
  }
  if (!assertExactPayloadKeys(payload)) reasons.push("payload_keys");
  if (payload.disclaimer !== SIGNED_DISCLAIMER) reasons.push("disclaimer");
  if (payload.identityStatus !== IDENTITY_STATUS_UNANCHORED) {
    reasons.push("identityStatus");
  }
  if (payload.validUntil !== AGENTZ_IDENTITY_VALID_UNTIL) reasons.push("validUntil");
  const now = opts.now ?? new Date();
  if (now.getTime() >= Date.parse(payload.validUntil)) reasons.push("expired");
  return { ok: reasons.length === 0, payload, reasons };
}

export function readinessSignDiscovery(): Record<string, unknown> {
  return {
    schema: READINESS_SCHEMA_ID,
    signingEnabled: false,
    signed: false,
    proofStatement: SIGNATURE_PROOF_STATEMENT,
    signedDisclaimer: SIGNED_DISCLAIMER,
    identity: {
      did: AGENTZ_DID,
      didKey: AGENTZ_DID_KEY,
      kid: AGENTZ_KID,
      status: IDENTITY_STATUS_UNANCHORED,
      validUntil: AGENTZ_IDENTITY_VALID_UNTIL,
      identityJson: AGENTZ_IDENTITY_JSON_URL,
      didDocument: AGENTZ_DID_DOCUMENT_URL,
      issuerDidDocument: ISSUER_DID_DOCUMENT_URL,
    },
    signedFields: [...SIGNED_PAYLOAD_KEYS],
    requestFields: [...REQUEST_KEYS],
    signableTools: [...SIGNABLE_TOOLS],
    gapCodes: [...READINESS_GAP_CODES],
    jwsTyp: READINESS_JWS_TYP,
    verify: {
      npm: "npx authichain-verify record.json", // pragma: allowlist secret
      repoCli: "node protocol/bin/authichain-verify.mjs record.json", // pragma: allowlist secret
    },
    reSignOrRotate: RE_SIGN_OR_ROTATE,
  };
}

export function clientIpFromRequest(
  request: Request,
  deps: SignReadinessDeps = {}
): string {
  if (deps.clientIp) return deps.clientIp;
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) return cf;
  const xff = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

export function rateLimitKey(ip: string, now: Date): string {
  const window = Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS);
  return `${RATE_LIMIT_KV_PREFIX}${ip}:${window}`;
}

export async function consumeReadinessSignRateLimit(
  request: Request,
  env: ReadinessSignEnv,
  deps: SignReadinessDeps = {}
): Promise<ReadinessSignFailure | null> {
  const kv = deps.kv ?? env.X402_REPLAY_KV;
  if (!kv) {
    return failure(
      "RATE_LIMIT_UNBOUND",
      "rate-limit KV is not bound; nothing is signed"
    );
  }
  const now = deps.now ?? new Date();
  const key = rateLimitKey(clientIpFromRequest(request, deps), now);
  let count = 0;
  try {
    count = parseInt((await kv.get(key)) || "0", 10);
    if (!Number.isFinite(count) || count < 0) count = 0;
  } catch {
    return failure(
      "RATE_LIMIT_UNBOUND",
      "rate-limit KV is not bound; nothing is signed"
    );
  }
  if (count >= RATE_LIMIT_MAX) {
    return failure("RATE_LIMITED", "rate limited");
  }
  await kv.put(key, String(count + 1), {
    expirationTtl: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) * 2,
  });
  return null;
}

export async function tryHandleReadinessSign(
  request: Request,
  env: ReadinessSignEnv = {},
  deps: SignReadinessDeps = {}
): Promise<Response | null> {
  if (!isReadinessSignPath(new URL(request.url).pathname)) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }
  if (request.method === "GET") {
    const enabled = isReadinessSigningEnabled(env, deps);
    return jsonResponse({
      ...readinessSignDiscovery(),
      signingEnabled: enabled,
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method not allowed", signed: false }, 405);
  }
  if (!isReadinessSigningEnabled(env, deps)) {
    const result = signReadinessRecord({}, env, deps);
    if (!result.signed) return jsonResponse(result, httpStatusFor(result.error));
    return jsonResponse(result, 200);
  }
  const limited = await consumeReadinessSignRateLimit(request, env, deps);
  if (limited) return jsonResponse(limited, httpStatusFor(limited.error));
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      failure("INVALID_SCHEMA", "body must be JSON"),
      400
    );
  }
  const result = signReadinessRecord(body, env, deps);
  if (!result.signed) return jsonResponse(result, httpStatusFor(result.error));
  return jsonResponse(result, 200);
}
