import { handleMcpRequest } from "./src/mcp-handler.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "reqbin-rest-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return handleMcpRequest(request, env);
    }
    return new Response(JSON.stringify({ error: "Not found", mcp: "/mcp", health: "/health" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
