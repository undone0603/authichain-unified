import { NextResponse } from 'next/server';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

export async function POST(request: Request) {
    const { prompt } = await request.json();
    
    // Connect to the Swarm's Memory Graph directly from the Next.js API
    const mcpBin = path.join(process.cwd(), '../../node_modules', '.bin', 'mcp-server-memory');
    const transport = new StdioClientTransport({ command: mcpBin, args: [] });
    const client = new Client({ name: "AgentBrowser-UI", version: "1.0.0" }, { capabilities: { tools: {} } });

    try {
        await client.connect(transport);
        
        // Query the swarm memory for context matching the user's prompt
        const memoryQuery = await client.callTool({
            name: "search_nodes",
            arguments: { query: prompt }
        });

        const memories = memoryQuery.content.map((c: any) => c.text).join('\n');
        
        // Return the swarm's collective knowledge to the frontend
        return NextResponse.json({ 
            response: `AgentZ Swarm Memory Retrieved:\n${memories || "No previous memories found for this query."}`,
            status: 'success' 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
