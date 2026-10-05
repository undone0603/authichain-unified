/**
 * Tool calls for the Next MCP endpoint (src/app/api/mcp/route.ts).
 *
 * Each tool answers from a real record or says it cannot, and reports which
 * metered tool (if any) produced a real answer. Same rule as the estate MCP
 * (workers/_shared/estate-mcp.ts): an agent is never billed for an answer
 * that cannot be real. These handlers used to return fixed text ("Consensus
 * nodes: 5/5. Status: SECURED.", "Status: COMPLIANT.") for any input.
 */
import { parseSealRequest, registryAnswer } from "./agent-verify";
import { verifyDpp } from "./dpp-verify";
import type { MeteredTool } from "./industrial/billing";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export type McpToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type McpToolOutcome = {
  result: McpToolResult;
  /** Set only when the call returned a real answer worth metering. */
  meter: MeteredTool | null;
};

export const REGISTER_NOT_AVAILABLE =
  "Registration is not available over MCP yet. Register products at https://authichain.com/onboard.";

export const MCP_TOOLS = [
  {
    name: "authichain_verify_product",
    description:
      "Looks a seal up in the AuthiChain registry. A match proves the seal was registered; it does not check the signature or prove the item in hand is genuine.",
    inputSchema: {
      type: "object",
      properties: {
        seal_id: { type: "string", description: "The seal UUID" },
      },
      required: ["seal_id"],
    },
  },
  {
    name: "authichain_register_product",
    description: `Not available yet. ${REGISTER_NOT_AVAILABLE}`,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "authichain_check_eu_dpp",
    description:
      "Checks whether a published AuthiChain Digital Product Passport exists for an id, and states what that does and does not prove.",
    inputSchema: {
      type: "object",
      properties: {
        dpp_id: { type: "string", description: "The passport (product) id" },
      },
      required: ["dpp_id"],
    },
  },
  {
    name: "authichain_get_pricing",
    description:
      "Retrieves the current API pricing tiers and discovery information.",
    inputSchema: { type: "object", properties: {} },
  },
];

function text(body: unknown, isError = false): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof body === "string" ? body : JSON.stringify(body, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

export async function runMeteredMcpTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseLike
): Promise<McpToolOutcome | null> {
  switch (name) {
    case "authichain_verify_product": {
      const parsed = parseSealRequest(args);
      if (!parsed.ok) return { result: text(parsed.body, true), meter: null };
      const { data: seal, error } = await supabase
        .from("auth_seals")
        .select("*")
        .eq("id", parsed.sealId)
        .maybeSingle();
      if (error) {
        return {
          result: text({ error: "registry_unavailable" }, true),
          meter: null,
        };
      }
      return { result: text(registryAnswer(seal)), meter: "verify_product" };
    }

    case "authichain_check_eu_dpp": {
      const raw = args.dpp_id ?? args.certification_id;
      const answer = await verifyDpp({
        dppId: typeof raw === "string" ? raw : "",
        visitId: null,
        source: "mcp",
        supabase,
      });
      // A published passport and "no published passport" are both real
      // answers. A missing id or a database fault is not.
      const real = answer.ok || answer.status === 404;
      return {
        result: text(answer, !real),
        meter: real ? "check_eu_dpp" : null,
      };
    }

    case "authichain_register_product":
      return { result: text(REGISTER_NOT_AVAILABLE, true), meter: null };

    default:
      return null;
  }
}
