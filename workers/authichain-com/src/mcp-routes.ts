/**
 * Live /mcp and /api/mcp 404 today — landing 404s /mcp, APP_WORKER 404s
 * /api/mcp. Agents that probe those paths never see a pay rail.
 *
 * Verification is free (verify_record, GET /api/verify). Prices are on hold,
 * so get_pricing and GET discovery list no Payment Links and no x402 price.
 * tools/call verify is the legacy unpaid 402 as /api/x402 — not a fake
 * "SECURED" JSON. Do not tell agents to GET /api/checkout.
 *
 * Do not import authentic-economy here — that pulls supabase-js into the
 * landing worker. plans.ts + x402.ts are already on this worker.
 */
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  buildPaymentRequired,
  forwardPaidVerifyMcp,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  x402PriceUsd,
  x402PaidVerifyStatus,
  type X402EnvVars,
  type X402VerifyBinding,
  // Extensionless on purpose: tsconfig.workers.json counts each ".ts"
  // import as a TS5097 error. Same convention as index.ts.
} from "../../../src/lib/x402";
import type { X402Env } from "./x402-routes";
import { resolvePaidSealVerify } from "../../../src/lib/paid-seal-verify";
import {
  expectedRecordHash,
  readAnchorOnChain,
  verifySubmitted,
} from "../../authichain-verify-worker/src/protocol-verify.mjs";
import { publishedRecord } from "../../authichain-verify-worker/src/published-record.mjs";
import {
  DPP_CATEGORIES,
  DPP_QUESTIONS,
  parseDppReadinessInput,
  scoreDppReadiness,
} from "../../../src/lib/dpp-readiness";
import {
  PACK_LIMIT,
  PUBLISHED_PACKS,
  findPublishedPack,
  packUrl,
} from "./published-packs";

/**
 * Protocol versions this endpoint can speak, newest first. `initialize`
 * echoes the client's requested version when it is one of these and
 * otherwise answers with LATEST, which is what the spec's negotiation step
 * expects. The old code hardcoded "2024-11-05" into every reply regardless
 * of what the client asked for.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/**
 * The server's own version, reported in serverInfo and in GET discovery.
 *
 * This MUST equal `version` in the repo-root server.json, which is what the
 * MCP registry publishes for io.github.undone0603/authichain. They had
 * drifted: the registry advertised 1.2.0 while every live handshake
 * answered 1.0.0, so a client could not tell which build it had reached.
 * mcp-routes.test.ts asserts the two match, so the next bump has to touch
 * both or CI fails.
 */
export const SERVER_VERSION = "1.3.0";

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
};

