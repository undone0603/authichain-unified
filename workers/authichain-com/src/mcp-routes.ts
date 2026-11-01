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

type McpEnv = X402Env & {
  /** Service binding to authichain-edge-router. Public fetch of this zone returns 522. */
  APP_WORKER?: { fetch: (request: Request) => Promise<Response> };
};
import {
  coerceSealBody,
  parseSealRequest,
  unpaidSealRefusal,
} from "../../../src/lib/agent-verify";
import {
  guardedForward,
  scopedReplayStore,
  resolvePaidSealVerify,
} from "../../../src/lib/paid-seal-verify";
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
export const SERVER_VERSION = "1.4.0";

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
      ? "Legacy x402 seal verify. Arguments that cannot be a seal UUID are HTTP 400 before payment. Empty arguments are unpaid HTTP 402. For free verification use verify_record."
      : "Legacy x402 seal verify, not answering. Arguments that cannot be a seal UUID are HTTP 400 before payment. Empty arguments are unpaid HTTP 402 for discovery; a paid call is refused with 503 registry_not_bound before settlement, so no payment is taken. For free verification use verify_record.",
    inputSchema: {
      type: "object",
      properties: {
        sealId: {
          type: "string",
          format: "uuid",
          description:
            "Required seal UUID. productId and serial are not registry keys.",
        },
      },
    },
  },
  {
    name: "query_provenance",
    description:
      "Free public lookup for an assetId / seal / QR token. Reads matching rows from the canonical auth_seals registry when public Supabase configuration is available, and also resolves published packs. A registry match means registered only; it does not verify a signature or prove a physical item is genuine. Use verify_attestation for a published v0.1 JWS; verify_record is the separate reference-protocol verifier.",
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
    name: "verify_attestation",
    description:
      "Free. Fetch the exact published AuthiChain v0.1 JWS from the signed-record registry and pass it to the canonical edge-router verifier. Checks signature, issuer trust, durable revocation/status, expiry, and signed decision. Supply expectedObjectId to bind the record to a scanned object identifier. A valid signed claim alone does not prove physical authenticity.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "Unique attestation ID or exact seal/product identifier",
        },
        expectedObjectId: {
          type: "string",
          description:
            "Optional independently observed object ID to compare with the signed subject",
        },
      },
      required: ["assetId"],
    },
  },
  {
    name: "verify_record",
    description: `Free. Verify an AuthiChain signed provenance record with the open reference verifier. Pass id "${"polygon-anchor-1"}" for the published demonstration record, or pass your own record and anchor JSON. Returns verified, valid-unanchored, or invalid, plus whether the transaction carries the record hash. It does not inspect a physical product.`,
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
  {
    name: "scan_living_qr",
    description:
      "Free. Scan a stored Living QR. GET https://authichain.com/qron/r/{object_id} returns AuthiChain Verification Decision v1. This host verifies the signature. A missing id is presentation_not_found. Not an x402 payment endpoint, and it does not inspect a physical product.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: {
          type: "string",
          description:
            "Stored presentation id. Canonical form is qron:url: plus 8 hex characters.",
        },
      },
      required: ["object_id"],
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
 * Production attestation issuer: kid jWTo5QsZ… (RFC 7638 thumbprint, CFA-462)
 * published at /protocol/jwks.json and /.well-known/jwks.json
 * (authichain-edge-router, AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64). did:key is
 * derived from that JWK's x. Rotated 2026-10-31T20:38:07Z. The authichain-api
 * certificate key (kid A_qAn4…) is deliberately not listed.
 */
export const PRODUCTION_ISSUER_KID =
  "jWTo5QsZfTVi2oQqsfq9E-aSB2XZ0vrXmfE3h0amEDM";
export const PRODUCTION_ISSUER_DID =
  "did:key:z6MkhhA9KMij8beSsdXjieSypnCnJcZsWK29UTEJ6zEk3p2c";
