/**
 * AuthiChain agent-to-agent negotiation discovery.
 *
 * This is deliberately a quote-only, in-memory capability negotiation tool.
 * It never accepts a contract, starts a checkout, charges, settles,
 * writes data, sends messages, or calls another service.
 * MCP protocol-version negotiation in initialize is a separate concern.
 */
export const NEGOTIABLE_SERVICES = [
  "get_pricing",
  "verify",
  "query_provenance",
  "verify_attestation",
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
] as const;

const FREE_SERVICES: readonly string[] = [
  "get_pricing",
  "query_provenance",
  "verify_attestation",
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
];

const FIELDS = ["service", "mode", "currency", "max_budget_usd"] as const;

export const NEGOTIATE_TOOL = {
  name: "negotiate",
  description:
    "Free, read-only, non-binding agent-to-agent capability/price-class quote. " +
    "Returns available service, free vs separately authorized paid rail, and " +
    "next step; never accepts terms, creates a commitment, transfers money, " +
    "or calls an external service. This is NOT MCP initialize version negotiation.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      service: {
        type: "string",
        enum: [...NEGOTIABLE_SERVICES],
        description: "Existing MCP service the agent wants to discuss.",
      },
      mode: {
        type: "string",
        enum: ["quote_only"],
        description: "Non-binding quote only. Defaults to quote_only.",
      },
      currency: {
        type: "string",
        enum: ["USD"],
        description: "Display denomination only; no FX transaction. Defaults to USD.",
      },
      max_budget_usd: {
        type: "number",
        minimum: 0,
        maximum: 1000000,
        description: "Optional caller budget ceiling; never authorizes a charge.",
      },
    },
    required: ["service"],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
} as const;

export type NegotiationResult = {
  isError: boolean;
  body: Record<string, unknown>;
};

function refusal(error: string): NegotiationResult {
  return {
    isError: true,
    body: {
      status: "rejected",
      error,
      binding: false,
      accepted: false,
      payment_authorized: false,
      settled: false,
      side_effects: false,
    },
  };
}

/** Pure function: no env bindings, secrets, fetch, data stores, or side effects. */
export function negotiateQuote(input: unknown): NegotiationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return refusal("arguments_must_be_object");
  }
  const args = input as Record<string, unknown>;
  if (Object.keys(args).some(k => !(FIELDS as readonly string[]).includes(k))) {
    return refusal("unsupported_terms");
  }
  if (
    typeof args.service !== "string" ||
    !(NEGOTIABLE_SERVICES as readonly string[]).includes(args.service)
  ) {
    return refusal("unsupported_service");
  }
  if (args.mode !== undefined && args.mode !== "quote_only") {
    return refusal("non_binding_only");
  }
  if (args.currency !== undefined && args.currency !== "USD") {
    return refusal("currency_not_supported");
  }
  if (
    args.max_budget_usd !== undefined &&
    (typeof args.max_budget_usd !== "number" ||
      !Number.isFinite(args.max_budget_usd) ||
      args.max_budget_usd < 0 ||
      args.max_budget_usd > 1000000)
  ) {
    return refusal("invalid_budget");
  }

  const free = FREE_SERVICES.includes(args.service);
  return {
    isError: false,
    body: {
      status: free ? "non_binding_quote" : "separate_authorization_required",
      service: args.service,
      mode: "quote_only",
      currency: "USD",
      ...(args.max_budget_usd !== undefined
        ? { max_budget_usd: args.max_budget_usd }
        : {}),
      price_usd: free ? 0 : null,
      price_status: free ? "free" : "recheck_current_pricing",
      next_action: free
        ? "call_named_tool_separately"
        : "call_get_pricing_then_seek_explicit_payment_authorization",
      binding: false,
      accepted: false,
      payment_authorized: false,
      settled: false,
      side_effects: false,
      requires_separate_approval: !free,
      note: free
        ? "Information only. No execution or agreement was made."
        : "No price or payment is agreed. A separate authorized paid workflow is required.",
    },
  };
}