export const TOOLS = [
  {
    name: "get_pricing",
    description:
      "Free. AuthiChain verification is free: use the verify_record tool, or GET https://authichain.com/api/verify. Paid plans are on hold, so no prices or Payment Links are listed.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "verify",
    description: x402PaidVerifyStatus().bound
      ? "Legacy x402 seal verify. Unpaid tools/call returns HTTP 402. For free verification use verify_record."
      : "Legacy x402 seal verify, not answering. Unpaid tools/call returns HTTP 402 for discovery; a paid call is refused with 503 registry_not_bound before settlement, so no payment is taken. For free verification use verify_record.",
    inputSchema: {
      type: "object",
      properties: {
        sealId: { type: "string" },
        productId: { type: "string" },
        serial: { type: "string" },
      },
    },
  },
  {
    name: "query_provenance",
    description:
      "Free public lookup for an assetId / seal / QR token. Never attests. Resolves the published packs (" +
      PUBLISHED_PACKS.map(p => p.slug).join(", ") +
      "); any other id returns status unknown, because the certificates registry does not answer yet. " +
      "For free signature and anchor verification use verify_record.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "Seal, serial, or QR token identifier",
        },
      },
      required: ["assetId"],
    },
  },
  {
    name: "verify_record",
    description: `Free. Verify an AuthiChain signed provenance record with the open reference verifier, then read its Polygon anchor transaction. Pass id "${"polygon-anchor-1"}" for the published demonstration record, or pass your own record and anchor JSON. Returns verified, valid-unanchored, or invalid, plus whether the transaction carries the record hash. It does not inspect a physical product.`,
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: 'Published record id. Only "polygon-anchor-1" exists.',
        },
        record: {
          type: "object",
          description: "A signed AuthiChain provenance record (JSON).",
        },
        anchor: {
          type: "object",
          description:
            'Anchor JSON: { recordHash, chain: "polygon:137", txHash }. Optional.',
        },
      },
    },
  },
  {
    name: "dpp_readiness_check",
    description:
      "Free EU Digital Product Passport readiness check. Returns a 0-100 score, gaps, and the dated obligation for the product category (battery passport is law from 18 Feb 2027; other categories are ESPR targets). Not legal advice.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: DPP_CATEGORIES.map(c => c.id),
          description: DPP_CATEGORIES.map(c => `${c.id}: ${c.label}`).join(
            "; "
          ),
        },
        sells_in_eu: {
          type: "boolean",
          description:
            "Sold into the EU directly or via an importer. Default true.",
        },
        ...Object.fromEntries(
          DPP_QUESTIONS.map(q => [
            q.id,
            { type: "boolean", description: q.question },
          ])
        ),
      },
      required: ["category"],
    },
  },
];

const DPP_CHECK_URL = "https://authichain.com/dpp-check";

/** The published demonstration record, anchored on Polygon mainnet. */
export const ANCHOR_EXAMPLE_ID = "polygon-anchor-1";
export const ANCHOR_EXAMPLE_TX =
  "0x24911473b03c19f3b1ee9b0887fd82ef648bf2c85386f9505a0336a9c1ae10b7";

/**
 * verify_record says "verified" only for an allowlisted signer AND an anchor
 * tx that is on chain, carries this record's hash, and was sent by the
 * AuthiChain anchor wallet (acceptance per RES-45). A valid signature from
 * any other key, or a tx that merely exists, is not verified.
 */
export const DEMONSTRATION_SIGNER_DID =
  "did:key:z6MkfcH7Xe1bFoos1vr6ogWkV4hmdx2qM2dDXkg3VJ4cpAeS";
/** sha256 of polygon-anchor-1's signing bytes; the demo key is pinned to it. */
export const DEMONSTRATION_RECORD_HASH =
  "5ee3e5e7e8b2c32c8f096b77cc41baece9dd2555d5af24d73f8880484ed6b1e1";
/**
 * Production attestation issuer: kid lue84w… published at /protocol/jwks.json
 * and /.well-known/jwks.json (authichain-edge-router,
 * AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64). did:key is derived from that JWK's x.
 * The authichain-api certificate key (kid A_qAn4…) is deliberately not listed.
 */
export const PRODUCTION_ISSUER_KID =
  "lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE";
export const PRODUCTION_ISSUER_DID =
  "did:key:z6MkpizPezaS2HsKKWghbcNp8ns7C98fYmypaFHWQyfcVA8G";
type AllowedSigner =
  | { role: "demonstration"; kid: null; recordHash: string }
  | { role: "production_issuer"; kid: string; recordHash: null };
const ALLOWED_SIGNERS: Record<string, AllowedSigner> = {
  // Demonstration signer, not the production issuer. Valid for polygon-anchor-1 only.
  [DEMONSTRATION_SIGNER_DID]: {
    role: "demonstration",
    kid: null,
    recordHash: DEMONSTRATION_RECORD_HASH,
  },
  [PRODUCTION_ISSUER_DID]: {
    role: "production_issuer",
    kid: PRODUCTION_ISSUER_KID,
    recordHash: null,
  },
};
/** Sender (and recipient, self-send) of demo anchor tx 0x2491…10b7. */
export const ANCHOR_WALLET = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
/** AuthiChainProduct ERC-721 certificate contract on Polygon. */
export const CERT_CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";
const ANCHOR_TO = new Set(
  [ANCHOR_WALLET, CERT_CONTRACT].map(a => a.toLowerCase())
);

