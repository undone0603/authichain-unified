import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs";

console.log('\n  ⚡ [AgentZ] Initializing High-Performance MCP Gateway...');

async function connectToThirdPartyBot() {
    // Target the local binary directly to eliminate network overhead and npx cold starts
    const mcpBin = path.join(process.cwd(), 'node_modules', '.bin', 'mcp-server-memory');
    
    if (!fs.existsSync(mcpBin)) {
        console.error('  ❌ [AgentZ] Local MCP binary not found. Run `pnpm install`.');
        process.exit(1);
    }

    const transport = new StdioClientTransport({
        command: mcpBin,
        args: []
    });

    const client = new Client({
        name: "AgentZ-Core",
        version: "1.0.0"
    }, {
        capabilities: { tools: {} }
    });

    try {
        const startTime = Date.now();
        await client.connect(transport);
        const tools = await client.listTools();
        const bootTime = Date.now() - startTime;
        
        console.log(`  ✅ [AgentZ] Instant connection established in ${bootTime}ms!`);
        tools.tools.forEach(tool => {
            console.log(`      -> 🔧 ${tool.name}: ${tool.description?.split('\n')[0] || 'No description'}`);
        });

        console.log('\n  🚀 [AgentZ] Zero-latency Swarm Memory Graph is live and ready for execution.\n');
        process.exit(0);
    } catch (error) {
        console.error('  ❌ [AgentZ] Connection failed:', error.message);
        process.exit(1);
    }
}

connectToThirdPartyBot();
