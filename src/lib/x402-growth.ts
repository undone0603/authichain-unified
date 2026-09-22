/**
 * Organic growth for the AuthiChain x402 rail.
 *
 * Health is the only source of payTo / price / asset / network.
 * Listing packs, directory rows, skills, and sister aliases copy those
 * fields. Do not hardcode a second wallet. Do not put $QRON on this rail.
 * Do not rebind X402_PAY_TO away from the owner-authorized treasury
 * 0xaebf…e437.
 */

export const GROWTH_ORIGIN = "https://authichain.com";

export type GrowthDirectoryStatus = "live" | "ready" | "declared" | "planned";

export type GrowthDirectory = {
  id: string;
  name: string;
  url: string;
  listUrl?: string;
  mcp?: string;
  probe: string;
  status: GrowthDirectoryStatus;
  notes: string;
};

export type GrowthSister = {
  id: "authichain" | "qron" | "strainchain" | "govchain";
  origin: string;
  paidPath: string;
  catalogPath: string;
  notes: string;
};

export type GrowthSkill = {
  id: string;
  name: string;
  method: "POST";
  path: string;
  alias?: string;
  mcpTool?: string;
  category: "Verification" | "Tools" | "Intelligence";
  paid: true;
};

/** Directories that can crawl health/catalog/listing without a second wallet. */
export const GROWTH_DIRECTORIES: GrowthDirectory[] = [
  {
    id: "self-catalog",
    name: "AuthiChain catalog",
    url: `${GROWTH_ORIGIN}/api/x402/catalog`,
    probe: "GET /api/x402/health then GET /api/x402/catalog",
    status: "live",
    notes: "Source of truth for agents on the apex.",
  },
  {
    id: "x402scan",
    name: "x402scan",
    url: "https://www.x402scan.com",
    probe: `GET ${GROWTH_ORIGIN}/.well-known/x402`,
    status: "live",
    notes: "Fan-out lists POST https://authichain.com/api/x402.",
  },
  {
    id: "payapi",
    name: "PayAPI Market",
    url: "https://payapi.market",
    listUrl: "https://payapi.market/list",
    mcp: "https://payapi.market/mcp",
    probe: "unpaid POST paidRoute must 402 with Base USDC to listing wallet at <= $0.05",
    status: "ready",
    notes: "Submit from /api/x402/listing. Do not type a wallet by hand.",
  },
  {
    id: "payai-bazaar",
    name: "PayAI Bazaar",
    url: "https://payai.network",
    probe: "unpaid 402 body extensions.bazaar + PAYMENT-REQUIRED header",
    status: "declared",
    notes: "Declared on the 402. Facilitator stays https://facilitator.payai.network.",
  },
  {
    id: "mcp-clients",
    name: "MCP clients",
    url: `${GROWTH_ORIGIN}/mcp`,
    mcp: `${GROWTH_ORIGIN}/mcp`,
    probe: "GET /mcp is free; tools/call verify is unpaid HTTP 402",
    status: "live",
    notes: "Sister MCP hosts alias the same rail.",
  },
];

/** Same rail, different origin. Sisters must not invent a payTo. */
export const GROWTH_SISTERS: GrowthSister[] = [
  {
    id: "authichain",
    origin: GROWTH_ORIGIN,
    paidPath: "/api/v1/agent-verify",
    catalogPath: "/api/x402/catalog",
    notes: "Canonical paid route for PayAPI.",
  },
  {
    id: "qron",
    origin: "https://qron.space",
    paidPath: "/api/x402",
    catalogPath: "/api/x402/catalog",
    notes: "Alias. Settlement still hits AuthiChain X402_PAY_TO.",
  },
  {
    id: "strainchain",
    origin: "https://strainchain.io",
    paidPath: "/api/x402",
    catalogPath: "/api/x402/catalog",
    notes: "Alias. Settlement still hits AuthiChain X402_PAY_TO.",
  },
  {
    id: "govchain",
    origin: "https://govchain.us",
    paidPath: "/api/x402",
    catalogPath: "/api/x402/catalog",
    notes: "Alias. Settlement still hits AuthiChain X402_PAY_TO.",
  },
];

/**
 * Skills that already 402 on the live worker.
 * Add a row here only after the paid route exists and health lists it.
 */
export const GROWTH_SKILLS: GrowthSkill[] = [
  {
    id: "agent-verify",
    name: "AuthiChain Agent Verify",
    method: "POST",
    path: "/api/v1/agent-verify",
    alias: "/api/x402",
    mcpTool: "verify",
    category: "Verification",
    paid: true,
  },
];

export type ListingHealth = {
  payTo?: string | null;
  asset?: string;
  network?: string;
  chainId?: string;
  pricePerCall?: { usd: number; atomic: string };
  ready?: boolean;
  status?: string;
  mode?: string;
};