/**
 * Signing key from the Oct 9 CFA-462 correction until the 2026-10-31 rotation.
 * Public half remains on AUTHICHAIN_ATTESTATION_RETIRED_PUBLIC_JWKS. Accepted
 * ONLY for records whose validFrom is before that instant; never used for new
 * signing.
 */
export const RETIRED_OCT31_ISSUER_KID =
  "T3AL7c4wZVoXk1IXvpaaHGUmoZHZ3k1mTommJu9wToQ";
export const RETIRED_OCT31_ISSUER_DID =
  "did:key:z6MkjoaFgNbVQfsk2Tuiza2RT2vXTWpy7CNwuWv74nj7Sb2c";
export const RETIRED_OCT31_ISSUER_RETIRED_AT = "2026-10-31T20:38:07Z";
/**
 * RETIRED issuer (Advisor ruling, Oct 17 2026, CFA-462): the pre-Oct-9 key
 * (x=mJx2TLqU…j7k, kid lue84w… = its RFC 7638 thumbprint). Its private half was
 * overwritten by deploy-cloudflare.yml at 2026-10-09T05:12:01Z, so it can never
 * sign again. Accepted ONLY for records whose validFrom is before that instant;
 * never used for new signing.
 */
export const RETIRED_ISSUER_KID = "lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE";
export const RETIRED_ISSUER_DID =
  "did:key:z6MkpizPezaS2HsKKWghbcNp8ns7C98fYmypaFHWQyfcVA8G";
export const RETIRED_ISSUER_RETIRED_AT = "2026-10-09T05:12:01Z";
type AllowedSigner =
  | {
      role: "demonstration";
      kid: null;
      recordHash: string;
      retiredAt?: undefined;
    }
  | {
      role: "production_issuer";
      kid: string;
      recordHash: null;
      retiredAt?: undefined;
    }
  | {
      role: "retired_issuer";
      kid: string;
      recordHash: null;
      retiredAt: string;
    };
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
  // Retired: verify-only for records issued before the 2026-10-31 rotation.
  [RETIRED_OCT31_ISSUER_DID]: {
    role: "retired_issuer",
    kid: RETIRED_OCT31_ISSUER_KID,
    recordHash: null,
    retiredAt: RETIRED_OCT31_ISSUER_RETIRED_AT,
  },
  // Retired: verify-only for records issued before the Oct 9 key replacement.
  [RETIRED_ISSUER_DID]: {
    role: "retired_issuer",
    kid: RETIRED_ISSUER_KID,
    recordHash: null,
    retiredAt: RETIRED_ISSUER_RETIRED_AT,
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
  } else if (entry.retiredAt) {
    const vf = Date.parse(
      String((record as { validFrom?: unknown })?.validFrom ?? "")
    );
    if (!(vf < Date.parse(entry.retiredAt))) {
      allowed = undefined;
      trustReasons.push("retired_issuer_not_valid_after_retirement");
    }
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
      "scan_living_qr",
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
   * This is the no-network fallback for published packs and explicitly
   * labeled samples. The async queryProvenanceWithRegistry wrapper below
   * performs the canonical auth_seals lookup when public Supabase settings
   * are available. Neither a published pack nor a registry row is by itself
   * a cryptographic or physical-authenticity verdict.
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
      state: "lookup_required",
      note: "This is a published-pack/sample fallback, not a live certificate lookup. MCP checks auth_seals when registry credentials are configured.",
    },
    jwks: "https://authichain.com/.well-known/jwks.json",
    paidVerify: "POST /mcp tools/call verify",
    compliance:
      "EU DPP readiness is not a status on this lookup. Use dpp_readiness_check (free).",
  };
}

type AuthSealRegistryRow = {
  id?: unknown;
  product_id?: unknown;
  batch_id?: unknown;
  brand?: unknown;
  polygon_tx?: unknown;
  created_at?: unknown;
};

type AuthSealLookup =
  | { kind: "found"; row: AuthSealRegistryRow }
  | {
      kind:
        "not_found" | "not_configured" | "unavailable" | "invalid_identifier";
    };

const SAFE_REGISTRY_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,179}$/;

