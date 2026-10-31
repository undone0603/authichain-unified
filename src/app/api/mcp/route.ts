import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth-api';
import { reportAgentUsage } from '@/lib/industrial/billing';
import { logAutomation } from '@/lib/automation';
import { agentPricingDiscovery } from '@/lib/authentic-economy';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { MCP_TOOLS, runMeteredMcpTool } from '../../../lib/mcp-tools';

/**
 * MCP ENDPOINT (Model Context Protocol)
 * Implements the "Stripe for Product Authentication" AI distribution layer.
 * Pulled from AuthiChain2026/authichain-mcp-server
 *
 * Pricing is the three-rail join (plans.ts / x402 / $QRON theater), not a
 * second Polygon schedule. Do not invent SKUs here.
 */

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-API-Key');
    const { method, params } = await req.json();

    // 1. Handle listTools
    if (method === "notifications/initialized" || method === "initialize") {
        return NextResponse.json({
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "authichain-mcp-server", version: "1.0.0" }
        });
    }

    if (method === "tools/list") {
      return NextResponse.json({ tools: MCP_TOOLS });
    }

    // 2. Handle callTool (Requires Authentication for Billing)
    if (method === "tools/call") {
      if (!apiKey) {
        return NextResponse.json({ error: "X-API-Key required for tool execution" }, { status: 401 });
      }

      const userId = await verifyApiKey(apiKey);
      if (!userId) {
        return NextResponse.json({ error: "Invalid or inactive API Key" }, { status: 401 });
      }

      const { name, arguments: args } = params;

      switch (name) {
        case "authichain_get_pricing":
          return NextResponse.json({
            content: [{
              type: "text",
              text: JSON.stringify(agentPricingDiscovery(), null, 2)
            }]
          });

        default: {
          const outcome = await runMeteredMcpTool(name, args ?? {}, getSupabaseAdmin());
          if (!outcome) {
            return NextResponse.json({ error: `Tool ${name} not implemented` }, { status: 404 });
          }
          // Only a real answer is metered (see src/lib/mcp-tools.ts).
          const tool = outcome.meter;
          if (tool) {
            reportAgentUsage(userId, tool).catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[MCP] reportAgentUsage(${tool}) failed:`, err);
              void logAutomation('mcp.report_usage', 'event', 'failure', { userId, tool }, msg);
            });
          }
          return NextResponse.json(outcome.result);
        }
      }
    }

    return NextResponse.json({ error: "Method not found" }, { status: 404 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[MCP] Execution error:', err);
    await logAutomation('mcp', 'event', 'failure', null, msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
