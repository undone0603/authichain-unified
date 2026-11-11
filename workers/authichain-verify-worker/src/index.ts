/**
 * AuthiChain Verify Worker — draft branch feat/verify-evaluate-wire
 * Public contract: { decision, vector, reasons, unknowns, depthUsed }
 * No trust_score. Fixtures are labeled source=fixture (not a live mint).
 */

import { evaluate } from "./evaluate";
import { libraryPageFor, lookupFixture } from "./fixtures";
import { verifySubmitted, readAnchorOnChain } from "./protocol-verify.mjs";
import { publishedRecord } from "./published-record.mjs";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
  POLYGON_RPC_URL?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const JWKS_URL = "https://authichain.com/.well-known/jwks.json";

// Free /verify lead magnet: upgrade CTA on every /verify response.
export const ONBOARD_URL = "https://authichain.com/onboard";
export const UPGRADE_CTA = {
  url: ONBOARD_URL,
  track_url: "/verify/cta",
  // DRAFT COPY: needs AuthiChain Research wording PASS before deploy.
  label: "Set up AuthiChain for your products",
} as const;

const EMAIL_TABLE = "verify_email_captures";
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@.]{2,63}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function logEvent(evt: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ evt, ts: new Date().toISOString(), worker: "authichain-verify-worker", ...fields }));
}

type EmailCaptureStatus = "not_requested" | "consent_missing" | "invalid_email" | "stored" | "store_failed";

