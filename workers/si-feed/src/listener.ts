/**
 * Public listener. Observation only.
 * Ops sources (github, wrangler, ci) are never emitted here.
 */
export interface FeedEvent {
  tenant_id: string;
  ts: string;
  source: string;
  transport: "mcp";
  type: string;
  severity: "info" | "warning" | "debug";
  entity: string;
  summary: string;
  dedupe_key: string;
  data: Record<string, unknown>;
  visibility: "public" | "internal";
}

export function fromMcpTool(tool: string, args: Record<string, unknown>, resultText: string, now = new Date().toISOString()): FeedEvent | null {
  if (tool === "verify_product") {
    const qronId = String(args.qron_id ?? "").trim();
    if (!qronId) return null;
    const found = !/not found/i.test(resultText);
    return {
      tenant_id: "public",
      ts: now,
      source: "mcp",
      transport: "mcp",
      type: found ? "verify.lookup" : "verify.miss",
      severity: found ? "info" : "warning",
      entity: qronId,
      summary: found ? "MCP verify_product presented a stored QRON record. The call does not re-attest the item." : "MCP verify_product found no stored QRON record.",
      dedupe_key: `mcp:verify_product:${qronId}:${now.slice(0, 16)}`,
      data: { tool, found },
      visibility: found ? "public" : "internal",
    };
  }
  if (tool === "list_qrons") {
    return {
      tenant_id: "internal", ts: now, source: "mcp", transport: "mcp", type: "qron.list", severity: "debug",
      entity: "mcp:list_qrons", summary: "MCP list_qrons ran. Internal only.",
      dedupe_key: `mcp:list_qrons:${now.slice(0, 16)}`, data: { tool, bytes: resultText.length }, visibility: "internal",
    };
  }
  return null;
}
