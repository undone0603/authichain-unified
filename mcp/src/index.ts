import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getQronById, getQronList } from "./db.js";

const server = new Server(
  {
    name: "authichain-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "verify_product",
        description: "Verify the authenticity of a product using its QRON ID",
        inputSchema: {
          type: "object",
          properties: {
            qron_id: { type: "string" },
          },
          required: ["qron_id"],
        },
      },
      {
        name: "list_qrons",
        description: "List recent QRONs",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "verify_product") {
      const qronId = request.params.arguments?.qron_id;
      if (typeof qronId !== 'string') throw new Error("Invalid QRON ID");
      
      const qron = await getQronById(qronId);
      if (!qron) {
        return { content: [{ type: "text", text: `Product not found for QRON ID: ${qronId}` }] };
      }
      
      return {
        content: [{ type: "text", text: `Product Found: ${JSON.stringify(qron, null, 2)}` }],
      };
    }
    
    if (request.params.name === "list_qrons") {
      const qrons = await getQronList();
      return {
        content: [{ type: "text", text: `Recent QRONs: ${JSON.stringify(qrons, null, 2)}` }],
      };
    }
    
    throw new Error("Tool not found");
  } catch (error) {
    console.error("MCP Tool Error:", error);
    throw error;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AuthiChain MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
