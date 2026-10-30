/**
 * qron-image-gen — Cloudflare Worker (ES module)
 *
 * Primary engine: Workers AI @cf/black-forest-labs/flux-1-schnell.
 * That model is on the account's included neuron allocation.
 * Hugging Face Inference Providers stay as an optional fallback when
 * HF_TOKEN is present. A missing token does not block generation.
 *
 * Routes:
 *   GET  /health
 *   POST /generate
 *   POST /generate/qron
 *   POST /generate/image
 *   POST /v1/generate
 */

const WORKERS_AI_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const WORKERS_AI_FALLBACK = "@cf/black-forest-labs/flux-2-klein-4b";
const PROMPT_MAX = 2048;

const MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1-schnell", provider: "nscale", timeout: 15000 },
  { id: "black-forest-labs/FLUX.1-dev", name: "FLUX.1-dev", provider: "replicate", timeout: 20000 },
];

const ROUTER = "https://router.huggingface.co";

const STYLE_PRESETS = {
  gold_vault: {
    prefix: "Isometric 3D render of gold bars arranged in a vault formation, metallic gold surfaces reflecting warm amber light, ",
    suffix: ", premium luxury aesthetic, 8K ultra-detailed, professional product photography lighting, black background",
  },
  luxury_dark: {
    prefix: "Premium dark luxury composition, matte black surfaces with gold accents, ",
    suffix: ", cinematic lighting, depth of field, professional studio photography, 8K, magazine quality",
  },
  neon_cyber: {
    prefix: "Cyberpunk neon-lit scene, holographic displays and glowing circuits, ",
    suffix: ", volumetric lighting, ray-traced reflections, futuristic technology aesthetic, 8K ultra HD",
  },
  marble_white: {
    prefix: "Minimalist marble and white gold composition, clean geometric shapes, ",
    suffix: ", soft diffused lighting, architectural photography style, ultra clean, 8K professional",
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function shortError(value) {
  const text = String(value || "unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/hf_[A-Za-z0-9]+/g, "hf_[redacted]");
  return text.slice(0, 300);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function clipPrompt(prompt) {
  const text = String(prompt || "").trim();
  return text.length > PROMPT_MAX ? text.slice(0, PROMPT_MAX) : text;
}

async function imageFromAiResult(result) {
  if (!result) return null;
  if (typeof result === "string" && result.length > 32) {
    return { base64: result, contentType: "image/jpeg" };
  }
  if (typeof result.image === "string" && result.image.length > 0) {
    const raw = result.image;
    if (raw.startsWith("data:")) {
      const comma = raw.indexOf(",");
      const meta = raw.slice(0, comma);
      const contentType = meta.includes("image/png") ? "image/png" : "image/jpeg";
      return { base64: raw.slice(comma + 1), contentType };
    }
    return { base64: raw, contentType: "image/jpeg" };
  }
  if (result.image instanceof Uint8Array) {
    return { base64: bytesToBase64(result.image), contentType: "image/jpeg" };
  }
  if (result instanceof ArrayBuffer) {
    return { base64: bytesToBase64(new Uint8Array(result)), contentType: "image/jpeg" };
  }
  if (result instanceof Uint8Array) {
    return { base64: bytesToBase64(result), contentType: "image/jpeg" };
  }
  if (typeof result.arrayBuffer === "function") {
    const buf = await result.arrayBuffer();
    return { base64: bytesToBase64(new Uint8Array(buf)), contentType: "image/jpeg" };
  }
  if (typeof result.getReader === "function") {
    const buf = await new Response(result).arrayBuffer();
    return { base64: bytesToBase64(new Uint8Array(buf)), contentType: "image/jpeg" };
  }
  return null;
}

function modelRejected(error) {
  const text = String(error || "").toLowerCase();
  return /not found|unknown model|does not exist|no such model|invalid model|unsupported|model .* rejected/.test(text);
}

async function generateWithWorkersAi(ai, prompt) {
  if (!ai || typeof ai.run !== "function") {
    return { ok: false, error: "workers ai binding missing" };
  }
  const clipped = clipPrompt(prompt);
  if (!clipped) return { ok: false, error: "prompt required" };
  try {
    const result = await ai.run(WORKERS_AI_MODEL, { prompt: clipped, steps: 4 });
    const image = await imageFromAiResult(result);
    if (image && image.base64) {
      return { ok: true, model: "workers-ai flux-1-schnell", modelId: WORKERS_AI_MODEL, ...image };
    }
    return { ok: false, error: "workers ai returned no image", rejected: true };
  } catch (err) {
    const error = shortError(err && err.message ? err.message : err);
    return { ok: false, error, rejected: modelRejected(error) };
  }
}

async function generateWithFluxKlein(ai, prompt) {
  if (!ai || typeof ai.run !== "function") {
    return { ok: false, error: "workers ai binding missing" };
  }
  const form = new FormData();
  form.append("prompt", clipPrompt(prompt));
  const formResponse = new Response(form);
  const result = await ai.run(WORKERS_AI_FALLBACK, {
    multipart: {
      body: formResponse.body,
      contentType: formResponse.headers.get("content-type"),
    },
  });
  const image = await imageFromAiResult(result);
  if (!image || !image.base64) return { ok: false, error: "flux-2-klein returned no image" };
  return { ok: true, model: "workers-ai flux-2-klein-4b", modelId: WORKERS_AI_FALLBACK, ...image };
}

async function generateWithHuggingFace(prompt, token, width, height) {
  const errors = [];
  if (!token) return { success: false, errors };

  try {
    const res = await fetch(`${ROUTER}/nscale/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: clipPrompt(prompt),
        size: `${width}x${height}`,
        response_format: "b64_json",
        n: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (b64) {
        return {
          success: true,
          model: "FLUX.1-schnell",
          model_id: "black-forest-labs/FLUX.1-schnell",
          image_base64: b64,
          content_type: "image/png",
          width,
          height,
          generated_at: new Date().toISOString(),
        };
      }
      errors.push({ model: "FLUX.1-schnell", error: "images route returned no b64_json" });
    } else {
      const errText = await res.text().catch(() => "Unknown error");
      errors.push({ model: "FLUX.1-schnell", status: res.status, error: shortError(errText) });
    }
  } catch (err) {
    errors.push({ model: "FLUX.1-schnell", error: shortError(err && err.message) });
  }

  for (const model of MODELS) {
    const url = `${ROUTER}/${model.provider}/models/${model.id}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: clipPrompt(prompt),
          parameters: {
            width,
            height,
            num_inference_steps: model.id.includes("schnell") ? 4 : 25,
          },
        }),
        signal: AbortSignal.timeout(model.timeout),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        errors.push({ model: model.name, status: res.status, error: shortError(errText) });
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("image")) {
        errors.push({ model: model.name, error: `Unexpected content-type: ${contentType.slice(0, 80)}` });
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      return {
        success: true,
        model: model.name,
        model_id: model.id,
        image_base64: bytesToBase64(bytes),
        content_type: contentType,
        width,
        height,
        generated_at: new Date().toISOString(),
      };
    } catch (err) {
      errors.push({ model: model.name, error: shortError(err && err.message) });
    }
  }

  return { success: false, errors };
}

async function generateImage(env, prompt, width, height) {
  const errors = [];
  const local = await generateWithWorkersAi(env.AI, prompt);
  if (local.ok) {
    return {
      success: true,
      model: local.model,
      model_id: local.modelId,
      image_base64: local.base64,
      content_type: local.contentType,
      width,
      height,
      generated_at: new Date().toISOString(),
    };
  }
  errors.push({ model: "workers-ai flux-1-schnell", error: shortError(local.error) });

  if (local.rejected) {
    try {
      const klein = await generateWithFluxKlein(env.AI, prompt);
      if (klein.ok) {
        return {
          success: true,
          model: klein.model,
          model_id: klein.modelId,
          image_base64: klein.base64,
          content_type: klein.contentType,
          width,
          height,
          generated_at: new Date().toISOString(),
        };
      }
      errors.push({ model: "workers-ai flux-2-klein-4b", error: shortError(klein.error) });
    } catch (err) {
      errors.push({ model: "workers-ai flux-2-klein-4b", error: shortError(err && err.message) });
    }
  }

  const token = typeof env.HF_TOKEN === "string" && env.HF_TOKEN ? env.HF_TOKEN : "";
  if (token) {
    const remote = await generateWithHuggingFace(prompt, token, width, height);
    if (remote.success) return remote;
    errors.push(...(remote.errors || []));
  }

  return { success: false, errors };
}

function applyStyle(prompt, style) {
  const preset = style && STYLE_PRESETS[style];
  if (!preset) return prompt;
  return `${preset.prefix}${prompt || "QRON authentication seal"}${preset.suffix}`;
}

function imageJson(result, prompt) {
  return {
    success: true,
    model: result.model,
    prompt: String(prompt || "").substring(0, 200),
    image: {
      base64: result.image_base64,
      content_type: result.content_type,
      width: result.width,
      height: result.height,
      data_url: `data:${result.content_type};base64,${result.image_base64}`,
    },
    generated_at: result.generated_at,
  };
}

async function handleRequest(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (path === "/" || path === "/health") {
    return json({
      service: "qron-image-gen",
      version: env.WORKER_VERSION || "1.0.0",
      status: "ok",
      engine: "workers-ai",
      models: [WORKERS_AI_MODEL],
      hf_fallback: Boolean(env.HF_TOKEN),
      styles: Object.keys(STYLE_PRESETS),
      timestamp: new Date().toISOString(),
    });
  }

  if (path === "/v1/generate" && req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    let prompt = body.prompt || "QRON AI art authentication seal";
    prompt = applyStyle(prompt, body.style || "gold_vault");
    const result = await generateImage(env, prompt, 1024, 1024);
    if (!result.success) return json({ error: "Generation failed", details: result.errors }, 502);
    const dataUrl = `data:${result.content_type};base64,${result.image_base64}`;
    return json({
      id: `qron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      downloadUrl: dataUrl,
      previewUrl: dataUrl,
      status: "complete",
      model: result.model,
      generated_at: result.generated_at,
    });
  }

  if ((path === "/generate" || path === "/generate/qron") && req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    let { prompt, style, width, height } = body;
    if (!prompt && !style) return json({ error: "prompt or style required" }, 400);

    width = Math.min(Math.max(width || 1024, 256), 1536);
    height = Math.min(Math.max(height || 1024, 256), 1536);
    if (style && STYLE_PRESETS[style]) prompt = applyStyle(prompt, style);
    if (path === "/generate/qron") {
      prompt = prompt || "QRON authentication seal, isometric 3D gold bars with QR code pattern, premium vault aesthetic";
      if (!String(prompt).toLowerCase().includes("qron")) prompt = `QRON branded ${prompt}`;
    }

    const result = await generateImage(env, prompt, width, height);
    if (!result.success) return json({ error: "All models failed", details: result.errors }, 502);
    return json(imageJson(result, prompt));
  }

  if (path === "/generate/image" && req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { prompt, style, width, height } = body;
    const finalPrompt = applyStyle(prompt || "QRON authentication seal", style);
    const result = await generateImage(
      env,
      finalPrompt,
      Math.min(Math.max(width || 1024, 256), 1536),
      Math.min(Math.max(height || 1024, 256), 1536),
    );
    if (!result.success) return json({ error: "Generation failed", details: result.errors }, 502);
    const imageBytes = Uint8Array.from(atob(result.image_base64), (c) => c.charCodeAt(0));
    return new Response(imageBytes, {
      headers: {
        ...CORS,
        "Content-Type": result.content_type,
        "X-Model": result.model,
        "X-Generated-At": result.generated_at,
      },
    });
  }

  return json({ error: "Not found", routes: ["/health", "/generate", "/generate/qron", "/generate/image"] }, 404);
}

export default {
  async fetch(req, env) {
    return handleRequest(req, env);
  },
};
