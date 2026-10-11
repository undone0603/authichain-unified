import { NextResponse } from 'next/server';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import crypto from "crypto";

// --- Configuration & Limits ---
const WORKSPACE_ROOT = path.resolve(process.cwd(), '../../');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/v1/chat/completions';
const MAX_PROMPT_LENGTH = 8000;
const EXEC_TIMEOUT_MS = 15000; // 15s max shell execution
const LLM_TIMEOUT_MS = 45000;  // 45s max inference time

// --- Security Helpers ---
/** Prevents path traversal outside the AuthiChain workspace */
function isSafePath(targetPath: string): boolean {
    const resolvedPath = path.resolve(WORKSPACE_ROOT, targetPath);
    return resolvedPath.startsWith(WORKSPACE_ROOT);
}

/** Masks absolute server paths in client responses */
function sanitizeOutput(text: string): string {
    return text.split(WORKSPACE_ROOT).join('<WORKSPACE_ROOT>');
}

export async function POST(request: Request) {
    const reqId = crypto.randomUUID().slice(0, 8);
    
    try {
        // 1. Safe Input Validation
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Malformed JSON payload", status: 'error' }, { status: 400 });
        }

        const { prompt } = body;
        if (!prompt || typeof prompt !== 'string' || prompt.length > MAX_PROMPT_LENGTH) {
            console.warn(`[Swarm:\${reqId}] Rejected invalid prompt payload.`);
            return NextResponse.json({ error: "Invalid prompt payload or length exceeded.", status: 'error' }, { status: 400 });
        }

        // 2. Initialize MCP Memory Graph
        const mcpBin = path.join(process.cwd(), '../../node_modules', '.bin', 'mcp-server-memory');
        if (!fs.existsSync(mcpBin)) {
            console.error(`[Swarm:${reqId}] MCP server binary missing at${mcpBin}`);
            return NextResponse.json({ error: "Internal capability offline (MCP)", status: 'error' }, { status: 503 });
        }

        const transport = new StdioClientTransport({ command: mcpBin, args: [] });
        const mcpClient = new Client({ name: "AgentBrowser", version: "1.0.0" }, { capabilities: {} });
        await mcpClient.connect(transport);

        // 3. Intercept Manual Memory Storage
        if (prompt.toLowerCase().includes("store this in your memory:")) {
            const fact = prompt.split("memory:")[1].trim();
            await mcpClient.callTool({
                name: "create_entities",
                arguments: { entities: [{ name: "Objective", entityType: "Goal", observations: [fact] }] }
            });
            return NextResponse.json({ 
                response: `[AgentZ System] Node safely committed to Memory Graph:\n> "\${sanitizeOutput(fact)}"`, 
                status: 'success' 
            });
        }
        
        // 4. Retrieve Context
        const memoryQuery = await mcpClient.callTool({ name: "read_graph", arguments: {} });
        const memories = memoryQuery.content.map((c: any) => c.text).join('\n');

        // 5. System Instructions
        const systemPrompt = `You are a strict, non-conversational File System and Execution API. 

[MEMORIES]
\${memories || "None"}

[AVAILABLE ACTIONS]
You must respond to the user's command by outputting exactly ONE of the following action tags. NEVER output any other text, greetings, or explanations.
1. To read a file: <READ_FILE path="file_path" />
2. To run a command: <EXECUTE>command</EXECUTE>
3. To write a file: <WRITE_FILE path="file_path">content</WRITE_FILE>

[EXAMPLES]
User: Read the apps/agent-browser/package.json file
AgentZ: <READ_FILE path="apps/agent-browser/package.json" />

User: List the contents of the root directory
AgentZ: <EXECUTE>ls -la</EXECUTE>`;

        // 6. Query Local LLM with Timeout
        const abortController = new AbortController();
        const llmTimeout = setTimeout(() => abortController.abort(), LLM_TIMEOUT_MS);

        let responseText = "";
        try {
            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3.2:1b',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                }),
                signal: abortController.signal
            });

            if (!response.ok) throw new Error(`LLM API returned \${response.status}`);
            const data = await response.json();
            responseText = data.choices?.[0]?.message?.content || '';
        } catch (llmError: any) {
            console.error(`[Swarm:\${reqId}] LLM Inference failed:`, llmError.message);
            return NextResponse.json({ error: "Agent inference timed out or failed.", status: 'error' }, { status: 504 });
        } finally {
            clearTimeout(llmTimeout);
        }

        // 7. Secure Autonomous Interceptor Engine
        let finalOutput = responseText;

        // ACTION: WRITE
        const writeMatch = responseText.match(/<WRITE_FILE path="([^"]+)">([\s\S]*?)<\/WRITE_FILE>/);
        if (writeMatch) {
            if (!isSafePath(writeMatch[1])) throw new Error("Path traversal blocked.");
            const filePath = path.resolve(WORKSPACE_ROOT, writeMatch[1]);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, writeMatch[2].trim());
            finalOutput += `\n\n**[AgentZ RWX]** 📝 Wrote file to \`${writeMatch[1]}\``;
        }

        // ACTION: READ
        const readMatch = responseText.match(/<READ_FILE path="([^"]+)"\s*\/>/);
        if (readMatch) {
            if (!isSafePath(readMatch[1])) throw new Error("Path traversal blocked.");
            const filePath = path.resolve(WORKSPACE_ROOT, readMatch[1]);
            if (fs.existsSync(filePath)) {
                // Truncate massive files to prevent exploding the UI
                const content = fs.readFileSync(filePath, 'utf-8').slice(0, 5000);
                const truncated = content.length === 5000 ? "\n...[TRUNCATED]" : "";
                finalOutput += `\n\n**[AgentZ RWX]** 📖 Read file \`${readMatch[1]}\`:\n\`\`\`\n${content}${truncated}\n\`\`\``;
            } else {
                finalOutput += `\n\n**[AgentZ RWX]** ⚠️ File not found: \`${readMatch[1]}\``;
            }
        }

        // ACTION: EXECUTE
        const execMatch = responseText.match(/<EXECUTE>([\s\S]*?)<\/EXECUTE>/);
        if (execMatch) {
            const cmd = execMatch[1].trim();
            try {
                // BOUNDED EXECUTION: 15s timeout, limited buffer to prevent OOM
                const output = execSync(cmd, { 
                    cwd: WORKSPACE_ROOT, 
                    encoding: 'utf-8', 
                    timeout: EXEC_TIMEOUT_MS,
                    maxBuffer: 1024 * 500 // 500kb max output
                });
                finalOutput += `\n\n**[AgentZ RWX]** ⚡ Executed \`${cmd}\`:\n\`\`\`bash\n${sanitizeOutput(output)}\n\`\`\``;
            } catch (err: any) {
                finalOutput += `\n\n**[AgentZ RWX]** ⚠️ Command Failed or Timed Out (\`${cmd}\`):\n\`\`\`bash\n${sanitizeOutput(err.message)}\n\`\`\``;
            }
        }

        return NextResponse.json({ response: finalOutput, status: 'success' });
        
    } catch (error: any) {
        console.error(`[Swarm:${reqId}] Unhandled System Error:`, error.message);
        return NextResponse.json({ 
            response: `[System Error] Request failed. Check server logs. (ReqID: ${reqId})`, 
            status: 'error' 
        }, { status: 500 });
    }
}