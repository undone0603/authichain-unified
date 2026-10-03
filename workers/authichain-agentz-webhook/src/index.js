// authichain-agentz-webhook — receives AgentZ orchestration events from
// GitHub Actions (port of the old Next.js /api/agentz/webhook route).
// Events are persisted to KV (90-day TTL) for dashboard/audit use.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
        return Response.json({ status: "ok", service: "authichain-agentz-webhook" });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const provided = request.headers.get("x-agentz-secret");
    if (!provided || !env.AGENTZ_WEBHOOK_SECRET || provided !== env.AGENTZ_WEBHOOK_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = body && body.event;
    if (!event) {
      return Response.json({ error: "Missing event" }, { status: 400 });
    }

    const record = {
      event,
      payload: (body && body.payload) || {},
      received_at: new Date().toISOString(),
      source: "github-agentz",
    };

    try {
      const key = `${Date.now()}-${crypto.randomUUID()}`;
      await env.AGENTZ_KV.put(key, JSON.stringify(record), { expirationTtl: 7776000 });
    } catch (err) {
      // KV unavailable — still acknowledge so the orchestration run is not
      // marked failed by a logging outage; report the issue in the response.
      return Response.json({ ok: true, event, stored: false, warn: "kv unavailable" });
    }

    return Response.json({ ok: true, event, stored: true });
  },
};
