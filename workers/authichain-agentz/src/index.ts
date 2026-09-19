/**
 * authichain-agentz — Cloudflare Containers host for the AgentZ FastAPI.
 *
 *   claw.authichain.com  ──HTTP──►  this Worker  ──getContainer().fetch──►  uvicorn :8000
 *   agentz.authichain.com ────────────────────────────────────────────────────┘
 *
 * Keep Cloudflare Access on agentz.* and claw.*. Do not enable social publish.
 * OPENCLAW_GATEWAY_URL is owner-set on the claw Worker, not invented here.
 */

import { Container, getContainer } from "@cloudflare/containers";
import { AGENTZ_API_ENTRYPOINT, containerEnvFromBindings } from "./env";

export interface Env {
  AGENTZ: DurableObjectNamespace<AgentZContainer>;
  AGENT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export class AgentZContainer extends Container<Env> {
  defaultPort = 8000;
  sleepAfter = "10m";
  enableInternet = true;
  pingEndpoint = "localhost/health";
  // Dockerfile.agentz default CMD is the CLI; Containers serve the API.
  entrypoint = [...AGENTZ_API_ENTRYPOINT];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.envVars = containerEnvFromBindings(env);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.AGENTZ).fetch(request);
  },
};
