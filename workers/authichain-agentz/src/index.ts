/**
 * authichain-agentz — Cloudflare Containers proxy for AgentZ FastAPI.
 *
 * All HTTP traffic on agentz.authichain.com is forwarded to a Python
 * uvicorn process listening on port 8000 inside the container.
 *
 * Keep Cloudflare Access enabled on agentz.* (same policy posture as claw.*).
 */

import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

export type Env = {
  AGENTZ_CONTAINER: DurableObjectNamespace;
  AGENT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SERVICE_NAME?: string;
};

/**
 * Container-enabled Durable Object. One singleton instance serves the API.
 * Env vars set on the class are passed into the container process.
 */
export class AgentZContainer extends Container<Env> {
  defaultPort = 8000;
  sleepAfter = "10m";
  // Enable outbound internet so AgentZ can call Supabase / OpenClaw / LLMs.
  enableInternet = true;

  override get envVars(): Record<string, string> {
    const env: Record<string, string> = {
      PORT: "8000",
      PYTHONUNBUFFERED: "1",
    };
    // Forward Worker secrets into the container (never log values).
    if (this.env.AGENT_SECRET) env.AGENT_SECRET = this.env.AGENT_SECRET;
    if (this.env.SUPABASE_URL) env.SUPABASE_URL = this.env.SUPABASE_URL;
    if (this.env.SUPABASE_SERVICE_ROLE_KEY) {
      env.SUPABASE_SERVICE_ROLE_KEY = this.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    return env;
  }

  override onStart(): void {
    console.log("AgentZ container started (uvicorn :8000)");
  }

  override onStop(): void {
    console.log("AgentZ container stopped");
  }

  override onError(error: unknown): void {
    console.error("AgentZ container error:", error);
  }
}

const app = new Hono<{ Bindings: Env }>();

/** Public Worker-level liveness (does not require the container to be warm). */
app.get("/__worker_health", (c) =>
  c.json({
    status: "ok",
    service: c.env.SERVICE_NAME || "authichain-agentz",
    proxy: "cloudflare-containers",
    target: "AgentZContainer:8000",
  }),
);

/**
 * Proxy every other path to the AgentZ FastAPI container (singleton).
 * Paths match agentz/api/main.py: /health, /agents, /workflows, …
 */
app.all("*", async (c) => {
  const container = getContainer(c.env.AGENTZ_CONTAINER, "agentz-api");
  return container.fetch(c.req.raw);
});

export default app;
