import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

console.log('\n  🌍 [AgentZ] Initializing Non-Simulated Third-Party Agent Gateway...');

async function connectToThirdPartyBot() {
    // We are spawning a real, external 3rd-party bot (the official MCP Fetch Agent)
    // This gives AgentZ the immediate, live ability to read the open internet and REST APIs.
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-fetch"]
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
        
        // Dynamically request the bot's real-world capabilities
        const tools = await client.listTools();
        
        console.log(`  ✅ [AgentZ] Connection established! Unlocked ${tools.tools.length} real-world capabilities:`);
        tools.tools.forEach(tool => {
            console.log(`      -> 🔧 ${tool.name}: ${tool.description.split('\n')[0]}`);
        });

        console.log('\n  🚀 [AgentZ] 3rd-party integration live. AgentZ can now execute real-world web requests.\n');
        process.exit(0);
    } catch (error) {
        console.error('  ❌ [AgentZ] Failed to connect to third-party bot:', error.message);
        process.exit(1);
    }
}

connectToThirdPartyBot();
