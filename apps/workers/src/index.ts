import { LLMRouter } from './orchestration/llm-router';
import { ComplianceVerifier } from './compliance/compliance-verifier';
import { drizzle } from 'drizzle-orm/d1';
import { agentLedgers } from '../../../packages/db/src/schema/agent_ledger';
import { eq } from 'drizzle-orm';
import { handleQueueMessage } from './async/queue-handler';
import { agentToolRegistry } from './orchestration/agent-registry';

export interface Env {
  DB: D1Database;
  SAM_GOV_API_KEY: string;
  DCC_APP_ID: string;
  DCC_APP_KEY: string;
  AGENT_QUEUE: Queue<any>;
  AGENT_STATE: DurableObjectNamespace;
}

// Export the Durable Object class so the Workers runtime can access it
export { AuthiChainAgent } from './orchestration/agent-state';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // MCP Manifest Endpoint
    if (url.pathname === '/api/agent/manifest' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        serverName: "authichain-mcp-server",
        version: "1.0.0",
        tools: agentToolRegistry 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Orchestrator Routing Endpoint
    if (url.pathname === '/api/agent/dispatch' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        
        // Async task routing: Instantly accept and offload to queue
        if (body.async) {
          await env.AGENT_QUEUE.send(body);
          return new Response(JSON.stringify({ status: 'Accepted', message: 'Task queued for async processing' }), { status: 202 });
        }

        const db = drizzle(env.DB);
        
        // 1. Economic Control Plane: Verify atomic budget reservation
        if (!body.nonce) {
          return new Response(JSON.stringify({ error: 'Missing transaction nonce' }), { status: 400 });
        }
        
        const ledgerEntry = await db.select().from(agentLedgers).where(eq(agentLedgers.nonce, body.nonce)).get();
        if (!ledgerEntry || ledgerEntry.status !== 'committed') {
          return new Response(JSON.stringify({ error: 'Insufficient budget or invalid nonce' }), { status: 402 });
        }

        // 2. Automated Compliance Verification
        const verifier = new ComplianceVerifier(env);
        if (body.passportData) {
          const complianceResult = await verifier.verifyBatteryPassport(body.passportData);
          if (complianceResult.status === 'failed') {
            return new Response(JSON.stringify({ 
              error: 'Compliance verification failed', 
              checks: complianceResult.checks 
            }), { status: 403 });
          }
        }

        // 3. Agentic Orchestration & Local-First Handoff
        const router = new LLMRouter({ preferredProvider: 'edge' });
        const response = await router.routePrompt(body.prompt || 'Default execution', body.context);

        return new Response(JSON.stringify({ 
          success: true, 
          orchestration: response,
          budgetStatus: 'verified'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }
    
    return new Response('AuthiChain Agent Orchestrator Active', { status: 200 });
  },

  // The Queue Consumer handler
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    await handleQueueMessage(batch, env);
  }
}
EOFEOF
