const KNOWN_EVENTS = new Set([
  'page_view', 'page_exit', 'click', 'form_submit', 'sign_up', 'sign_in', 'sign_out',
  'qr_scan', 'product_view', 'certificate_view', 'authentication_start', 'authentication_complete',
  'roi_calculator', 'demo_start', 'demo_complete', 'feature_view', 'error',
]);

const MAX_PAYLOAD_BYTES = 8_192; // 8 KB ceiling per event

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST" || url.pathname !== "/api/analytics/track") {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    // Enforce body size before parsing to prevent memory exhaustion
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: CORS_HEADERS,
      });
    }

    let payload: any;
    try {
      const text = await request.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return new Response(JSON.stringify({ error: "Payload too large" }), {
          status: 413,
          headers: CORS_HEADERS,
        });
      }
      payload = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const { eventName, properties, userId, sessionId } = payload;

    // Validate eventName against the known-event allowlist
    const safeEvent = typeof eventName === "string" && KNOWN_EVENTS.has(eventName)
      ? eventName
      : "page_view";

    // Strip actor to alphanumeric + hyphens to prevent injection into audit log
    const rawActor = typeof userId === "string" ? userId : (typeof sessionId === "string" ? sessionId : "anonymous");
    const safeActor = rawActor.replace(/[^a-zA-Z0-9\-_@.]/g, "").slice(0, 128) || "anonymous";

    // Allow only plain object properties; discard arrays, primitives, oversized blobs
    const safeProps = (properties !== null && typeof properties === "object" && !Array.isArray(properties))
      ? Object.fromEntries(
          Object.entries(properties as Record<string, unknown>)
            .slice(0, 20)
            .map(([k, v]) => [k.slice(0, 64), typeof v === "string" ? v.slice(0, 256) : v])
        )
      : {};

    ctx.waitUntil(this.logEvent(safeEvent, safeActor, safeProps, env));

    return new Response(JSON.stringify({ success: true, queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  },

  async logEvent(eventName: string, actor: string, properties: Record<string, unknown>, env: Env) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        action: eventName,
        actor,
        metadata: properties,
        target: "analytics_engine",
        created_at: new Date().toISOString(),
      }),
    });
  },
};