function signerDid(record: unknown): string {
  const r = record as {
    issuer?: unknown;
    proof?: { verificationMethod?: unknown };
  };
  const vm = r?.proof?.verificationMethod ?? r?.issuer;
  return typeof vm === "string" ? vm.split("#")[0] : "";
}

/**
 * Free verify_record: the same reference verifier and Polygon read as
 * GET /api/verify on authichain-verify-worker, run in-process. A Worker's
 * fetch to its own zone does not reliably reach another Worker's route, so
 * this imports the modules instead of calling the URL.
 */
export async function verifyRecordTool(
  args: Record<string, unknown>,
  opts: { rpcUrl?: string; fetchImpl?: typeof fetch } = {}
): Promise<Record<string, unknown> | { error: string }> {
  const rawId = typeof args.id === "string" ? args.id.trim() : "";
  const published = publishedRecord(rawId);
  if (rawId && !published) {
    return {
      error: `Unknown id. The only published record is "${ANCHOR_EXAMPLE_ID}". To check your own, pass record (and anchor) as JSON.`,
    };
  }
  const record = published ? published.record : args.record;
  const anchor = published ? published.anchor : (args.anchor ?? null);
  const protocol = verifySubmitted(record, anchor);
  if (!protocol) {
    return {
      error: `Pass id "${ANCHOR_EXAMPLE_ID}", or record as a JSON object.`,
    };
  }
  // Same rule as the verify worker: a configured RPC is for Polygon only.
  const chainName = String((anchor as { chain?: unknown } | null)?.chain ?? "");
  const polygon = chainName === "polygon:137" || chainName === "eip155:137";
  const chain = await readAnchorOnChain(record, anchor, {
    rpcUrl: polygon ? opts.rpcUrl : undefined,
    fetchImpl: opts.fetchImpl,
  });
  const did = signerDid(record);
  const entry = ALLOWED_SIGNERS[did];
  const trustReasons: string[] = [];
  let allowed: AllowedSigner | undefined = entry;
  if (!entry) {
    trustReasons.push("signer_not_allowlisted");
  } else if (
    entry.recordHash &&
    expectedRecordHash(record) !== entry.recordHash
  ) {
    allowed = undefined;
    trustReasons.push("demonstration_signer_not_valid_for_this_record");
  }
  if (anchor) {
    if (!chain.onChain)
      trustReasons.push(`anchor_not_on_chain:${chain.status}`);
    else if (
      String(chain.txFrom ?? "").toLowerCase() !== ANCHOR_WALLET.toLowerCase()
    ) {
      trustReasons.push("anchor_tx_not_from_anchor_wallet");
    } else if (!ANCHOR_TO.has(String(chain.txTo ?? "").toLowerCase())) {
      trustReasons.push("anchor_tx_not_to_anchor_address");
    }
  }
  let verdict: string = protocol.verdict;
  if (protocol.verdict === "verified" && trustReasons.length)
    verdict = "unverified";
  return {
    verdict,
    protocolVerdict: protocol.verdict,
    reasons:
      protocol.verdict === "invalid"
        ? protocol.reasons
        : [...protocol.reasons, ...trustReasons],
    checks: protocol.checks,
    signer: {
      did: did || null,
      allowlisted: Boolean(allowed),
      role: allowed?.role ?? null,
      kid: allowed?.kid ?? null,
      productionIssuer: allowed?.role === "production_issuer",
    },
    anchorOnChain: chain.onChain,
    anchorChainStatus: chain.status,
    anchorBlock: chain.block ?? null,
    anchorTransaction:
      anchor && typeof anchor === "object" && "txHash" in anchor
        ? ((anchor as { txHash?: unknown }).txHash ?? null)
        : null,
    source: published ? "published_example" : "submitted",
    demonstration: Boolean(published),
    limits:
      "Checks the Ed25519 signature and that the anchor transaction carries the record hash. It does not inspect a physical product.",
    verifier: "https://authichain.com/protocol",
  };
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function isMcpPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/mcp" || p === "/api/mcp" || p === "/.well-known/mcp.json";
}

