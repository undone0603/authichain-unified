// Archived snapshot of sibling project /home/zac/projects/grok-cloudflare-toolchain
// Worker name: grok-cloudflare-toolchain (workers.dev). Not an AuthiChain product surface.
// Captured 2026-11-10 for estate inventory (issues #1817 / #2335). Live deploy unchanged.

/**
 * grok-cloudflare-toolchain Worker
 * GET /        HTML chat demo
 * GET /health  JSON health
 * POST /chat   SSE stream (Ollama local via wrangler dev, or xAI when XAI_API_KEY set)
 */

export interface Env {
  XAI_API_KEY?: string;
  LOCAL_AI_PROVIDER?: string;
  LOCAL_AI_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  LMSTUDIO_BASE_URL?: string;
  OPENCLAW_GATEWAY_URL?: string;
  ALLOW_UNSAFE_SCHEMA_MUTATIONS?: string;
  SUPABASE_TARGET_ENV?: string;
}

const XAI_MODEL = "grok-4.7";
const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

type Upstream = {
  kind: "xai" | "ollama" | "lmstudio";
  url: string;
  model: string;
  headers: Record<string, string>;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function resolveUpstream(env: Env): Upstream | { error: string; status: number } {
  const provider = (env.LOCAL_AI_PROVIDER || "").trim().toLowerCase();

  if (provider === "ollama") {
    const base = (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
    const model = env.LOCAL_AI_MODEL || "qwen2.5-coder:32b";
    return {
      kind: "ollama",
      url: `${base}/v1/chat/completions`,
      model,
      headers: { "content-type": "application/json" },
    };
  }

  if (provider === "lmstudio") {
    const base = (env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/$/, "");
    const model = env.LOCAL_AI_MODEL || "local-model";
    return {
      kind: "lmstudio",
      url: `${base}/chat/completions`,
      model,
      headers: { "content-type": "application/json" },
    };
  }

  if (env.XAI_API_KEY) {
    return {
      kind: "xai",
      url: XAI_CHAT_URL,
      model: XAI_MODEL,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.XAI_API_KEY}`,
      },
    };
  }

  return {
    error:
      "No AI upstream configured. Set LOCAL_AI_PROVIDER=ollama in .dev.vars for local wrangler dev, or XAI_API_KEY for production.",
    status: 503,
  };
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const upstreamCfg = resolveUpstream(env);
  if ("error" in upstreamCfg) {
    return json({ error: upstreamCfg.error }, upstreamCfg.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : "";

  if (!message) {
    return json({ error: "message required" }, 400);
  }

  const upstream = await fetch(upstreamCfg.url, {
    method: "POST",
    headers: upstreamCfg.headers,
    body: JSON.stringify({
      model: upstreamCfg.model,
      stream: true,
      messages: [
        {
          role: "system",
          content: "You are a helpful coding assistant. Keep answers concise and useful.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = (await upstream.text()).slice(0, 400);
    const err =
      upstream.status === 401
        ? "upstream auth failed"
        : `upstream error ${upstream.status}: ${text}`;
    return json({ error: err }, 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  const model = upstreamCfg.model;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const raw of lines) {
            const line = raw.trimEnd();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              controller.enqueue(
                encoder.encode(sseFrame("done", { model, provider: upstreamCfg.kind })),
              );
              continue;
            }
            try {
              const chunk = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) {
                controller.enqueue(encoder.encode(sseFrame("token", { text })));
              }
            } catch {
              // ignore malformed upstream chunks
            }
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        try {
          controller.enqueue(encoder.encode(sseFrame("error", { error: msg })));
        } catch {
          /* already closed */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

function demoHtml(env: Env): string {
  const upstream = resolveUpstream(env);
  const label =
    "error" in upstream
      ? "unconfigured"
      : `${upstream.kind} · ${upstream.model}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grok ↔ Cloudflare toolchain</title>
  <style>
    :root { color-scheme: dark light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.45; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    p.meta { color: #888; font-size: 0.9rem; margin-top: 0; }
    form { display: flex; gap: 0.5rem; margin: 1rem 0; }
    input[type=text] { flex: 1; padding: 0.6rem 0.75rem; border-radius: 0.5rem; border: 1px solid #555; background: transparent; color: inherit; }
    button { padding: 0.6rem 1rem; border-radius: 0.5rem; border: 0; background: #1d9bf0; color: #fff; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: wait; }
    #out { white-space: pre-wrap; border: 1px solid #444; border-radius: 0.5rem; padding: 1rem; min-height: 8rem; }
    .err { color: #f87171; }
  </style>
</head>
<body>
  <h1>Grok ↔ Cloudflare toolchain</h1>
  <p class="meta">POST /chat → <code>${label}</code> (SSE)</p>
  <form id="f">
    <input id="m" type="text" placeholder="Ask…" autocomplete="off" required />
    <button type="submit">Send</button>
  </form>
  <div id="out" aria-live="polite"></div>
  <script>
    const form = document.getElementById('f');
    const input = document.getElementById('m');
    const out = document.getElementById('out');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      out.textContent = '';
      out.classList.remove('err');
      form.querySelector('button').disabled = true;
      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || ('HTTP ' + res.status));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\\n\\n');
          buf = parts.pop() || '';
          for (const part of parts) {
            let event = 'message';
            let data = '';
            for (const line of part.split('\\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (!data) continue;
            const payload = JSON.parse(data);
            if (event === 'token' && payload.text) out.textContent += payload.text;
            if (event === 'error') throw new Error(payload.error || 'stream error');
          }
        }
      } catch (err) {
        out.classList.add('err');
        out.textContent = String(err.message || err);
      } finally {
        form.querySelector('button').disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const upstream = resolveUpstream(env);

    if (request.method === "GET" && path === "/health") {
      return json({
        ok: true,
        service: "grok-cloudflare-toolchain",
        upstream:
          "error" in upstream
            ? { configured: false, error: upstream.error }
            : {
                configured: true,
                kind: upstream.kind,
                model: upstream.model,
                url: upstream.url,
              },
        has_xai_key: Boolean(env.XAI_API_KEY),
        local_ai_provider: env.LOCAL_AI_PROVIDER || null,
        supabase_target_env: env.SUPABASE_TARGET_ENV || null,
        allow_unsafe_schema_mutations: env.ALLOW_UNSAFE_SCHEMA_MUTATIONS || null,
      });
    }

    if (request.method === "GET" && (path === "/" || path === "")) {
      return new Response(demoHtml(env), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "POST" && path === "/chat") {
      return handleChat(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
