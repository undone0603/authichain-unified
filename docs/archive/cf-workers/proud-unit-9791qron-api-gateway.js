--de5fa91d7208250e3940ebbf58b3bf60d47cbb55fec3086de41ae1096baa
Content-Disposition: form-data; name="worker.js"

/**
 * proud-unit-9791qron-api-gateway — QRON API Gateway
 * Handles QR generation by proxying to Supabase edge function.
 * Deployed: 2026-03-24
 */

const SUPABASE_URL = "https://nhdnkzhtadfkkluiulhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZG5remh0YWRma2tsdWl1bGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDg2NTUsImV4cCI6MjA1Nzk4NDY1NX0.M3yXKRxGcCiCQjd4wJ3lnH4kU53Ly0XHVRS4Hg3FDGU";
const FAL_KEY = "2967221a-5074-48e0-b1a7-731fdb379816:47648114858eb5fa501be154497a3848";
const QR_BASE = "https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&ecc=H&data=";

const VERSION = "2.0.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, apikey",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Rate limit via KV
async function checkRateLimit(ip, env) {
  if (!env.QRON_KV) return true;
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
  const hits = parseInt((await env.QRON_KV.get(key)) || "0");
  if (hits >= 60) return false;
  await env.QRON_KV.put(key, String(hits + 1), { expirationTtl: 120 });
  return true;
}

// Main generation via Supabase edge function (handles auth + DB)
async function generateViaEdge(body, authHeader) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/qron-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      ...(authHeader ? { "Authorization": authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

// Direct fal.ai generation (no auth required, no credit tracking)
async function generateDirectFal(targetUrl, prompt, steps = 30) {
  const qrImageUrl = QR_BASE + encodeURIComponent(targetUrl);

  const submit = await fetch("https://queue.fal.run/fal-ai/illusion-diffusion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      image_url: qrImageUrl,
      prompt: `highly detailed scannable QR code art, ${prompt}, professional quality`,
      negative_prompt: "ugly, blurry, deformed, low quality, watermark, unreadable",
      guidance_scale: 8.5,
      num_inference_steps: steps,
      controlnet_conditioning_scale: 1.4,
      seed: Math.floor(Math.random() * 999999),
    }),
  });

  if (!submit.ok) {
    const err = await submit.text();
    throw new Error(`fal.ai submit ${submit.status}: ${err}`);
  }

  const queue = await submit.json();

  // Poll for result
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(queue.status_url, {
      headers: { "Authorization": `Key ${FAL_KEY}` },
    });
    const status = await statusRes.json();

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(queue.response_url, {
        headers: { "Authorization": `Key ${FAL_KEY}` },
      });
      const data = await resultRes.json();
      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image in fal.ai response");
      return imageUrl;
    }
    if (status.status === "FAILED") throw new Error("fal.ai generation failed");
  }
  throw new Error("fal.ai timed out");
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Rate limiting
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    if (env.QRON_KV && !(await checkRateLimit(ip, env))) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    // ── Health ────────────────────────────────────────────────────
    if (path === "/" || path === "/health") {
      return json({
        status: "ok",
        version: VERSION,
        ecosystem: "qron.space",
        timestamp: new Date().toISOString(),
        endpoints: {
          generate: "POST /api/generate",
          qr_generate: "POST /api/qr/generate",
          token: "GET /api/token",
          stats: "GET /api/stats",
        },
      });
    }

    // ── QRON Generation ──────────────────────────────────────────
    if ((path === "/api/generate" || path === "/api/qr/generate") && method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const targetUrl = body.targetUrl || body.url || body.data;
      if (!targetUrl) return json({ error: "targetUrl is required" }, 400);
      if (!targetUrl.startsWith("http")) return json({ error: "targetUrl must be an HTTP URL" }, 400);

      const authHeader = req.headers.get("Authorization");

      try {
        // Try authenticated edge function first (tracks credits)
        if (authHeader) {
          const edgeRes = await generateViaEdge(body, authHeader);
          const data = await edgeRes.json();

          if (edgeRes.ok) {
            return json(data);
          }

          // If limit reached, return that error
          if (data.code === "LIMIT_REACHED" || edgeRes.status === 403) {
            return json(data, 403);
          }
          // Otherwise fall through to direct generation
        }

        // Direct fal.ai generation (unauthenticated or edge fn failed)
        const prompt = body.prompt || "artistic qr code, beautiful colorful design, high detail";
        const steps = 30;
        const imageUrl = await generateDirectFal(targetUrl, prompt, steps);

        return json({
          qron: {
            id: crypto.randomUUID(),
            imageUrl,
            destinationUrl: targetUrl,
            prompt,
          },
          imageUrl,
          qrDataUrl: imageUrl,
          url: targetUrl,
        });
      } catch (err) {
        console.error("[qron-generate]", err.message);
        return json({ error: err.message || "Generation failed" }, 500);
      }
    }

    // ── Token metadata ────────────────────────────────────────────
    if (path.startsWith("/api/token")) {
      const sub = path.replace("/api/token", "");
      if (sub === "/price") {
        const cached = env.QRON_KV ? await env.QRON_KV.get("token:price", "json") : null;
        return json(cached || { price: null, updated: null });
      }
      return json({
        name: "QRON",
        symbol: "QRON",
        network: "Polygon",
        decimals: 18,
        contract: "0x0000000000000000000000000000000000000000",
        links: {
          website: "https://qron.space",
          authichain: "https://authichain.com",
        },
      });
    }

    // ── Stats ─────────────────────────────────────────────────────
    if (path === "/api/stats" || path === "/api/analytics") {
      const count = env.QRON_KV ? parseInt((await env.QRON_KV.get("qr:total_count")) || "0") : 0;
      return json({
        ecosystem: "qron.space",
        version: VERSION,
        qr_codes_generated: count,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Auth passthrough ──────────────────────────────────────────
    if (path === "/api/auth/status") {
      return json({ auth_provider: "Supabase", status: "active" });
    }

    return json({ error: "Not found", path, version: VERSION }, 404);
  },
};

--de5fa91d7208250e3940ebbf58b3bf60d47cbb55fec3086de41ae1096baa--
