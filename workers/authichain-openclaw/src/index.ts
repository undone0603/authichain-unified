/**
 * authichain-openclaw — Bridge Worker between OpenClaw gateway and AgentZ.
 *
 * Architecture:
 *   OpenClaw (gateway) ──webhook──► this Worker ──HTTP──► AgentZ API
 *        ▲                                                    │
 *        │                                                    ▼
 *   messaging channels                              Supabase / LLM / tools
 *   (WhatsApp, Telegram,                            (existing agent fleet)
 *    Slack, Discord, ...)
 *
 * This Worker exposes:
 *   POST /webhook/openclaw   — receives inbound messages from OpenClaw
 *                              gateway (channel messages routed to AgentZ)
 *   POST /command            — sends a command to AgentZ and returns result
 *   GET  /health             — liveness check
 *   GET  /agents             — lists AgentZ agents (proxy to AgentZ API)
 *   POST /architect/cycle    — triggers the Unified Architect cycle
 *
 * The OpenClaw gateway forwards messages it receives from connected
 * channels (WhatsApp, Telegram, etc.) to this webhook. The Worker parses
 * the message, determines the intent, and dispatches to the appropriate
 * AgentZ endpoint. Responses are sent back to OpenClaw via its gateway
 * API, which routes them to the originating channel.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

// ── Types ────────────────────────────────────────────────────────────────────

interface Bindings {
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_API_KEY: string;
  AGENTZ_API_URL: string;
  AGENTZ_API_KEY: string;
  SLACK_SIGNING_SECRET?: string;
  OPENCLAW_API_VERSION: string;
  AGENTZ_TIMEOUT_MS: string;
}

interface OpenClawMessage {
  channel: string;       // "whatsapp" | "telegram" | "slack" | "discord" | ...
  sender: string;        // user identifier on the channel
  text: string;          // message body
  session_id: string;   // OpenClaw session id
  timestamp: string;    // ISO 8601
  metadata?: Record<string, unknown>;
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors());

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "authichain-openclaw",
    openclaw_gateway: c.env.OPENCLAW_GATEWAY_URL ? "configured" : "not_set",
    agentz_api: c.env.AGENTZ_API_URL ? "configured" : "not_set",
    version: "1.0.0",
  });
});

// ── AgentZ proxy helpers ───────────────────────────────────────────────────────

async function agentzFetch(
  env: Bindings,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = env.AGENTZ_API_URL.replace(/\/$/, "");
  const timeout = parseInt(env.AGENTZ_TIMEOUT_MS || "30000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AGENTZ_API_KEY}`,
        ...(options.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenClaw webhook receiver ────────────────────────────────────────────────

app.post("/webhook/openclaw", async (c) => {
  // Verify the request is from the OpenClaw gateway
  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${c.env.OPENCLAW_API_KEY}`) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const msg = await c.req.json<OpenClawMessage>().catch(() => null);
  if (!msg || !msg.text) {
    return c.json({ error: "invalid message payload" }, 400);
  }

  // Parse the message to determine intent
  const intent = parseIntent(msg.text);

  switch (intent.type) {
    case "run_workflow":
      return await dispatchWorkflow(c, intent.workflow_id!, intent.args);
    case "architect_cycle":
      return await dispatchArchitectCycle(c, intent.args);
    case "list_agents":
      return await listAgents(c);
    case "list_workflows":
      return await listWorkflows(c);
    case "help":
      return c.json({
        response: formatHelp(),
        session_id: msg.session_id,
        channel: msg.channel,
      });
    default:
      // Unknown — return the parsed message for the operator to handle
      return c.json({
        response: `Unknown command: "${msg.text}". Type "help" for available commands.`,
        session_id: msg.session_id,
        channel: msg.channel,
      });
  }
});

// ── Intent parser ─────────────────────────────────────────────────────────────

type Intent =
  | { type: "run_workflow"; workflow_id: string; args: string[] }
  | { type: "architect_cycle"; args: string[] }
  | { type: "list_agents" }
  | { type: "list_workflows" }
  | { type: "help" }
  | { type: "unknown"; text: string };

function parseIntent(text: string): Intent {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === "help" || trimmed === "?") return { type: "help" };
  if (trimmed === "agents" || trimmed === "list agents") return { type: "list_agents" };
  if (trimmed === "workflows" || trimmed === "list workflows") return { type: "list_workflows" };

  if (trimmed.startsWith("architect") || trimmed.startsWith("run architect")) {
    const args = trimmed.split(/\s+/).slice(1);
    return { type: "architect_cycle", args };
  }

  if (trimmed.startsWith("run ")) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const workflow_id = parts[1];
      const args = parts.slice(2);
      return { type: "run_workflow", workflow_id, args };
    }
  }

  return { type: "unknown", text };
}

// ── Dispatchers ───────────────────────────────────────────────────────────────

async function dispatchWorkflow(c: any, workflowId: string, _args: string[]) {
  try {
    const res = await agentzFetch(c.env, `/api/workflows/${workflowId}/run`, {
      method: "POST",
      body: JSON.stringify({ mode: "confirm" }),
    });

    if (!res.ok) {
      const err = await res.text();
      return c.json({
        response: `Workflow "${workflowId}" failed: ${err}`,
        error: true,
      });
    }

    const data = await res.json();
    return c.json({
      response: `Workflow "${workflowId}" completed: ${data.status || "ok"}\n${data.notes || ""}`,
      result: data,
    });
  } catch (e: any) {
    return c.json({ response: `AgentZ unreachable: ${e.message}`, error: true });
  }
}

async function dispatchArchitectCycle(c: any, _args: string[]) {
  try {
    // The architect endpoint is on the AgentZ Python API
    const res = await agentzFetch(c.env, "/api/architect/cycle", {
      method: "POST",
      body: JSON.stringify({ mode: "dry-run" }),
    });

    if (!res.ok) {
      const err = await res.text();
      return c.json({ response: `Architect cycle failed: ${err}`, error: true });
    }

    const data = await res.json();
    const r = data.report || data;
    const summary = [
      `Architect Cycle Complete (${r.cycle_id || "unknown"})`,
      `Goal: ${r.goal || "N/A"}`,
      `Healthy: ${r.before_healthy} → ${r.after_healthy}`,
      `Failing: ${r.before_failing} → ${r.after_failing}`,
      `Net improvement: ${r.net_improvement || 0}`,
    ].join("\n");

    return c.json({ response: summary, result: data });
  } catch (e: any) {
    return c.json({ response: `AgentZ unreachable: ${e.message}`, error: true });
  }
}

async function listAgents(c: any) {
  try {
    const res = await agentzFetch(c.env, "/api/agents");
    const data = await res.json();
    const lines = data.agents?.map((a: any) => `  • ${a.name}: ${a.system_prompt?.slice(0, 60) || ""}`) || [];
    return c.json({ response: `Registered agents (${data.agents?.length || 0}):\n${lines.join("\n")}` });
  } catch (e: any) {
    return c.json({ response: `AgentZ unreachable: ${e.message}`, error: true });
  }
}

async function listWorkflows(c: any) {
  try {
    const res = await agentzFetch(c.env, "/api/workflows");
    const data = await res.json();
    const lines = data.workflows?.map((w: any) => `  • ${w.id}: ${w.title}`) || [];
    return c.json({ response: `Workflows (${data.workflows?.length || 0}):\n${lines.join("\n")}` });
  } catch (e: any) {
    return c.json({ response: `AgentZ unreachable: ${e.message}`, error: true });
  }
}

// ── Direct command endpoint (for CLI / API calls, not OpenClaw) ───────────────

app.post("/command", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { command, args } = body;

  if (!command) return c.json({ error: "command required" }, 400);

  const intent = parseIntent(`${command} ${args || ""}`);

  switch (intent.type) {
    case "run_workflow":
      return await dispatchWorkflow(c, intent.workflow_id!, []);
    case "architect_cycle":
      return await dispatchArchitectCycle(c, []);
    case "list_agents":
      return await listAgents(c);
    case "list_workflows":
      return await listWorkflows(c);
    default:
      return c.json({ error: `unknown command: ${command}` }, 400);
  }
});

// ── Architect cycle endpoint ──────────────────────────────────────────────────

app.post("/architect/cycle", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const mode = body.mode || "dry-run";
  const goal = body.goal || "Assess fleet health, fix failing workflows, and run priority jobs.";

  try {
    const res = await agentzFetch(c.env, "/api/architect/cycle", {
      method: "POST",
      body: JSON.stringify({ mode, goal }),
    });
    const data = await res.json();
    return c.json(data);
  } catch (e: any) {
    return c.json({ error: `AgentZ unreachable: ${e.message}` }, 502);
  }
});

// ── Help text ─────────────────────────────────────────────────────────────────

function formatHelp(): string {
  return [
    "🦞 AuthiChain OpenClaw Bridge — Available commands:",
    "",
    "  help              — Show this help",
    "  agents            — List registered AgentZ agents",
    "  workflows         — List available workflows",
    "  run <id>          — Run a workflow by ID (e.g. run stripe_webhook)",
    "  architect         — Run an architect cycle (dry-run by default)",
    "",
    "Messages from any connected channel (WhatsApp, Telegram, Slack, etc.)",
    "are routed here by the OpenClaw gateway.",
  ].join("\n");
}

export default app;
