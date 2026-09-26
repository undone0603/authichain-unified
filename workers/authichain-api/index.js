/**
 * authichain-api v3.0 — Production RapidAPI Gateway
 *
 * CRITICAL FIX: v2.x returned MOCK data for all endpoints.
 * v3.0 queries REAL Supabase backend for verify/classify/register/analytics.
 * This is what RapidAPI subscribers pay for.
 *
 * Plans: Free (10/hr), Basic ($9/mo, 100/day), Pro ($29/mo, 1000/day), Ultra ($99/mo, 10000/day)
 * Auth: X-RapidAPI-Key, X-API-Key, or Authorization Bearer
 *
 * Routes:
 *   GET  /health, /api/v1/health          → status
 *   GET  /api/v1/pricing                  → plan tiers
 *   GET  /api/v1/industries               → supported verticals
 *   POST /api/v1/keys/create              → self-serve API key (no auth)
 *   POST /api/v1/verify                   → verify product (REAL DATA)
 *   POST /api/v1/classify                 → AI classification (REAL DATA)
 *   POST /api/v1/register                 → register product (REAL DATA)
 *   GET  /api/v1/products                 → list products (REAL DATA)
 *   GET  /api/v1/analytics                → dashboard metrics (REAL DATA)
 *   GET  /api/v1/me                       → account info
 *   POST /api/v1/qr/generate              → generate QR art via qron-image-gen
 *   GET  /api/v1/.well-known/jwks.json    → Ed25519 public key for certificates
 *
 * Secrets / vars (service-worker globals):
 *   SUPABASE_ANON_KEY           (secret, required)
 *   CERT_SIGNING_KEY            (secret, optional) Ed25519 private key; enables
 *                               signed verification certificates + JWKS
 *   CERT_SIGNING_KEY_ID         (optional) kid override; default RFC 7638 thumbprint
 *   POLYGON_RPC_URL             (optional) JSON-RPC used to confirm stored anchor tx
 *   ANCHOR_CONTRACT_ADDRESSES   (optional) comma list; default the AuthiChain contract
 *   ALLOW_UNREGISTERED_SELF_SERVE_KEYS ("true" to keep accepting unsaved
 *                               ac_live_ keys issued before key persistence)
 */

const SUPA_URL = "https://nhdnkzhtadfkkluiulhs.supabase.co";
// SUPABASE_ANON_KEY is injected as a global by Cloudflare Workers secret bindings
// (service-worker syntax). Set via: wrangler secret put SUPABASE_ANON_KEY --name authichain-api

const PLANS = {
  free: { name: "Free", price: "$0", dailyLimit: 100, hourlyLimit: 10 },
  basic: { name: "Basic", price: "$9/mo", dailyLimit: 100, hourlyLimit: 100 },
  pro: { name: "Pro", price: "$29/mo", dailyLimit: 1000, hourlyLimit: 1000 },
  ultra: {
    name: "Ultra",
    price: "$99/mo",
    dailyLimit: 10000,
    hourlyLimit: 10000,
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    dailyLimit: 999999,
    hourlyLimit: 999999,
  },
};

const DEMO_KEYS = {
  demo_test_key_2026: { plan: "free", name: "Demo User", isDemo: true },
  rapidapi_test_2026: { plan: "basic", name: "RapidAPI Test", isDemo: true },
};

const INDUSTRIES = {
  cannabis: {
    name: "Cannabis & Hemp",
    icon: "🌿",
    keywords: [
      "cannabis",
      "marijuana",
      "cbd",
      "thc",
      "hemp",
      "strain",
      "dispensary",
      "terpene",
    ],
  },
  luxury: {
    name: "Luxury Goods",
    icon: "💎",
    keywords: [
      "luxury",
      "designer",
      "premium",
      "jewelry",
      "watch",
      "handbag",
      "hermes",
      "rolex",
      "gucci",
    ],
  },
  electronics: {
    name: "Electronics",
    icon: "📱",
    keywords: [
      "electronic",
      "tech",
      "device",
      "phone",
      "computer",
      "chip",
      "semiconductor",
    ],
  },
  pharmaceutical: {
    name: "Pharmaceutical",
    icon: "💊",
    keywords: [
      "pharma",
      "medicine",
      "drug",
      "prescription",
      "medical",
      "vaccine",
      "fda",
      "dscsa",
    ],
  },
  food: {
    name: "Food & Beverage",
    icon: "🍃",
    keywords: [
      "food",
      "beverage",
      "organic",
      "restaurant",
      "farm",
      "coffee",
      "tea",
      "wine",
      "beer",
    ],
  },
  automotive: {
    name: "Automotive",
    icon: "🚗",
    keywords: [
      "auto",
      "car",
      "vehicle",
      "parts",
      "engine",
      "tire",
      "oem",
      "motor",
    ],
  },
  cosmetics: {
    name: "Cosmetics",
    icon: "💄",
    keywords: [
      "cosmetic",
      "beauty",
      "makeup",
      "skincare",
      "fragrance",
      "serum",
      "perfume",
    ],
  },
  art: {
    name: "Fine Art",
    icon: "🎨",
    keywords: [
      "art",
      "painting",
      "sculpture",
      "collectible",
      "gallery",
      "canvas",
      "limited",
      "edition",
    ],
  },
  fashion: {
    name: "Fashion",
    icon: "👔",
    keywords: [
      "fashion",
      "clothing",
      "apparel",
      "textile",
      "garment",
      "denim",
      "streetwear",
    ],
  },
  collectibles: {
    name: "Collectibles",
    icon: "🏆",
    keywords: [
      "collectible",
      "sports",
      "trading",
      "card",
      "memorabilia",
      "autograph",
      "graded",
    ],
  },
  agriculture: {
    name: "Agriculture",
    icon: "🌾",
    keywords: [
      "farm",
      "crop",
      "grain",
      "organic",
      "harvest",
      "seed",
      "agriculture",
      "livestock",
    ],
  },
  industrial: {
    name: "Industrial",
    icon: "🏭",
    keywords: [
      "industrial",
      "manufacturing",
      "machinery",
      "steel",
      "fabrication",
      "cnc",
    ],
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, X-RapidAPI-Key, X-RapidAPI-Host",
};

function j(data, status, extraHeaders) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status || 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
  });
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
// NOTE: products has no tenant_id column (the 20260829_add_tenant_isolation
// migration was never applied to the live database — see
// supabase/REMOTE_APPLIED_VERSIONS.txt). Do not filter on it.
function supaHeaders(prefer) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: prefer || "return=representation",
  };
}