/**
 * Read the canonical auth_seals registry using only the public Supabase key.
 * A missing setting, HTTP error, schema error, or timeout is never converted
 * into "not registered". This lookup is registration evidence only; it does
 * not fetch or attest a signed record and must never set verified=true.
 */
async function lookupAuthSeal(
  assetId: string,
  env?: X402Env
): Promise<AuthSealLookup> {
  const baseUrl = (env?.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = (env?.SUPABASE_ANON_KEY || "").trim();
  if (!baseUrl || !/^https:\/\//i.test(baseUrl) || !anonKey) {
    return { kind: "not_configured" };
  }
  if (!SAFE_REGISTRY_IDENTIFIER.test(assetId)) {
    return { kind: "invalid_identifier" };
  }

  const query = new URLSearchParams({
    select: "id,product_id,batch_id,brand,polygon_tx,created_at",
    limit: "1",
    or: `(id.eq.${assetId},product_id.eq.${assetId},batch_id.eq.${assetId},qr_payload.eq.${assetId})`,
  });
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/auth_seals?${query.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) return { kind: "unavailable" };
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return { kind: "unavailable" };
    if (rows.length === 0) return { kind: "not_found" };
    const row = rows[0] as AuthSealRegistryRow;
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !row.id
    ) {
      return { kind: "unavailable" };
    }
    return { kind: "found", row };
  } catch {
    return { kind: "unavailable" };
  }
}

type PublishedAttestationRegistryRow = {
  attestation_id?: unknown;
  seal_id?: unknown;
  product_id?: unknown;
  batch_id?: unknown;
  brand?: unknown;
  object_id?: unknown;
  product_class?: unknown;
  gtin?: unknown;
  serial?: unknown;
  lot?: unknown;
  issuer_id?: unknown;
  issuer_kid?: unknown;
  decision?: unknown;
  payload?: unknown;
  jws?: unknown;
  record_hash?: unknown;
  published_at?: unknown;
};

type PublishedAttestationLookup =
  | { kind: "found"; row: PublishedAttestationRegistryRow }
  | {
      kind:
        | "not_found"
        | "not_configured"
        | "unavailable"
        | "invalid_identifier"
        | "ambiguous";
      candidates?: PublishedAttestationRegistryRow[];
    };