function json(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function hydrateX402(env?: X402Env) {
  if (!env) return;
  const keys: Array<keyof X402EnvVars> = [
    "X402_PAY_TO",
    "X402_FACILITATOR_URL",
    "X402_NETWORK",
    "X402_CHAIN_ID",
    "X402_USDC_ASSET",
    "X402_PRICE_USD",
    "X402_DAILY_CAP_USD",
  ];
  for (const name of keys) {
    const value = env[name];
    if (value && !process.env[name]) process.env[name] = value;
  }
}

function livePayTo(env?: X402Env): string {
  return (
    env?.X402_PAY_TO?.trim() ||
    process.env.X402_PAY_TO?.trim() ||
    X402_PUBLISHED_PAY_TO
  );
}

/**
 * get_pricing and GET discovery. Verification is free; paid plans are on
 * hold, so this lists no Payment Links and no per-call price. Text only:
 * the legacy x402 `verify` path below is unchanged.
 */
export function mcpPricingDiscovery(_env?: X402Env) {
  const legacy = x402PaidVerifyStatus();
  return {
    verify: {
      price: "free",
      mcpTool: "verify_record",
      http: "GET https://authichain.com/api/verify?id=polygon-anchor-1",
      offline: "npx authichain-verify <record.json> [anchor.json]",
      docs: "https://authichain.com/protocol",
    },
    freeTools: [
      "verify_record",
      "query_provenance",
      "dpp_readiness_check",
      "get_pricing",
    ],
    paidPlans: {
      status: "on_hold",
      note: "Prices are on hold. No Payment Links or per-call prices are offered here.",
    },
    legacySealVerify: {
      tool: "verify",
      status: legacy.status,
      note: legacy.bound
        ? "Legacy x402 seal verify. For free verification use verify_record."
        : "Legacy x402 seal verify, not answering: a paid call is refused with 503 registry_not_bound before settlement, so no payment is taken. For free verification use verify_record.",
    },
  };
}

function discoveryBody() {
  return {
    protocol: "mcp",
    jsonrpc: "2.0",
    serverInfo: { name: "authichain", version: SERVER_VERSION },
    tools: TOOLS,
    pricing: mcpPricingDiscovery(),
    pay: {
      x402: "POST https://authichain.com/api/x402",
      mcpVerify: "POST https://authichain.com/mcp tools/call verify",
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      docs: "https://authichain.com/x402",
    },
  };
}

function queryProvenance(assetIdRaw: unknown) {
  const assetId = String(assetIdRaw ?? "").trim();
  const seed = assetId.toUpperCase() === "AC-7C2A91E4";
  /**
   * The published microsite packs are the only product-shaped records
   * AuthiChain has actually published. Before this, an agent asking about
   * BAT-2026-001 got `status: "unknown"` even though that batch has a
   * live public page — the tool was answering "no" to a question the
   * estate could already answer "yes" to.
   *
   * This resolves against published packs only. It does NOT stand in for
   * the certificates registry, which still 404s (see
   * docs/strategy/mcp-app-roadmap.md, G1): an id that is not a published
   * pack still returns unknown, because there is nothing real to say.
   */
  const pack = findPublishedPack(assetId);
  return {
    assetId: assetId || null,
    status: pack ? "published_pack" : seed ? "desk_sample" : "unknown",
    verified: false,
    authenticityScore: 0,
    protocol: "AuthiChain attestation 0.1",
    product: pack
      ? {
          id: pack.slug,
          name: pack.name,
          source: pack.note,
          published: packUrl(pack.slug),
          limit: PACK_LIMIT,
        }
      : seed
        ? {
            id: "AC-7C2A91E4",
            name: "Michigan METRC sample",
            source: "Self-serve desk seed. Not a live registry row.",
          }
        : null,
    ledger: {
      polygonNft: {
        chainId: 137,
        contract: "0x4da4D2675e52374639C9c954f4f653887A9972BE",
        note: "16 ACPT NFTs. $QRON is not this rail.",
      },
      baseNft: {
        chainId: 8453,
        contract: null,
        note: "AuthiChainNFT getCode is empty. Do not claim Base mint.",
      },
      x402: {
        chainId: 8453,
        asset: BASE_USDC_ASSET,
        pricePerCall: `$${x402PriceUsd()} USDC`,
        payTo: livePayTo(),
      },
    },
    registry: {
      certificatesApi: "https://authichain.com/api/authichain/certificates",
      state: "404",
      note: "Public count stays — until this endpoint answers.",
    },
    jwks: "https://authichain.com/.well-known/jwks.json",
    paidVerify: "POST /mcp tools/call verify",
    compliance:
      "EU DPP readiness is not a status on this lookup. Use dpp_readiness_check (free).",
  };
}

/**
 * Echo the client's protocolVersion when this endpoint speaks it, else
 * answer with the newest one it does. Per the spec the client then either
 * proceeds on that version or disconnects.
 */
export function negotiateProtocolVersion(params: unknown): string {
  const asked = (params as { protocolVersion?: unknown } | undefined)
    ?.protocolVersion;
  return typeof asked === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(asked)
    ? asked
    : LATEST_PROTOCOL_VERSION;
}

function rpcResult(id: unknown, result: unknown): Response {
  return json(200, { jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, message: string, code = -32601): Response {
  return json(200, {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

async function unpaidOrRefusedVerify(
  request: Request,
  env: X402Env | undefined,
  args: Record<string, unknown>,
  id: unknown,
  verifyApp?: X402VerifyBinding
): Promise<Response> {
  hydrateX402(env);
  const payTo = (env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(request.url).toString();
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  if (!payTo) {
    return json(503, {
      error: "payments_not_configured",
      status: "not_configured",
      health: "/api/x402/health",
    });
  }

  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain MCP verify",
  });
  const proofHeader = readPaymentProofHeader(name => request.headers.get(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof || !proofHeader) {
    return json(402, required.v2, required.headers);
  }

  const decision = await resolvePaidSealVerify({
    hasVerifyApp: Boolean(verifyApp),
    proofHeader,
    bodyText: JSON.stringify(args),
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain MCP verify",
    env,
  });
  if (decision.action === "answer") {
    if (decision.status !== 200) {
      return json(decision.status, decision.body, decision.headers);
    }
    const headers: Record<string, string> = { ...decision.headers };
    return json(
      200,
      {
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(decision.body, null, 2),
            },
          ],
          structuredContent: decision.body,
        },
      },
      headers
    );
  }
  if (decision.action === "forward" && verifyApp) {
    return forwardPaidVerifyMcp(verifyApp, request, proofHeader, args, id);
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

async function handleRpc(
  request: Request,
  env?: X402Env,
  verifyApp?: X402VerifyBinding
): Promise<Response> {
  let body: {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return rpcError(null, "invalid JSON", -32700);
  }
  const method = body.method ?? "";
  const id = body.id;

  /**
   * A JSON-RPC notification has no `id` member at all — not `id: null`,
   * which is a request with a null id. The transport spec requires a bare
   * 202 with no body for one. This endpoint used to answer
   * notifications/initialized with a full `result` object carrying
   * `id: null`, which is a protocol violation: strict clients (Claude's
   * remote connector among them) reject a response to a notification and
   * the session never finishes its handshake.
   */
  const isNotification =
    !Object.prototype.hasOwnProperty.call(body, "id") ||
    method.startsWith("notifications/");
  if (isNotification) {
    return new Response(null, {
      status: 202,
      headers: {
        "Cache-Control": "private, no-store",
        "Access-Control-Allow-Origin": "*",
        "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
      },
    });
  }

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: negotiateProtocolVersion(body.params),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "authichain", version: SERVER_VERSION },
      instructions:
        "AuthiChain verification is free. verify_record checks an Ed25519 " +
        "signed provenance record. dpp_readiness_check " +
        "scores EU Digital Product Passport readiness. Neither inspects a " +
        "physical product, and neither is legal advice.",
    });
  }

  // Liveness utility from the base protocol: an empty result, no side effects.
  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const params = (body.params ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    const name = params.name ?? "";
    if (name === "get_pricing" || name === "authichain_get_pricing") {
      hydrateX402(env);
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(mcpPricingDiscovery(env), null, 2),
          },
        ],
      });
    }
    if (name === "verify" || name === "authichain_verify_product") {
      return unpaidOrRefusedVerify(
        request,
        env,
        params.arguments ?? {},
        id,
        verifyApp
      );
    }
    if (name === "query_provenance" || name === "authichain_query_provenance") {
      const args = params.arguments ?? {};
      const assetId = args.assetId ?? args.sealId ?? args.serial ?? args.id;
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(queryProvenance(assetId), null, 2),
          },
        ],
      });
    }
    if (name === "verify_record") {
      const result = await verifyRecordTool(params.arguments ?? {}, {
        rpcUrl: (env as { POLYGON_RPC_URL?: string } | undefined)
          ?.POLYGON_RPC_URL,
      });
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        ...("error" in result ? { isError: true } : {}),
      });
    }
    if (name === "dpp_readiness_check") {
      const args = params.arguments ?? {};
      const input = parseDppReadinessInput(k => args[k]);
      if (!input) {
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text: `category is required, one of: ${DPP_CATEGORIES.map(c => c.id).join(", ")}`,
            },
          ],
          isError: true,
        });
      }
      // Paid plans are on hold (see mcpPricingDiscovery): no audit pitch here.
      const result = scoreDppReadiness(input, { offerAudit: false });
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...result, web: DPP_CHECK_URL }, null, 2),
          },
        ],
      });
    }
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: "Unknown tool. Use verify_record (free), get_pricing (free), dpp_readiness_check (free), query_provenance (free, not an attestation), or verify (legacy x402 seal verify).",
        },
      ],
      isError: true,
    });
  }

  return rpcError(id, `Method not found: ${method}`);
}

