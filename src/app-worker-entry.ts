import { runAgentWorkflow } from "./agents/checkpointing";

export interface Env {
  DB: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === "/trigger-agent" || url.pathname.endsWith("/trigger-agent")) {
      try {
        let body: any = {};
        if (request.method === "POST") {
          body = await request.json().catch(() => ({}));
        }
        
        const jobId = body.jobId || "job_" + Date.now();
        const steps = body.steps || [
          "Initialize autonomous browser session",
          "Evaluate current DOM tree state",
          "Log execution results to D1 memory store"
        ];
        const llmEndpoint = body.llmEndpoint || "http://host.docker.internal:1234";

        ctx.waitUntil(
          runAgentWorkflow(jobId, steps, env.DB, llmEndpoint).catch(err => {
            console.error(`Workflow ${jobId} failed:`, err);
          })
        );

        return Response.json({ status: "success", jobId, stepCount: steps.length }, { status: 202 });
      } catch (e: any) {
        return Response.json({ status: "error", message: e.message }, { status: 400 });
      }
    }

    return new Response("Authichain Agent Worker is running.", { status: 200 });
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const steps = ["Daily health check", "Review new logs", "Report anomalies"];
    ctx.waitUntil(runAgentWorkflow(`cron_${event.cron}`, steps, env.DB, "http://host.docker.internal:1234"));
  }
};

// Fallback direct route injection for /trigger-agent