export type X402ListingPack = {
  protocol: "x402";
  name: string;
  provider: "AuthiChain";
  category: "Verification";
  description: string;
  baseUrl: string;
  paidRoute: string;
  paidAliases: string[];
  wallet: string | null;
  priceUsd: number;
  priceAtomic: string;
  network: "base";
  chainId: string;
  asset: string;
  endpoints: number;
  tools: number;
  mcp: string;
  catalog: string;
  health: string;
  docs: string;
  listing: string;
  ready: boolean;
  railStatus: string;
  directories: Array<{ id: string; status: GrowthDirectoryStatus; listUrl?: string }>;
  sisters: Array<{ origin: string; paidPath: string }>;
  skills: Array<{ id: string; path: string; mcpTool?: string }>;
  payapi: {
    form: {
      name: string;
      category: "Verification";
      baseUrl: string;
      paidRoute: string;
      wallet: string | null;
      priceUsd: number;
      endpointCount: number;
      toolCount: number;
    };
    rules: string[];
  };
};

function priceFrom(health: ListingHealth): { usd: number; atomic: string } {
  if (health.pricePerCall && Number.isFinite(health.pricePerCall.usd)) {
    return health.pricePerCall;
  }
  return { usd: 0.05, atomic: "50000" };
}

/** PayAPI-ready pack derived from health. Wallet is health.payTo or null. */
export function x402ListingPack(health: ListingHealth = {}): X402ListingPack {
  const price = priceFrom(health);
  const wallet = health.payTo?.trim() || null;
  return {
    protocol: "x402",
    name: "AuthiChain Agent Verify",
    provider: "AuthiChain",
    category: "Verification",
    description:
      "Paid product-authenticity verify for agents. Unpaid POST returns HTTP 402 ($0.05 USDC on Base). Free catalog, health, and MCP discovery.",
    baseUrl: GROWTH_ORIGIN,
    paidRoute: `${GROWTH_ORIGIN}/api/v1/agent-verify`,
    paidAliases: [
      `${GROWTH_ORIGIN}/api/x402`,
      `${GROWTH_ORIGIN}/mcp`,
    ],
    wallet,
    priceUsd: price.usd,
    priceAtomic: price.atomic,
    network: "base",
    chainId: health.chainId || "8453",
    asset: health.asset || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    endpoints: 2,
    tools: 3,
    mcp: `${GROWTH_ORIGIN}/mcp`,
    catalog: `${GROWTH_ORIGIN}/api/x402/catalog`,
    health: `${GROWTH_ORIGIN}/api/x402/health`,
    docs: `${GROWTH_ORIGIN}/x402`,
    listing: `${GROWTH_ORIGIN}/api/x402/listing`,
    ready: Boolean(health.ready && wallet),
    railStatus: health.status || "unknown",
    directories: GROWTH_DIRECTORIES.map(d => ({
      id: d.id,
      status: d.status,
      ...(d.listUrl ? { listUrl: d.listUrl } : {}),
    })),
    sisters: GROWTH_SISTERS.map(s => ({
      origin: s.origin,
      paidPath: s.paidPath,
    })),
    skills: GROWTH_SKILLS.map(s => ({
      id: s.id,
      path: s.path,
      ...(s.mcpTool ? { mcpTool: s.mcpTool } : {}),
    })),
    payapi: {
      form: {
        name: "AuthiChain Agent Verify",
        category: "Verification",
        baseUrl: GROWTH_ORIGIN,
        paidRoute: `${GROWTH_ORIGIN}/api/v1/agent-verify`,
        wallet,
        priceUsd: price.usd,
        endpointCount: 2,
        toolCount: 3,
      },
      rules: [
        "Copy wallet from this pack or live /api/x402/health payTo. Never type 0x5db5….",
        "Paid route must already 402 unpaid with Base USDC to that wallet.",
        "Price must match health.pricePerCall.usd (live $0.05).",
        "Do not list a sister origin as a second provider wallet.",
      ],
    },
  };
}

export type GrowthDiscoveryBody = {
  protocol: "x402";
  origin: string;
  loops: {
    discovery: string;
    skills: string;
    sisters: string;
    revenue: string;
  };
  listing: string;
  catalog: string;
  health: string;
  directories: GrowthDirectory[];
  sisters: GrowthSister[];
  skills: GrowthSkill[];
  pack: X402ListingPack;
};

export function growthDiscovery(health: ListingHealth = {}): GrowthDiscoveryBody {
  return {
    protocol: "x402",
    origin: GROWTH_ORIGIN,
    loops: {
      discovery: "health → catalog → listing pack → directories",
      skills: "paid route exists → GROWTH_SKILLS row → MCP tool + 402",
      sisters: "sister origin aliases same payTo / asset / price",
      revenue: "directory crawl → agent pays 402 → treasury X402_PAY_TO",
    },
    listing: "/api/x402/listing",
    catalog: "/api/x402/catalog",
    health: "/api/x402/health",
    directories: GROWTH_DIRECTORIES,
    sisters: GROWTH_SISTERS,
    skills: GROWTH_SKILLS,
    pack: x402ListingPack(health),
  };
}