export async function tryHandleMcp(
  request: Request,
  env: X402Env = {},
  verifyApp?: X402VerifyBinding
): Promise<Response | null> {
  if (!isMcpPath(new URL(request.url).pathname)) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        // Accept and MCP-Protocol-Version are sent by spec-conformant
        // clients on every call; omitting them here failed the preflight
        // for any browser-side MCP client before the request was made.
        "Access-Control-Allow-Headers":
          "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID, X-PAYMENT, PAYMENT-SIGNATURE",
        "Access-Control-Expose-Headers":
          "MCP-Protocol-Version, Mcp-Session-Id, WWW-Authenticate",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "GET") {
    /**
     * A spec client GETs the endpoint with Accept: text/event-stream to
     * open a server-initiated stream. This server has none — every reply
     * is the direct response to a POST — and the spec's answer for that
     * is 405, not a body of the wrong media type. Plain GETs (curl, the
     * registry crawler, a browser) still get the discovery JSON.
     */
    const accept = request.headers.get("Accept") ?? "";
    if (accept.includes("text/event-stream")) {
      return json(405, {
        error: "sse_stream_not_supported",
        note: "This endpoint answers each POST directly and opens no server-initiated stream. POST JSON-RPC to the same URL.",
      });
    }
    hydrateX402(env);
    return json(200, discoveryBody());
  }

  if (request.method === "POST") {
    return handleRpc(request, env, verifyApp);
  }

  return json(405, { error: "method not allowed" });
}