/** Resolve an exact identifier against published signed records only. */
async function lookupPublishedAttestation(
  assetId: string,
  env?: X402Env
): Promise<PublishedAttestationLookup> {
  const baseUrl = (env?.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = (env?.SUPABASE_ANON_KEY || "").trim();
  if (!baseUrl || !/^https:\/\//i.test(baseUrl) || !anonKey) {
    return { kind: "not_configured" };
  }
  if (!SAFE_REGISTRY_IDENTIFIER.test(assetId)) {
    return { kind: "invalid_identifier" };
  }

  const query = new URLSearchParams({
    select:
      "attestation_id,seal_id,product_id,batch_id,brand,object_id,product_class,gtin,serial,lot,issuer_id,issuer_kid,decision,payload,jws,record_hash,published_at",
    published: "eq.true",
    limit: "2",
    or: `(attestation_id.eq.${assetId},seal_id.eq.${assetId},product_id.eq.${assetId},batch_id.eq.${assetId},object_id.eq.${assetId},gtin.eq.${assetId},serial.eq.${assetId},lot.eq.${assetId})`,
  });
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/authichain_attestation_records?${query.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) return { kind: "unavailable" };
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return { kind: "unavailable" };
    if (rows.length === 0) return { kind: "not_found" };
    if (rows.length > 1)
      return {
        kind: "ambiguous",
        candidates: rows as PublishedAttestationRegistryRow[],
      };
    const row = rows[0] as PublishedAttestationRegistryRow;
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.attestation_id !== "string" ||
      typeof row.jws !== "string" ||
      typeof row.record_hash !== "string" ||
      !row.payload ||
      typeof row.payload !== "object" ||
      row.issuer_id !== "https://authichain.com"
    ) {
      return { kind: "unavailable" };
    }
    return { kind: "found", row };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Registry-backed MCP lookup; all answers remain explicitly non-verified. */
async function queryProvenanceWithRegistry(assetIdRaw: unknown, env?: X402Env) {
  const assetId = String(assetIdRaw ?? "").trim();
  const fallback = queryProvenance(assetId);
  if (!assetId) return fallback;

  const signedLookup = await lookupPublishedAttestation(assetId, env);
  if (signedLookup.kind === "found") {
    const row = signedLookup.row;
    return {
      ...fallback,
      status: "published_attestation",
      registered: true,
      verified: false,
      authenticityScore: 0,
      product: {
        id: typeof row.product_id === "string" ? row.product_id : assetId,
        sealId: typeof row.seal_id === "string" ? row.seal_id : null,
        batchId: typeof row.batch_id === "string" ? row.batch_id : null,
        brand: typeof row.brand === "string" ? row.brand : null,
        source: "authichain_attestation_records",
      },
      signedRecord: {
        attestation_id: row.attestation_id,
        issuer_id: row.issuer_id,
        issuer_kid: row.issuer_kid,
        decision: row.decision,
        payload: row.payload,
        jws: row.jws,
        record_hash: row.record_hash,
        published_at: row.published_at,
        source: "authichain_attestation_records",
      },
      registry: {
        ...fallback.registry,
        state: "published_record_found",
        source: "authichain_attestation_records",
        semantics:
          "published issuer-signed claim; not proof of physical authenticity",
        note: "A published JWS is retrieved, not verified by this lookup. Use verify_attestation to check signature, issuer trust, lifecycle, and expiry.",
      },
      verification: {
        signature: "not_checked",
        issuerTrust: "not_checked",
        revocation: "not_checked",
        physicalBinding: "not_checked",
      },
    };
  }
  if (signedLookup.kind === "ambiguous") {
    return {
      ...fallback,
      status: "ambiguous_identifier",
      verified: false,
      registry: {
        ...fallback.registry,
        state: "ambiguous",
        source: "authichain_attestation_records",
        note: "This identifier matches multiple published attestations; retry with a unique attestation ID or seal ID.",
      },
      candidates: (signedLookup.candidates ?? []).map(row => ({
        attestation_id:
          typeof row.attestation_id === "string" ? row.attestation_id : null,
        seal_id: typeof row.seal_id === "string" ? row.seal_id : null,
        product_id: typeof row.product_id === "string" ? row.product_id : null,
        batch_id: typeof row.batch_id === "string" ? row.batch_id : null,
      })),
    };
  }

  const lookup = await lookupAuthSeal(assetId, env);
  if (signedLookup.kind === "unavailable") {
    if (lookup.kind !== "found") {
      return {
        ...fallback,
        status: "registry_unavailable",
        verified: false,
        registry: {
          ...fallback.registry,
          state: "signed_record_registry_unavailable",
          note: "The signed-record registry could not be read. No conclusion about signed-record existence or verification was reached.",
        },
      };
    }
  }
  if (lookup.kind === "not_configured") {
    return {
      ...fallback,
      registry: {
        ...fallback.registry,
        state: "not_configured",
        note: "No public Supabase registry configuration was supplied; this result uses only published-pack/sample fallback data.",
      },
    };
  }
  if (lookup.kind === "invalid_identifier") {
    return {
      ...fallback,
      registry: {
        ...fallback.registry,
        state: "invalid_identifier",
        note: "This identifier contains unsupported characters for an exact registry lookup; no registry query was made.",
      },
    };
  }
  if (lookup.kind === "unavailable") {
    return {
      ...fallback,
      status:
        fallback.status === "published_pack" ||
        fallback.status === "desk_sample"
          ? fallback.status
          : "registry_unavailable",
      verified: false,
      registry: {
        ...fallback.registry,
        state: "unavailable",
        note: "The canonical auth_seals registry could not be read. No conclusion about registration was reached.",
      },
    };
  }

  if (lookup.kind === "found") {
    const row = lookup.row;
    const registered = {
      id:
        typeof row.product_id === "string" && row.product_id
          ? row.product_id
          : String(row.id),
      sealId: String(row.id),
      batchId: typeof row.batch_id === "string" ? row.batch_id : null,
      brand: typeof row.brand === "string" ? row.brand : null,
      registeredAt: typeof row.created_at === "string" ? row.created_at : null,
      anchorTransaction:
        typeof row.polygon_tx === "string" ? row.polygon_tx : null,
      source: "auth_seals",
    };
    return {
      ...fallback,
      status: "registered",
      registered: true,
      verified: false,
      authenticityScore: 0,
      product: registered,
      registry: {
        ...fallback.registry,
        state: "available",
        source: "auth_seals",
        semantics:
          "registered only; no signature or physical-authenticity verdict",
        note:
          signedLookup.kind === "unavailable"
            ? "A seal is registered, but the signed-record registry is unavailable. This is not an authenticity verdict."
            : signedLookup.kind === "not_found"
              ? "A matching auth_seals row proves registration only; no published signed attestation was found."
              : "A matching auth_seals row proves registration only; signed-record status remains unverified.",
      },
      verification: {
        signature: "not_checked",
        revocation: "not_checked",
        physicalBinding: "not_checked",
      },
    };
  }

  if (
    fallback.status === "published_pack" ||
    fallback.status === "desk_sample"
  ) {
    return {
      ...fallback,
      registry: {
        ...fallback.registry,
        state: "checked_no_matching_seal",
        source: "auth_seals",
        note: "This published pack/sample did not match an auth_seals row. Published status is not a cryptographic attestation.",
      },
    };
  }

  if (signedLookup.kind === "unavailable") {
    return {
      ...fallback,
      status: "registry_unavailable",
      registered: false,
      verified: false,
      registry: {
        ...fallback.registry,
        state: "signed_record_registry_unavailable",
        note: "The signed-record registry could not be read. No conclusion about the signed record was reached.",
      },
    };
  }
  return {
    ...fallback,
    status: "not_registered",
    registered: false,
    verified: false,
    registry: {
      ...fallback.registry,
      state: "available",
      source: "auth_seals",
      signedRecordState: signedLookup.kind,
      note: "No matching published signed attestation or auth_seals row was found. This is a registry lookup result, not a cryptographic verification result.",
    },
  };
}

/**
 * Echo the client's protocolVersion when this endpoint speaks it, else
 * answer with the newest one it does. Per the spec the client then either
 * proceeds on that version or disconnects.
 */

type CanonicalAttestationVerifierBinding = {
  fetch(request: Request): Promise<Response>;
};

async function verifyPublishedAttestation(
  assetIdRaw: unknown,
  expectedObjectIdRaw: unknown,
  env?: X402Env
): Promise<Record<string, unknown>> {
  const assetId = String(assetIdRaw ?? "").trim();
  if (!assetId) {
    return {
      verified: false,
      status: "invalid_identifier",
      error: "assetId is required",
    };
  }
  const expectedObjectId =
    typeof expectedObjectIdRaw === "string" ? expectedObjectIdRaw.trim() : "";
  if (
    expectedObjectIdRaw !== undefined &&
    (!expectedObjectId || expectedObjectId.length > 240)
  ) {
    return {
      verified: false,
      status: "invalid_identifier",
      error: "expectedObjectId must contain 1–240 characters",
    };
  }

  const lookup = await lookupPublishedAttestation(assetId, env);
  if (lookup.kind !== "found") {
    const statusByKind: Record<string, string> = {
      not_found: "not_found",
      not_configured: "not_configured",
      unavailable: "registry_unavailable",
      invalid_identifier: "invalid_identifier",
      ambiguous: "ambiguous_identifier",
    };
    return {
      verified: false,
      status: statusByKind[lookup.kind] ?? "registry_unavailable",
      registry: "authichain_attestation_records",
      error:
        lookup.kind === "ambiguous"
          ? "Identifier matches multiple published attestations; use a unique attestation ID or seal ID."
          : lookup.kind === "not_found"
            ? "No matching published signed attestation was found."
            : lookup.kind === "not_configured"
              ? "Public signed-record registry configuration is missing."
              : lookup.kind === "invalid_identifier"
                ? "Identifier contains unsupported characters."
                : "Published signed-record registry is unavailable; no verification conclusion was reached.",
      candidates:
        lookup.kind === "ambiguous"
          ? (lookup.candidates ?? []).map(row => ({
              attestation_id:
                typeof row.attestation_id === "string"
                  ? row.attestation_id
                  : null,
              seal_id: typeof row.seal_id === "string" ? row.seal_id : null,
              product_id:
                typeof row.product_id === "string" ? row.product_id : null,
            }))
          : undefined,
      physical_authenticity: "not_proven",
    };
  }

  const binding = (
    env as unknown as
      { APP_WORKER?: CanonicalAttestationVerifierBinding } | undefined
  )?.APP_WORKER;
  if (!binding || typeof binding.fetch !== "function") {
    return {
      verified: false,
      status: "verifier_not_configured",
      error:
        "Canonical edge-router APP_WORKER service binding is missing; the retrieved JWS was not verified.",
      attestation_id: lookup.row.attestation_id,
      physical_authenticity: "not_proven",
    };
  }

  const body: Record<string, unknown> = { jws: lookup.row.jws };
  if (expectedObjectId) body.expected_object_id = expectedObjectId;
  try {
    const response = await binding.fetch(
      new Request("https://authichain-edge-router/api/v1/attestation/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return {
        verified: false,
        status: "verifier_unavailable",
        error: "Canonical verifier returned an invalid response.",
        attestation_id: lookup.row.attestation_id,
        physical_authenticity: "not_proven",
      };
    }
    const decision = result as Record<string, unknown>;
    const verified = response.status === 200 && decision.valid === true;
    return {
      verified,
      status: verified ? "verified_signed_claim" : "not_verified",
      attestation_id: lookup.row.attestation_id,
      product_id: lookup.row.product_id,
      seal_id: lookup.row.seal_id,
      record_hash: lookup.row.record_hash,
      verification: {
        valid: decision.valid === true,
        decision: decision.decision ?? null,
        cryptographic_status: decision.cryptographic_status ?? null,
        issuer_status: decision.issuer_status ?? null,
        claim_status: decision.claim_status ?? null,
        reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
        expected_object_id_checked: Boolean(expectedObjectId),
      },
      physicalBinding: expectedObjectId
        ? decision.valid === true
          ? "matched_by_canonical_verifier"
          : "not_confirmed"
        : "not_checked",
      physical_authenticity: "not_proven",
      semantics:
        "The canonical verifier evaluated the issuer-signed claim and lifecycle. This does not prove the physical item is genuine or that a label/QR has not been copied.",
    };
  } catch {
    return {
      verified: false,
      status: "verifier_unavailable",
      error:
        "The canonical edge-router verifier could not be reached; no verification conclusion was reached.",
      attestation_id: lookup.row.attestation_id,
      physical_authenticity: "not_proven",
    };
  }
}

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
    const refusal = unpaidSealRefusal(args);
    if (refusal) return json(refusal.status, refusal.body);
    // HTTP quote crawlers get 402 for probe JSON with no sealId. This MCP
    // tool still refuses a non-empty argument that is not a seal UUID
    // before payment. Empty arguments stay the unpaid 402 quote.
    if (Object.keys(args).length > 0) {
      const parsed = parseSealRequest(coerceSealBody(args));
      if (!parsed.ok) return json(parsed.status, parsed.body);
    }
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
    replayStore: scopedReplayStore(env?.X402_REPLAY_KV, "authichain-com"),
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
    // VERIFY_APP settles: guard the replay at this edge (CFA-343/351).
    return guardedForward({
      proofHeader,
      replayStore: scopedReplayStore(env?.X402_REPLAY_KV, "authichain-com"),
      sealId: typeof args.sealId === "string" ? args.sealId : null,
      forward: () =>
        forwardPaidVerifyMcp(verifyApp, request, proofHeader, args, id),
    });
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

async function handleRpc(
  request: Request,
  env?: McpEnv,
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
        "AuthiChain verification is free. verify_attestation fetches a published v0.1 JWS and delegates signature, issuer trust, lifecycle, and expiry checks to the canonical verifier. query_provenance is registration-only; verify_record checks the separate reference protocol. No tool proves physical authenticity. dpp_readiness_check scores EU Digital Product Passport readiness and is not legal advice.",
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
            text: JSON.stringify(
              await queryProvenanceWithRegistry(assetId, env),
              null,
              2
            ),
          },
        ],
      });
    }
    if (name === "verify_attestation") {
      const args = params.arguments ?? {};
      const result = await verifyPublishedAttestation(
        args.assetId ?? args.sealId ?? args.id,
        args.expectedObjectId,
        env
      );
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        ...("verified" in result && result.verified !== true
          ? { isError: true }
          : {}),
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
    if (name === "scan_living_qr") {
      const binding = env?.APP_WORKER;
      const fetchImpl: typeof fetch = binding
        ? (input, init) => binding.fetch(new Request(input, init))
        : globalThis.fetch;
      const result = await scanLivingQr(params.arguments ?? {}, fetchImpl);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result.body) }],
        ...(result.isError ? { isError: true } : {}),
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
          text: "Unknown tool. Use verify_attestation (free, published signed JWS), verify_record (free reference protocol), get_pricing (free), dpp_readiness_check (free), query_provenance (free registration lookup), or verify (legacy x402).",
        },
      ],
      isError: true,
    });
  }

  return rpcError(id, `Method not found: ${method}`);
}

