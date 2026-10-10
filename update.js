const fs = require('fs');
const file = 'workers/authichain-com/src/mcp-routes.ts';
let content = fs.readFileSync(file, 'utf8');

const codeToInsert = `export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; };
}

export const REGISTERED_MCP_TOOLS: McpToolDefinition[] = [
  { name: "query_d1_database", description: "Run read queries against the Cloudflare D1 database for agent state and nonces.", inputSchema: { type: "object", properties: { query: { type: "string" }, params: { type: "array", items: { type: "string" } } }, required: ["query"] } },
  { name: "anthropic_generate_response", description: "Route inference tasks through Claude.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string", default: "claude-3-haiku-20240307" }, max_tokens: { type: "integer", default: 1024 } }, required: ["prompt"] } },
  { name: "dca_iservices_verify_license", description: "Query California DCA iServices.", inputSchema: { type: "object", properties: { license_number: { type: "string" }, board_code: { type: "string" } }, required: ["license_number"] } },
  { name: "heygen_generate_avatar_video", description: "Submit video generation tasks.", inputSchema: { type: "object", properties: { script_text: { type: "string" }, avatar_id: { type: "string" }, voice_id: { type: "string" } }, required: ["script_text", "avatar_id"] } },
  { name: "stripe_fetch_payment_plans", description: "Retrieve active plan configurations.", inputSchema: { type: "object", properties: { lookup_keys: { type: "array", items: { type: "string" } } } } }
];\n\n`;

content = codeToInsert + content;

// Replace tools list payload in method === "tools/list" handler
// Look for result: { tools: ... } or tools: ... within tools/list
content = content.replace(/(method\s*===\s*["']tools\/list["'][\s\S]*?tools:\s*)(\[[\s\S]*?\]|[\w_]+)/, '$1REGISTERED_MCP_TOOLS');

fs.writeFileSync(file, content, 'utf8');
console.log('UPDATED_SUCCESSFULLY');
