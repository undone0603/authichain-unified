export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight for browser-based telemetry
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (request.method !== "POST" || url.pathname !== "/api/analytics/track") {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    try {
      const payload = await request.json();

      // Offload the database write to the background using ctx.waitUntil
      // This ensures the client gets an immediate <50ms response without waiting for Supabase
      ctx.waitUntil(this.logEvent(payload, env));

      return new Response(JSON.stringify({ success: true, queued: true }), {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
  },

  async logEvent(payload: any, env: Env) {
    const { eventName, properties, userId, sessionId } = payload;
    
    // Direct logging to the Supabase audit_log table
    await fetch(`${env.SUPABASE_URL}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal" // Don't return the inserted row to save bandwidth
      },
      body: JSON.stringify({
        action: eventName || 'page_view',
        actor: userId || sessionId || 'anonymous',
        metadata: properties || {},
        target: 'analytics_engine',
        created_at: new Date().toISOString()
      })
    });
  }
};
