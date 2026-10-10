import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

console.log('\n  🌍 [AgentZ] Initializing Non-Simulated Third-Party Agent Gateway...');

async function connectToThirdPartyBot() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-fetch"],
        env: {
            ...process.env,
            // Suppress the "frozen-lockfile" npm warnings to keep the JSON-RPC stream clean
            npm_config_loglevel: "error" 
        }
    });

    const client = new Client({
        name: "AgentZ-Core",
        version: "1.0.0"
    }, {
        capabilities: { tools: {} }
    });

    try {
        console.log('  🌍 [AgentZ] Dialing external MCP Fetch Bot...');
        await client.connect(transport);
        
        const tools = await client.listTools();
        
        console.log(`  ✅ [AgentZ] Connection established! Unlocked ${tools.tools.length} real-world capabilities:`);
        tools.tools.forEach(tool => {
            console.log(`      -> 🔧 ${tool.name}: ${tool.description?.split('\n')[0] || 'No description'}`);
        });

        console.log('\n  🚀 [AgentZ] 3rd-party integration live. AgentZ can now execute real-world web requests.\n');
        process.exit(0);
    } catch (error) {
        console.error('  ❌ [AgentZ] Failed to connect to third-party bot:', error.message);
        process.exit(1);
    }
}

connectToThirdPartyBot();