const LIVING_QR_OBJECT_ID = /^qron:url:[0-9a-f]{8}$/;
const LIVING_QR_SCAN_ORIGIN = "https://authichain.com";
const LIVING_QR_DECISION_FIELDS = [
  "valid",
  "decision",
  "decision_contract",
  "cryptographic_status",
  "status",
  "error",
  "overall_valid",
] as const;

/** Public Decision v1 scan. The object id never chooses the host. */
export async function scanLivingQr(
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ isError: boolean; body: Record<string, unknown> }> {
  const objectId = String(args.object_id ?? args.objectId ?? "").trim();
  if (!LIVING_QR_OBJECT_ID.test(objectId)) {
    return {
      isError: true,
      body: {
        valid: false,
        decision: "indeterminate",
        decision_contract: "AuthiChain Verification Decision v1",
        error: "object_id_invalid",
        expected: "qron:url: plus 8 hex characters",
      },
    };
  }
  const scan = `${LIVING_QR_SCAN_ORIGIN}/qron/r/${encodeURIComponent(objectId)}`;
  try {
    const res = await fetchImpl(scan, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "authichain-suggestions-probe",
      },
      signal: AbortSignal.timeout(15000),
    });
    const parsed = await res.json().catch(() => null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        isError: true,
        body: {
          object_id: objectId,
          scan,
          http_status: res.status,
          valid: false,
          decision: "indeterminate",
          decision_contract: "AuthiChain Verification Decision v1",
          error: "qron_resolve_unreachable",
        },
      };
    }
    const source = parsed as Record<string, unknown>;
    const body: Record<string, unknown> = {
      object_id: objectId,
      scan,
      http_status: res.status,
    };
    for (const key of LIVING_QR_DECISION_FIELDS) {
      if (key in source) body[key] = source[key];
    }
    return { isError: false, body };
  } catch {
    return {
      isError: true,
      body: {
        object_id: objectId,
        scan,
        valid: false,
        decision: "indeterminate",
        decision_contract: "AuthiChain Verification Decision v1",
        error: "qron_resolve_unreachable",
      },
    };
  }
}

export async function tryHandleMcp(
  request: Request,
  env: McpEnv = {},
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