async function supaGet(table, params) {
  const res = await fetch(SUPA_URL + "/rest/v1/" + table + (params || ""), {
    headers: supaHeaders(),
  });
  return res.json();
}

// Inserts that only need to land (audit logs) must use return=minimal: with
// return=representation PostgREST also needs a SELECT policy on the new row,
// and tables like `verifications` only grant anon INSERT — so every log write
// was rejected (verifications had 0 rows in production).
async function supaInsert(table, body) {
  const res = await fetch(SUPA_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: supaHeaders("return=minimal"),
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

async function supaPost(table, body) {
  const res = await fetch(SUPA_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: supaHeaders(),
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, data: data, status: res.status };
}

// SECURITY DEFINER functions from
// supabase/migrations/20260925180000_authichain_api_self_serve_keys.sql.
async function supaRpc(fn, args) {
  const res = await fetch(SUPA_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: supaHeaders(),
    body: JSON.stringify(args || {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data };
}

// Service-worker syntax: vars and secrets are globals.
function envVar(name) {
  const v = globalThis[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ── Base64url / Ed25519 certificate signing ──────────────────────────────────
function b64urlFromBytes(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(str) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function bytesFromB64(b64) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Accepts the same formats as the attestation issuer (worker-app/jwks.ts):
// base64(PKCS#8 PEM) as written by scripts/bind-attestation-jwks.mjs, a raw
// PEM, base64 PKCS#8 DER, or a private OKP JWK JSON string.
function parseSigningKeyMaterial(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const jwk = JSON.parse(trimmed);
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x)
      throw new Error("CERT_SIGNING_KEY JWK must be a private Ed25519 OKP key");
    return { format: "jwk", jwk: jwk };
  }
  let pem = trimmed;
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = atob(trimmed.replace(/\s+/g, ""));
      if (decoded.includes("BEGIN PRIVATE KEY")) pem = decoded;
    } catch (e) {
      /* not base64 PEM */
    }
  }
  const body = pem.includes("BEGIN PRIVATE KEY")
    ? pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
    : pem;
  return { format: "pkcs8", der: bytesFromB64(body) };
}

let signingKeyPromise = null;
let signingKeySource = null;

async function loadSigningKey() {
  const raw = envVar("CERT_SIGNING_KEY");
  if (!raw) return null;
  if (signingKeyPromise && signingKeySource === raw) return signingKeyPromise;
  signingKeySource = raw;
  signingKeyPromise = (async function () {
    const material = parseSigningKeyMaterial(raw);
    let privateKey;
    let publicJwk;
    if (material.format === "jwk") {
      privateKey = await crypto.subtle.importKey(
        "jwk",
        material.jwk,
        { name: "Ed25519" },
        false,
        ["sign"]
      );
      publicJwk = { kty: "OKP", crv: "Ed25519", x: material.jwk.x };
    } else {
      const extractable = await crypto.subtle.importKey(
        "pkcs8",
        material.der,
        { name: "Ed25519" },
        true,
        ["sign"]
      );
      const exported = await crypto.subtle.exportKey("jwk", extractable);
      publicJwk = { kty: "OKP", crv: "Ed25519", x: exported.x };
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        material.der,
        { name: "Ed25519" },
        false,
        ["sign"]
      );
    }
    // RFC 7638 thumbprint — same default kid as worker-app/jwks.ts (jose).
    const thumbInput = JSON.stringify({
      crv: publicJwk.crv,
      kty: publicJwk.kty,
      x: publicJwk.x,
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(thumbInput)
    );
    const kid = envVar("CERT_SIGNING_KEY_ID") || b64urlFromBytes(digest);
    return {
      kid: kid,
      privateKey: privateKey,
      publicJwk: { ...publicJwk, kid: kid, use: "sig", alg: "EdDSA" },
    };
  })();
  signingKeyPromise.catch(function () {
    signingKeyPromise = null;
    signingKeySource = null;
  });
  return signingKeyPromise;
}

// Compact JWS (RFC 7515) with alg EdDSA — verifiable with any JOSE library
// against the JWKS served at /api/v1/.well-known/jwks.json.
async function signCertificate(payload, origin) {
  let key;
  try {
    key = await loadSigningKey();
  } catch (e) {
    return { certificate: null, certificate_error: "signing key invalid" };
  }
  if (!key)
    return {
      certificate: null,
      certificate_error: "signing key not configured (CERT_SIGNING_KEY)",
    };
  const header = { alg: "EdDSA", kid: key.kid, typ: "authichain-cert+jws" };
  const signingInput =
    b64urlFromString(JSON.stringify(header)) +
    "." +
    b64urlFromString(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    { name: "Ed25519" },
    key.privateKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = b64urlFromBytes(sig);
  return {
    certificate: {
      format: "JWS",
      alg: "EdDSA",
      kid: key.kid,
      jwks_url: origin + "/api/v1/.well-known/jwks.json",
      payload: payload,
      signature: signature,
      jws: signingInput + "." + signature,
    },
  };
}

// ── Evidence-based trust assessment ──────────────────────────────────────────
// Only facts present on the product row (plus an optional on-chain receipt
// lookup) count. The stored `authenticity_score` / `confidence` values are
// self-reported and are NOT used. No confirmed evidence => verified:false.
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const CONTENT_HASH_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT_RE = /^[A-Za-z0-9._:\-]{1,128}$/;
const DEFAULT_ANCHOR_CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const UNIT_MATCH_TYPES = ["truemark_id", "serial_number", "id"];

function anchorContracts() {
  return (envVar("ANCHOR_CONTRACT_ADDRESSES") || DEFAULT_ANCHOR_CONTRACT)
    .split(",")
    .map(function (s) {
      return s.trim().toLowerCase();
    })
    .filter(Boolean);
}

// Looks up the stored tx hash on Polygon via POLYGON_RPC_URL (unset => the
// anchor is reported "unchecked" and cannot contribute to verification).
async function checkOnchainAnchor(txHash) {
  if (!txHash || !TX_HASH_RE.test(txHash))
    return {
      status: "absent",
      detail: txHash ? "stored value is not a transaction hash" : null,
    };
  const rpc = envVar("POLYGON_RPC_URL");
  if (!rpc)
    return {
      status: "unchecked",
      detail: "POLYGON_RPC_URL not configured; stored hash not checked",
    };
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json();
    const receipt = body && body.result;
    if (!receipt)
      return { status: "not_found", detail: "no receipt on chain for tx" };
    if (receipt.status !== "0x1")
      return { status: "failed", detail: "transaction reverted" };
    const to = String(receipt.to || "").toLowerCase();
    if (anchorContracts().indexOf(to) === -1)
      return {
        status: "wrong_contract",
        detail: "tx is not to a known AuthiChain anchor contract",
        to: receipt.to,
      };
    return {
      status: "confirmed",
      detail: "receipt found, status success, known anchor contract",
      block: receipt.blockNumber,
      to: receipt.to,
    };
  } catch (e) {
    return { status: "error", detail: "RPC lookup failed" };
  }
}

function assessEvidence(product, matchType, anchor) {
  const checks = [];
  function add(id, passed, weight, detail) {
    checks.push({
      id: id,
      passed: !!passed,
      weight: passed ? weight : 0,
      detail: detail || null,
    });
  }
  add(
    "registered",
    product.is_registered === true && !!product.truemark_id,
    20,
    "product is registered with a TrueMark id"
  );
  add(
    "unit_identifier",
    UNIT_MATCH_TYPES.indexOf(matchType) !== -1,
    10,
    matchType === "sku"
      ? "matched by SKU, which identifies a product line, not a unit"
      : "matched by " + matchType
  );
  add(
    "attributed_origin",
    product.data_origin === "attributed",
    10,
    "data_origin=" + (product.data_origin || "null")
  );
  add(
    "content_hash",
    !!product.blockchain_hash && CONTENT_HASH_RE.test(product.blockchain_hash),
    5,
    "stored content fingerprint (not independently checkable here)"
  );
  add(
    "onchain_anchor",
    anchor.status === "confirmed",
    50,
    "anchor " + anchor.status + (anchor.detail ? ": " + anchor.detail : "")
  );
  const reports = Number(product.counterfeit_reports || 0);
  add(
    "no_counterfeit_reports",
    reports === 0,
    5,
    reports ? reports + " counterfeit report(s)" : "none on record"
  );
  const statusOk =
    !product.status ||
    product.status === "active" ||
    product.status === "published";
  add("status_active", statusOk, 0, "status=" + (product.status || "null"));

  let score = checks.reduce(function (sum, c) {
    return sum + c.weight;
  }, 0);
  score -= Math.min(60, reports * 30);
  score = Math.max(0, Math.min(100, score));
  const byId = {};
  checks.forEach(function (c) {
    byId[c.id] = c.passed;
  });
  const verified =
    byId.registered &&
    byId.unit_identifier &&
    byId.onchain_anchor &&
    byId.no_counterfeit_reports &&
    byId.status_active;
  return { verified: !!verified, trust_score: score, checks: checks };
}

function pickMatch(rows, candidates) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const order = ["id", "truemark_id", "serial_number", "sku"];
  for (let i = 0; i < order.length; i++) {
    const col = order[i];
    const hits = rows.filter(function (r) {
      const v = r[col];
      return (
        v != null &&
        candidates.indexOf(col === "id" ? String(v).toLowerCase() : String(v)) !==
          -1
      );
    });
    if (hits.length === 1) return { product: hits[0], matchType: col };
    if (hits.length > 1)
      return {
        product: null,
        matchType: col,
        ambiguous: hits.map(function (h) {
          return h.truemark_id;
        }),
      };
  }
  return null;
}

// ── Auth & Tenant Resolution ──────────────────────────────────────────────────
async function resolveKey(req) {
  const key =
    req.headers.get("X-RapidAPI-Key") ||
    req.headers.get("X-API-Key") ||
    (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!key) return null;
  if (DEMO_KEYS[key]) return { valid: true, ...DEMO_KEYS[key] };

  // Provisioned tenants and self-serve keys both live in white_label_clients.
  // That table has RLS enabled with no anon policies, so a direct anon SELECT
  // always returned [] (every key fell through to the degraded fallback).
  // Lookups go through the SECURITY DEFINER function authichain_api_resolve_key
  // (matches plaintext keys from provisionTenant and sha256-hashed self-serve keys).
  let lookupWorked = false;
  try {
    const r = await supaRpc("authichain_api_resolve_key", { p_api_key: key });
    lookupWorked = r.ok;
    const client = r.ok && Array.isArray(r.data) ? r.data[0] : null;
    if (client) {
      const plan = client.billing_plan || "free";
      return {
        valid: true,
        id: client.id,
        client_id: client.id,
        user_id: client.user_id == null ? null : client.user_id,
        plan,
        limit: client.api_call_limit || (PLANS[plan] || PLANS.free).dailyLimit,
        name: client.company_name || "API User",
        isDemo: false,
      };
    }
  } catch (e) {
    /* fall through */
  }

  // Legacy: ac_live_ keys issued before persistence worked were never saved.
  // Accept them (degraded, free tier) only while the lookup function is not
  // deployed yet, or when ALLOW_UNREGISTERED_SELF_SERVE_KEYS=true.
  if (
    key.startsWith("ac_live_") &&
    (!lookupWorked || envVar("ALLOW_UNREGISTERED_SELF_SERVE_KEYS") === "true")
  ) {
    return {
      valid: true,
      plan: "free",
      limit: 10,
      name: "Self-Serve User",
      isDemo: false,
      degraded: true,
    };
  }

  // RapidAPI keys pass through — trust the proxy
  if (req.headers.get("X-RapidAPI-Key")) {
    return {
      valid: true,
      plan: "basic",
      limit: 100,
      name: "RapidAPI User",
      isDemo: false,
    };
  }

  return null;
}

function classifyIndustry(text) {
  const lower = (text || "").toLowerCase();
  let best = "general",
    bestScore = 0;
  for (const [id, ind] of Object.entries(INDUSTRIES)) {
    const score = ind.keywords.filter(function (k) {
      return lower.includes(k);
    }).length;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return {
    id: best,
    score: bestScore,
    industry: INDUSTRIES[best] || { name: "General", icon: "📦" },
  };
}

function secretsConfigured() {
  return typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 0;
}

addEventListener("fetch", function (event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(req) {
  var url = new URL(req.url);
  var path = url.pathname;
  var method = req.method;

  if (method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS });

  // ── Public endpoints (no auth) ─────────────────────────────────────────
  if (path === "/" || path === "/health" || path === "/api/v1/health") {
    return j({
      status: secretsConfigured() ? "ok" : "missing_secrets",
      version: "3.1.0",
      service: "authichain-api",
      rapidapi: true,
      realData: true,
      secrets_configured: secretsConfigured(),
      signing_configured: !!envVar("CERT_SIGNING_KEY"),
      timestamp: new Date().toISOString(),
    });
  }

  // ── JWKS: public key for verification certificates (no auth) ─────────────
  if (
    method === "GET" &&
    (path === "/api/v1/.well-known/jwks.json" ||
      path === "/.well-known/jwks.json")
  ) {
    let key = null;
    try {
      key = await loadSigningKey();
    } catch (e) {
      return j({ error: "signing key invalid" }, 503, {
        "Cache-Control": "no-store",
      });
    }
    if (!key)
      return j({ error: "signing key not configured" }, 503, {
        "Cache-Control": "no-store",
      });
    return j({ keys: [key.publicJwk] }, 200, {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    });
  }

  if (!secretsConfigured()) {
    return j(
      {
        error:
          "Worker secret not configured: set SUPABASE_ANON_KEY via wrangler secret put",
      },
      500
    );
  }

  if (path === "/api/v1/pricing") {
    return j({
      success: true,
      plans: Object.entries(PLANS).map(function (e) {
        return {
          id: e[0],
          name: e[1].name,
          price: e[1].price,
          requests: e[0] === "free" ? "10/hour" : e[1].dailyLimit + "/day",
        };
      }),
      subscribe:
        "https://rapidapi.com/authichain-authichain-default/api/authichain-api",
    });
  }

  if (path === "/api/v1/industries") {
    return j({
      success: true,
      industries: Object.entries(INDUSTRIES).map(function (e) {
        return { id: e[0], name: e[1].name, icon: e[1].icon };
      }),
    });
  }

  // ── Self-serve API key creation (no auth) ──────────────────────────────
  if (path === "/api/v1/keys/create") {
    if (method === "GET") {
      return j({
        endpoint: "POST /api/v1/keys/create",
        body: { email: "your@email.com" },
        description: "Create a free AuthiChain API key instantly.",
      });
    }
    var bk = {};
    try {
      bk = await req.json();
    } catch (e) {}
    var email = String(bk.email || "")
      .trim()
      .toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email))
      return j({ error: "Valid email required" }, 400);

    var keyBytes = new Uint8Array(24);
    crypto.getRandomValues(keyBytes);
    var apiKey =
      "ac_live_" +
      Array.from(keyBytes)
        .map(function (x) {
          return x.toString(16).padStart(2, "0");
        })
        .join("")
        .slice(0, 32);

    // Was: fire-and-forget anon inserts into white_label_clients and leads.
    // Both were rejected by RLS (white_label_clients: RLS on, no policies;
    // leads: insert requires assigned_to = auth.uid()) and the errors were
    // swallowed, so keys and leads were never saved. Persist through the
    // SECURITY DEFINER function instead (stores only a sha256 of the key and
    // upserts the lead) and refuse to hand out a key that was not saved.
    var saved = await supaRpc("authichain_api_create_key", {
      p_email: email,
      p_api_key: apiKey,
      p_name: bk.name ? String(bk.name).slice(0, 200) : null,
    }).catch(function () {
      return { ok: false, status: 0, data: null };
    });
    if (!saved.ok) {
      var tooMany =
        saved.data &&
        typeof saved.data.message === "string" &&
        saved.data.message.indexOf("key_limit_reached") !== -1;
      return j(
        tooMany
          ? { error: "Key limit reached for this email" }
          : {
              error: "Could not save API key",
              message: "Key storage is unavailable. Please try again later.",
            },
        tooMany ? 429 : 503
      );
    }

    return j(
      {
        success: true,
        api_key: apiKey,
        plan: "free",
        email: email,
        message: "Your AuthiChain API key is ready!",
        usage: {
          endpoint: "https://authichain.com/api/v1",
          header: "X-API-Key: " + apiKey,
          docs: "https://authichain.com/openapi.json",
          rate_limit: "10 calls/hour on Free",
        },
      },
      201
    );
  }

  // ── Auth-gated endpoints ───────────────────────────────────────────────
  var kd = await resolveKey(req);
  if (!kd) {
    return j(
      {
        error: "Missing API key",
        message:
          "Include your key in X-RapidAPI-Key, X-API-Key, or Authorization Bearer header.",
        get_free_key:
          'POST /api/v1/keys/create with {"email":"you@example.com"}',
        subscribe:
          "https://rapidapi.com/authichain-authichain-default/api/authichain-api",
      },
      401
    );
  }

  var rateHeaders = {
    "X-RateLimit-Requests-Limit": String(kd.limit || 10),
    "X-RateLimit-Requests-Remaining": String(kd.limit || 10),
  };

  try {
    // ── VERIFY (REAL DATA, SIGNED) ──────────────────────────────────────────
    if (path === "/api/v1/verify" && method === "POST") {
      var started = Date.now();
      var b = await req.json().catch(function () {
        return {};
      });
      var serial = b.serial || b.productId || b.id || b.truemark_id || "";
      if (!serial) return j({ error: "serial or productId required" }, 400);
      var identifier = String(serial).trim();
      if (!IDENT_RE.test(identifier))
        return j(
          {
            error: "Invalid identifier",
            message: "Use 1-128 characters: letters, digits, . _ : -",
          },
          400
        );

      // Exact matches on real columns only (truemark_id, serial_number, sku,
      // id). The old query filtered on products.tenant_id, which does not
      // exist, so PostgREST returned an error object and every lookup was
      // "not_found". The old fuzzy fallback (ilike on the last 8 chars) is
      // gone: a verifier must not report a different product as a match.
      var candidates = [identifier];
      if (identifier.toUpperCase() !== identifier)
        candidates.push(identifier.toUpperCase());
      var ors = [];
      candidates.forEach(function (v) {
        ors.push('truemark_id.eq."' + v + '"');
        ors.push('serial_number.eq."' + v + '"');
        ors.push('sku.eq."' + v + '"');
      });
      if (UUID_RE.test(identifier)) {
        ors.push("id.eq." + identifier.toLowerCase());
        candidates.push(identifier.toLowerCase());
      }
      // Optional tenant scope on a real column: products.user_id.
      var scope =
        b.scope === "tenant" && kd.user_id != null
          ? "&user_id=eq." + encodeURIComponent(String(kd.user_id))
          : "";
      var rows = await supaGet(
        "products",
        "?or=" +
          encodeURIComponent("(" + ors.join(",") + ")") +
          "&is_registered=eq.true" +
          scope +
          "&limit=10&select=id,name,description,brand,category,image_url,truemark_id,sku,serial_number,blockchain_tx_hash,blockchain_hash,nft_token_id,nft_contract_address,counterfeit_reports,data_origin,status,is_registered,industry_id,created_at,story"
      );
      if (!Array.isArray(rows))
        return j(
          { error: "Product lookup failed", message: "upstream query error" },
          502
        );

      var match = pickMatch(rows, candidates);
      var product = match && match.product ? match.product : null;
      var anchor = product
        ? await checkOnchainAnchor(product.blockchain_tx_hash)
        : { status: "absent", detail: null };
      var assessment = product
        ? assessEvidence(product, match.matchType, anchor)
        : { verified: false, trust_score: 0, checks: [] };
      var status = product
        ? assessment.verified
          ? "verified"
          : "unverified"
        : match && match.ambiguous
          ? "ambiguous"
          : "not_found";

      var certId = crypto.randomUUID();
      var nowSec = Math.floor(Date.now() / 1000);
      var certPayload = {
        typ: "authichain.verification.v1",
        iss: url.origin,
        jti: certId,
        iat: nowSec,
        query: identifier,
        result: {
          status: status,
          verified: assessment.verified,
          trust_score: assessment.trust_score,
          match_type: match ? match.matchType : null,
        },
        product: product
          ? {
              id: product.id,
              truemark_id: product.truemark_id,
              sku: product.sku,
              serial_number: product.serial_number,
              name: product.name,
              brand: product.brand,
            }
          : null,
        evidence: assessment.checks,
        anchor: product
          ? {
              network: "Polygon",
              tx_hash: product.blockchain_tx_hash || null,
              status: anchor.status,
              block: anchor.block || null,
            }
          : null,
      };
      var signed = await signCertificate(certPayload, url.origin);

      // Log verification attempt (return=minimal — see supaInsert).
      await supaInsert("verifications", {
        raw_input: identifier.substring(0, 200),
        result: status,
        verdict: status,
        trust_score: assessment.trust_score,
        score: assessment.trust_score,
        signals: { checks: assessment.checks, anchor: anchor.status },
        cert_id: signed.certificate ? certId : null,
        ip_address: req.headers.get("CF-Connecting-IP"),
        country: req.headers.get("CF-IPCountry"),
        user_agent: (req.headers.get("User-Agent") || "").substring(0, 300),
        product_id: product ? product.id : null,
        truemark_id: product ? product.truemark_id : null,
        product_name: product ? product.name : null,
        brand: product ? product.brand : null,
        latency_ms: Date.now() - started,
      }).catch(function () {});

      var out = {
        success: !!product,
        verified: assessment.verified,
        status: status,
        trust_score: assessment.trust_score,
        message: product
          ? assessment.verified
            ? "Verified: registered unit with a confirmed on-chain anchor."
            : "Registered product found, but the evidence on record is not sufficient to verify it."
          : status === "ambiguous"
            ? "Identifier matches several registered products (e.g. a SKU). Use the TrueMark id or serial number."
            : "No registered product found for this identifier.",
        evidence: assessment.checks,
        certificate: signed.certificate,
        plan: kd.plan,
      };
      if (signed.certificate_error)
        out.certificate_error = signed.certificate_error;
      if (status === "ambiguous") out.candidates = match.ambiguous;
      if (!product) out.raw_input = identifier;
      if (product) {
        out.product = {
          id: product.id,
          name: product.name,
          description: product.description,
          brand: product.brand,
          category: product.category,
          image_url: product.image_url,
          truemark_id: product.truemark_id,
          sku: product.sku,
          serial_number: product.serial_number,
          industry: product.industry_id,
          story: product.story,
          registered_at: product.created_at,
        };
        out.blockchain = {
          network: "Polygon",
          contract: DEFAULT_ANCHOR_CONTRACT,
          tx_hash: product.blockchain_tx_hash,
          anchor_status: anchor.status,
          verified_at: anchor.status === "confirmed" ? new Date().toISOString() : null,
        };
      }
      return j(out, 200, rateHeaders);
    }

    // ── CLASSIFY (REAL AI) ────────────────────────────────────────────────
    if (path === "/api/v1/classify" && method === "POST") {
      var b2 = await req.json().catch(function () {
        return {};
      });
      var text =
        (b2.name || "") +
        " " +
        (b2.category || "") +
        " " +
        (b2.description || "") +
        " " +
        (b2.keywords || []).join(" ");
      var cls = classifyIndustry(text);

      return j(
        {
          success: true,
          classification: {
            name: b2.name || "Unknown Product",
            category: b2.category || "General",
            brand: b2.brand || "Unknown",
            industryId: cls.id,
            industry: cls.industry.name,
            industryIcon: cls.industry.icon,
            confidence: cls.score > 2 ? 95 : cls.score > 0 ? 78 : 55,
            features: ["AI-classified", "Blockchain-ready", "QRON-compatible"],
            complianceFrameworks:
              cls.id === "cannabis"
                ? ["METRC", "State Seed-to-Sale"]
                : cls.id === "pharmaceutical"
                  ? ["DSCSA", "FDA-UDI"]
                  : cls.id === "luxury"
                    ? ["EU-DPP"]
                    : [],
          },
          plan: kd.plan,
        },
        200,
        rateHeaders
      );
    }

    // ── REGISTER (REAL DATA) ──────────────────────────────────────────────
    if (path === "/api/v1/register" && method === "POST") {
      var b3 = await req.json().catch(function () {
        return {};
      });
      if (!b3.name || !b3.category)
        return j({ error: "name and category required" }, 400);

      var cls2 = classifyIndustry(
        b3.name + " " + b3.category + " " + (b3.brand || "")
      );
      var randBytes = new Uint8Array(8);
      crypto.getRandomValues(randBytes);
      var tmSuffix = Array.from(randBytes)
        .map(function (x) {
          return x.toString(16).padStart(2, "0");
        })
        .join("")
        .slice(0, 10)
        .toUpperCase();
      var prefix =
        "AUTHI-" +
        (b3.brand || "PROD").substring(0, 4).toUpperCase() +
        "-" +
        cls2.id.substring(0, 3).toUpperCase();
      var truemarkId = prefix + "-" + tmSuffix;

      var txHash = "pending_anchoring";

      // Insert into real Supabase products table. products has no tenant_id
      // column; the owning user (if the key belongs to a provisioned tenant
      // with a user_id) goes in products.user_id.
      var insertBody = {
        name: b3.name,
        brand: b3.brand || "Unknown",
        category: b3.category,
        description: b3.description || null,
        image_url: b3.image_url || null,
        industry_id: cls2.id,
        truemark_id: truemarkId,
        blockchain_tx_hash: txHash,
        is_registered: true,
        confidence: 0,
        story: b3.name + " has been registered. Awaiting blockchain anchoring.",
      };
      if (kd.user_id != null) insertBody.user_id = kd.user_id;
      var insertResult = await supaPost("products", insertBody);

      var newProduct = Array.isArray(insertResult.data)
        ? insertResult.data[0]
        : insertResult.data;

      // Previously a failed insert still returned success with a made-up id.
      if (!insertResult.ok || !newProduct || !newProduct.id) {
        return j(
          {
            success: false,
            error: "Product was not saved",
            message:
              "Registration storage rejected the insert; nothing was registered.",
            upstream_status: insertResult.status,
          },
          502,
          rateHeaders
        );
      }

      return j(
        {
          success: true,
          product: {
            id: newProduct.id,
            name: b3.name,
            brand: b3.brand || "Unknown",
            category: b3.category,
            truemark_id: truemarkId,
            blockchain_tx_hash: txHash,
            registered_at: new Date().toISOString(),
          },
          qrPayload: {
            truemark_id: truemarkId,
            scan_url: "https://authichain.com/api/verify/" + truemarkId,
            verify_url: "https://authichain.com/verify?id=" + truemarkId,
          },
          plan: kd.plan,
        },
        201,
        rateHeaders
      );
    }

    // ── PRODUCTS (REAL DATA) ──────────────────────────────────────────────
    if (path === "/api/v1/products" && method === "GET") {
      var cat = url.searchParams.get("category");
      var limit = Math.min(
        parseInt(url.searchParams.get("limit") || "20"),
        100
      );
      var offset = parseInt(url.searchParams.get("offset") || "0");
      var filter = cat ? "&category=eq." + encodeURIComponent(cat) : "";

      // Scope to the key owner's products (products.user_id) when the key
      // belongs to a provisioned tenant with a user_id; otherwise list
      // registered products (the same rows the public RLS policy exposes).
      var ownerFilter =
        kd.user_id != null
          ? "&user_id=eq." + encodeURIComponent(String(kd.user_id))
          : "";
      var prods = await supaGet(
        "products",
        "?is_registered=eq.true" +
          ownerFilter +
          filter +
          "&order=created_at.desc&limit=" +
          limit +
          "&offset=" +
          offset +
          "&select=id,name,brand,category,truemark_id,blockchain_tx_hash,industry_id,confidence,created_at"
      );

      return j(
        {
          success: true,
          products: Array.isArray(prods) ? prods : [],
          count: Array.isArray(prods) ? prods.length : 0,
          offset: offset,
          limit: limit,
          has_more: Array.isArray(prods) && prods.length === limit,
          plan: kd.plan,
        },
        200,
        rateHeaders
      );
    }

    // ── ANALYTICS (REAL DATA) ─────────────────────────────────────────────
    if (path === "/api/v1/analytics") {
      var p1 = supaGet("products", "?is_registered=eq.true&select=id").catch(
        function () {
          return [];
        }
      );
      var p2 = supaGet("verifications", "?select=id").catch(function () {
        return [];
      });
      var p3 = supaGet("nfts", "?status=eq.minted&select=id").catch(
        function () {
          return [];
        }
      );
      var p4 = supaGet(
        "subscriptions",
        "?status=in.(active,trialing)&select=id"
      ).catch(function () {
        return [];
      });

      var results = await Promise.all([p1, p2, p3, p4]);

      return j(
        {
          success: true,
          analytics: {
            products_registered: Array.isArray(results[0])
              ? results[0].length
              : 0,
            verifications_performed: Array.isArray(results[1])
              ? results[1].length
              : 0,
            nfts_minted: Array.isArray(results[2]) ? results[2].length : 0,
            active_subscribers: Array.isArray(results[3])
              ? results[3].length
              : 0,
            blockchain: {
              network: "Polygon",
              contract: "0x4da4D2675e52374639C9c954f4f653887A9972BE",
            },
            timestamp: new Date().toISOString(),
          },
          plan: kd.plan,
        },
        200,
        rateHeaders
      );
    }

    // ── ME ─────────────────────────────────────────────────────────────────
    if (path === "/api/v1/me") {
      return j(
        {
          success: true,
          plan: kd.plan,
          limit: kd.limit,
          name: kd.name || "API User",
          isDemo: kd.isDemo || false,
          planDetails: PLANS[kd.plan] || PLANS.free,
          upgrade:
            kd.plan !== "ultra"
              ? "https://rapidapi.com/authichain-authichain-default/api/authichain-api"
              : null,
        },
        200,
        rateHeaders
      );
    }

    // ── QR GENERATE ───────────────────────────────────────────────────────
    if (path === "/api/v1/qr/generate" && method === "POST") {
      var b4 = await req.json().catch(function () {
        return {};
      });
      if (!b4.url && !b4.prompt)
        return j({ error: "url or prompt required" }, 400);

      // Proxy to qron-image-gen worker
      try {
        var genRes = await fetch(
          "https://qron-image-gen.undone-k.workers.dev/generate/qron",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: b4.prompt || "QRON authentication seal for " + b4.url,
              style: b4.style || "gold_vault",
            }),
            signal: AbortSignal.timeout(90000),
          }
        );
        var genData = await genRes.json();
        if (!genRes.ok)
          return j({ error: "QR generation failed", details: genData }, 502);
        genData.plan = kd.plan;
        genData.success = true;
        return j(genData, 200, rateHeaders);
      } catch (e) {
        return j(
          { error: "QR generation service unavailable", message: e.message },
          503
        );
      }
    }

    // ── LEADS ─────────────────────────────────────────────────────────────
    if (path === "/api/v1/leads" && method === "POST") {
      var b5 = await req.json().catch(function () {
        return {};
      });
      if (!b5.email) return j({ error: "email required" }, 400);
      // Anon inserts into leads are rejected by RLS; use the lead RPC.
      var leadResult = await supaRpc("authichain_api_capture_lead", {
        p_email: String(b5.email).trim().toLowerCase(),
        p_source: b5.source ? String(b5.source).slice(0, 100) : "api",
        p_name: b5.name ? String(b5.name).slice(0, 200) : null,
        p_company: b5.company ? String(b5.company).slice(0, 200) : null,
      }).catch(function () {
        return { ok: false };
      });
      if (!leadResult.ok)
        return j({ error: "Could not save lead" }, 503, rateHeaders);
      return j(
        { success: true, lead: { email: b5.email }, plan: kd.plan },
        201,
        rateHeaders
      );
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    return j(
      {
        error: "Not found",
        endpoints: [
          "/api/v1/health",
          "/api/v1/verify",
          "/api/v1/classify",
          "/api/v1/register",
          "/api/v1/products",
          "/api/v1/analytics",
          "/api/v1/me",
          "/api/v1/qr/generate",
          "/api/v1/pricing",
          "/api/v1/industries",
          "/api/v1/keys/create",
          "/api/v1/leads",
          "/api/v1/.well-known/jwks.json",
        ],
      },
      404
    );
  } catch (e) {
    return j({ error: "Internal server error", message: e.message }, 500);
  }
}