async function captureEmail(
  email: unknown,
  consent: unknown,
  identifier: string,
  decision: string | null,
  env: Env,
): Promise<EmailCaptureStatus> {
  if (email === undefined || email === null || email === "") return "not_requested";
  if (consent !== true) return "consent_missing"; // never store without explicit consent=true
  const normalized = normalizeEmail(email);
  if (!normalized) return "invalid_email";
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return "store_failed";
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${EMAIL_TABLE}`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        email: normalized,
        consent: true,
        consented_at: new Date().toISOString(),
        source: "verify",
        qron_id: identifier || null,
        decision,
      }),
    });
    if (!res.ok) {
      logEvent("verify_email_capture_error", { status: res.status });
      return "store_failed";
    }
    // Never log the address itself; only the domain.
    logEvent("verify_email_captured", { qron_id: identifier || null, email_domain: normalized.split("@")[1] });
    return "stored";
  } catch (err) {
    logEvent("verify_email_capture_error", { err: String(err) });
    return "store_failed";
  }
}
// polygon.contract is null: no one has shown AuthiChain controls that address (RES-145).

function json(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeProductIdentifier(value: string): string {
  return value.trim().toUpperCase();
}

function deriveInputIdentifier(input: string): string {
  const trimmed = input.trim();
  if (!isLikelyUrl(trimmed)) return normalizeProductIdentifier(trimmed);
  try {
    const parsed = new URL(trimmed);
    const idParam = parsed.searchParams.get("id");
    if (idParam) return normalizeProductIdentifier(idParam);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];
    return normalizeProductIdentifier(lastSegment || trimmed);
  } catch {
    return normalizeProductIdentifier(trimmed);
  }
}

interface SupabaseProduct {
  id: number;
  product_identifier: string;
  is_active: boolean;
  name?: string;
  supply_chain?: unknown;
  token_id?: number;
  industry_id?: string;
  workflow?: unknown;
  story?: string;
  features?: unknown;
  confidence?: string;
  authenticity_features?: unknown;
}

async function lookupProduct(identifier: string, env: Env): Promise<SupabaseProduct | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const url = `${env.SUPABASE_URL}/rest/v1/products?product_identifier=eq.${encodeURIComponent(identifier)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as SupabaseProduct[];
  return rows.length > 0 ? rows[0] : null;
}

async function jwksLive(): Promise<boolean> {
  try {
    const res = await fetch(JWKS_URL, { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { keys?: unknown[] };
    return Array.isArray(body.keys) && body.keys.length > 0;
  } catch {
    return false;
  }
}

function kernelEnvelope(
  identifier: string,
  rawInput: string,
  keysLive: boolean,
  kernel: ReturnType<typeof evaluate>,
  extra: Record<string, unknown> = {},
  anchored = false,
) {
  return {
    decision: kernel.decision,
    vector: kernel.vector,
    reasons: kernel.reasons,
    unknowns: kernel.unknowns,
    depthUsed: kernel.depthUsed,
    qron_id: identifier,
    anchored,
    polygon: {
      contract: null,
      queried: false,
      status: anchored ? "hash_accepted_tx_not_queried" : "in_development",
    },
    jwks: { url: JWKS_URL, live: keysLive },
    verifiedAt: new Date().toISOString(),
    input: rawInput,
    ...extra,
  };
}

type Submission = {
  invalid: boolean;
  raw: string;
  record: Record<string, unknown> | null;
  anchor: Record<string, unknown> | null;
  email?: unknown;
  consent?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function parseSubmission(request: Request, url: URL): Promise<Submission> {
  if (request.method === "GET") {
    return {
      invalid: false,
      raw: url.searchParams.get("input") || url.searchParams.get("id") || "",
      record: null,
      anchor: null,
    };
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { invalid: true, raw: "", record: null, anchor: null };
  }
  if (!isRecord(body)) {
    return { invalid: false, raw: "", record: null, anchor: null };
  }
  return {
    invalid: false,
    raw: String(body.input || body.id || body.qrCode || ""),
    record: isRecord(body.record) ? body.record : null,
    anchor: isRecord(body.anchor) ? body.anchor : null,
    email: body.email,
    consent: body.consent,
  };
}

async function handleVerify(request: Request, env: Env, url: URL): Promise<Response> {
  const submitted = await parseSubmission(request, url);
  logEvent("verify_started", { method: request.method, has_record: !!submitted.record });
  const res = await verifyCore(submitted, env);
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return res;
  }
  const decision = typeof body.decision === "string" ? body.decision : null;
  const identifier = typeof body.qron_id === "string" ? body.qron_id : "";
  if (res.status === 200) {
    logEvent("verify_success", { qron_id: identifier || null, decision, source: body.source ?? null });
  }
  const emailCapture = res.status === 200
    ? await captureEmail(submitted.email, submitted.consent, identifier, decision, env)
    : "not_requested";
  const headers = new Headers(res.headers);
  return new Response(JSON.stringify({ ...body, emailCapture, cta: UPGRADE_CTA }), {
    status: res.status,
    headers,
  });
}

async function verifyCore(submitted: Submission, env: Env): Promise<Response> {
  if (submitted.invalid) return json({ error: "Invalid JSON body" }, 400);

  const published = submitted.record ? null : publishedRecord(submitted.raw);
  const record = submitted.record ?? published?.record ?? null;
  const anchor = submitted.anchor ?? published?.anchor ?? null;
  const source = published ? published.source : "submitted_record";

  const protocol = verifySubmitted(record, anchor);
  if (protocol) {
    const identifier = submitted.raw.trim()
      ? deriveInputIdentifier(submitted.raw)
      : "";
    const keysLive = await jwksLive();
    const signature = protocol.checks.signature;
    const vector = {
      identity: "not_supplied" as const,
      issuer: "unknown" as const,
      signature: signature === true ? ("verified" as const) : signature === false ? ("failed" as const) : ("unknown" as const),
      provenance: "unknown" as const,
      physical_binding: "unknown" as const,
      scan_behavior: "unknown" as const,
      revocation: "clear" as const,
      freshness: "unknown" as const,
    };
    const chainName = String(anchor?.chain || "");
    const polygonChain = chainName === "polygon:137" || chainName === "eip155:137";
    const chain = await readAnchorOnChain(record, anchor, {
      rpcUrl: polygonChain ? env.POLYGON_RPC_URL : undefined,
    });
    const subject = isRecord(record?.credentialSubject) ? record.credentialSubject : null;
    console.log(JSON.stringify({ evt: "verify", identifier, decision: protocol.decision, source, chain: chain.status }));
    return json(
      {
        verdict: protocol.verdict,
        reasons: protocol.reasons,
        checks: protocol.checks,
        decision: protocol.decision,
        vector,
        unknowns: chain.onChain
          ? ["physical_binding_not_inspected"]
          : ["physical_binding_not_inspected", "anchor_transaction_not_on_chain"],
        depthUsed: "protocol",
        qron_id: identifier || null,
        anchored: protocol.anchored,
        anchorTransactionQueried: chain.queried,
        anchorOnChain: chain.onChain,
        anchorChainStatus: chain.status,
        polygon: {
          contract: null,
          queried: chain.queried,
          status: chain.status,
          block: chain.block ?? null,
        },
        jwks: { url: JWKS_URL, live: keysLive },
        verifiedAt: new Date().toISOString(),
        input: submitted.raw,
        source,
        demonstration: source === "published_example",
        subject: subject
          ? { id: subject.id ?? null, name: subject.name ?? null }
          : null,
        product: null,
        tokenId: null,
      },
      200,
      { "Cache-Control": "no-store" },
    );
  }

  const rawInput = submitted.raw;
  if (!rawInput.trim()) return json({ error: "Missing input parameter" }, 400);

  const identifier = deriveInputIdentifier(rawInput);
  const keysLive = await jwksLive();

  const fixture = lookupFixture(identifier);
  if (fixture) {
    const kernel = evaluate(fixture.input);
    const decision = kernel.decision === "verified" ? "invalid" : kernel.decision;
    const reasons =
      kernel.decision === "verified"
        ? [...kernel.reasons, "no_ed25519_record"]
        : kernel.reasons;
    console.log(JSON.stringify({ evt: "verify", identifier, decision, source: "fixture" }));
    return json(
      kernelEnvelope(
        identifier,
        rawInput,
        keysLive,
        { ...kernel, decision, reasons },
        {
          source: "fixture",
          label: fixture.label,
          product: null,
          protocol: null,
        },
      ),
      200,
      { "Cache-Control": "no-store" },
    );
  }

  const library = libraryPageFor(identifier);
  if (library) {
    const kernel = evaluate({});
    kernel.reasons.push("library_page_is_not_a_seal");
    return json(
      kernelEnvelope(identifier, rawInput, keysLive, kernel, {
        source: "library",
        page: library,
        product: null,
      }),
      200,
      { "Cache-Control": "no-store" },
    );
  }

  let product: SupabaseProduct | null = null;
  try {
    product = await lookupProduct(identifier, env);
  } catch (err) {
    console.log(JSON.stringify({ evt: "verify_lookup_error", err: String(err) }));
  }

  const kernel = evaluate(
    product
      ? {
          objectFound: true,
          objectId: product.product_identifier,
          identity: { serial: product.product_identifier },
          depth: "lookup",
          crypto: {
            signatureValid: undefined,
            issuerTrusted: undefined,
            identityValid: true,
            evidenceIntact: undefined,
            statusActive: product.is_active !== false,
          },
          attestation: {
            objectId: product.product_identifier,
            status: product.is_active === false ? "inactive" : "registered",
            issuer: "supabase-products",
          },
        }
      : {},
  );

  console.log(JSON.stringify({ evt: "verify", identifier, decision: kernel.decision, source: product ? "supabase" : "none" }));

  return json(
    kernelEnvelope(identifier, rawInput, keysLive, kernel, {
      source: product ? "supabase" : "none",
      product: product
        ? {
            productIdentifier: product.product_identifier,
            isActive: product.is_active,
            name: product.name,
            industryId: product.industry_id,
          }
        : null,
      tokenId: typeof product?.token_id === "number" ? product.token_id : null,
    }),
    200,
    { "Cache-Control": "no-store" },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (path === "/health" || path === "/api/health") {
      return json({
        status: "ok",
        worker: "authichain-verify-worker",
        ts: Date.now(),
        contract: "evaluate",
        draft: true,
      });
    }

    if (path === "/verify/cta" || path === "/api/verify/cta") {
      logEvent("verify_cta_clicked", {
        qron_id: url.searchParams.get("id") || null,
        ref: url.searchParams.get("ref") || null,
      });
      return new Response(null, {
        status: 302,
        headers: { ...CORS_HEADERS, Location: ONBOARD_URL, "Cache-Control": "no-store" },
      });
    }

    if (path === "/verify" || path === "/api/verify") {
      return handleVerify(request, env, url);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};


// Canonical Agent Trust contracts and verification
export * from "./agent-types";
export * from "./agent-message";
export * from "./agent-store";
export * from "./agent-verifier";
export * from "./agent-issuer";
export * from "./outbound-types";
export * from "./acquisition-ledger";
export * from "./outbound-gate";
export * from "./scout";
export * from "./agent-dogfood";
