/**
 * qron-image-gen — Cloudflare Worker
 * AI image generation via Cloudflare Workers AI
 * Multi-model fallback: FLUX.1-schnell → SDXL-Lightning → SDXL-base
 * Style presets: gold_vault, luxury_dark, neon_cyber, marble_white
 *
 * Routes:
 *   GET  /health       → status + model info
 *   POST /generate     → generate image from prompt
 *   POST /generate/qron → generate QRON-branded art
 *   POST /generate/image → generate and return raw image bytes
 *   POST /v1/generate  → qron-app compatible endpoint
 *
 * Requires the Workers AI binding ([ai] binding = "AI" in wrangler.toml).
 */

const MODELS = [
  // flux-1-schnell returns JSON { image: <base64 jpeg> }; fixed output size, no negative prompt
  { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1-schnell', kind: 'flux' },
  // SDXL models return raw PNG bytes and accept width/height/negative_prompt
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL-Lightning', kind: 'sdxl' },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL-base', kind: 'sdxl' },
];

const STYLE_PRESETS = {
  gold_vault: {
    prefix: 'Isometric 3D render of gold bars arranged in a vault formation, metallic gold surfaces reflecting warm amber light, ',
    suffix: ', premium luxury aesthetic, 8K ultra-detailed, professional product photography lighting, black background',
    negative: 'blurry, low quality, cartoon, text, watermark',
  },
  luxury_dark: {
    prefix: 'Premium dark luxury composition, matte black surfaces with gold accents, ',
    suffix: ', cinematic lighting, depth of field, professional studio photography, 8K, magazine quality',
    negative: 'bright, colorful, cartoon, low quality, text',
  },
  neon_cyber: {
    prefix: 'Cyberpunk neon-lit scene, holographic displays and glowing circuits, ',
    suffix: ', volumetric lighting, ray-traced reflections, futuristic technology aesthetic, 8K ultra HD',
    negative: 'natural, organic, old-fashioned, low quality, blurry',
  },
  marble_white: {
    prefix: 'Minimalist marble and white gold composition, clean geometric shapes, ',
    suffix: ', soft diffused lighting, architectural photography style, ultra clean, 8K professional',
    negative: 'dark, grungy, cluttered, colorful, cartoon, text',
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function generateImage(ai, prompt, width = 1024, height = 1024, negativePrompt = '') {
  const errors = [];

  for (const model of MODELS) {
    try {
      let base64;
      let contentType;

      if (model.kind === 'flux') {
        // flux-1-schnell caps prompts at 2048 chars and steps at 8
        const result = await ai.run(model.id, {
          prompt: prompt.slice(0, 2048),
          steps: 4,
        });
        if (!result || typeof result.image !== 'string') {
          errors.push({ model: model.name, error: 'No image in model response' });
          continue;
        }
        base64 = result.image;
        contentType = 'image/jpeg';
      } else {
        const stream = await ai.run(model.id, {
          prompt,
          negative_prompt: negativePrompt || undefined,
          width,
          height,
          num_steps: 20,
        });
        const buffer = await new Response(stream).arrayBuffer();
        if (buffer.byteLength === 0) {
          errors.push({ model: model.name, error: 'Empty image response' });
          continue;
        }
        base64 = bytesToBase64(new Uint8Array(buffer));
        contentType = 'image/png';
      }

      return {
        success: true,
        model: model.name,
        model_id: model.id,
        image_base64: base64,
        content_type: contentType,
        width,
        height,
        generated_at: new Date().toISOString(),
      };
    } catch (err) {
      errors.push({ model: model.name, error: err.message || 'Inference error' });
      continue;
    }
  }

  return { success: false, errors };
}

async function handleRequest(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Health check
  if (path === '/' || path === '/health') {
    return json({
      service: 'qron-image-gen',
      version: '2.0.0',
      status: 'ok',
      provider: 'cloudflare-workers-ai',
      models: MODELS.map(m => m.name),
      styles: Object.keys(STYLE_PRESETS),
      timestamp: new Date().toISOString(),
    });
  }

  // v1 compatibility — matches qron-app Next.js route expectations
  // Accepts: { url, prompt, style }
  // Returns: { id, downloadUrl, previewUrl, status }
  if (path === '/v1/generate' && req.method === 'POST') {
    if (!env.AI) return json({ error: 'AI binding not configured' }, 500);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    let prompt = body.prompt || 'QRON AI art authentication seal';
    const style = body.style || 'gold_vault';
    let negative = '';

    if (STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      prompt = `${preset.prefix}${prompt}${preset.suffix}`;
      negative = preset.negative;
    }

    const result = await generateImage(env.AI, prompt, 1024, 1024, negative);

    if (!result.success) {
      return json({ error: 'Generation failed', details: result.errors }, 502);
    }

    const dataUrl = `data:${result.content_type};base64,${result.image_base64}`;
    return json({
      id: `qron_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      downloadUrl: dataUrl,
      previewUrl: dataUrl,
      status: 'complete',
      model: result.model,
      generated_at: result.generated_at,
    });
  }

  // Generate image
  if ((path === '/generate' || path === '/generate/qron') && req.method === 'POST') {
    if (!env.AI) return json({ error: 'AI binding not configured' }, 500);

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    let { prompt, style, width, height } = body;

    if (!prompt && !style) {
      return json({ error: 'prompt or style required' }, 400);
    }

    width = Math.min(Math.max(width || 1024, 256), 1536);
    height = Math.min(Math.max(height || 1024, 256), 1536);

    // Apply style preset
    let negative = '';
    if (style && STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      prompt = `${preset.prefix}${prompt || 'QRON authentication seal'}${preset.suffix}`;
      negative = preset.negative;
    }

    // For /generate/qron, add QRON branding to prompt
    if (path === '/generate/qron') {
      prompt = prompt || 'QRON authentication seal, isometric 3D gold bars with QR code pattern, premium vault aesthetic';
      if (!prompt.toLowerCase().includes('qron')) {
        prompt = `QRON branded ${prompt}`;
      }
    }

    const result = await generateImage(env.AI, prompt, width, height, negative);

    if (!result.success) {
      return json({
        error: 'All models failed',
        details: result.errors,
      }, 502);
    }

    // Return as JSON with base64 image
    return json({
      success: true,
      model: result.model,
      prompt: prompt.substring(0, 200),
      image: {
        base64: result.image_base64,
        content_type: result.content_type,
        width: result.width,
        height: result.height,
        data_url: `data:${result.content_type};base64,${result.image_base64}`,
      },
      generated_at: result.generated_at,
    });
  }

  // Serve image directly (for embedding)
  if (path === '/generate/image' && req.method === 'POST') {
    if (!env.AI) return json({ error: 'AI binding not configured' }, 500);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { prompt, style, width, height } = body;
    let finalPrompt = prompt || 'QRON authentication seal';
    let negative = '';

    if (style && STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      finalPrompt = `${preset.prefix}${finalPrompt}${preset.suffix}`;
      negative = preset.negative;
    }

    const result = await generateImage(
      env.AI, finalPrompt,
      Math.min(Math.max(width || 1024, 256), 1536),
      Math.min(Math.max(height || 1024, 256), 1536),
      negative,
    );

    if (!result.success) return json({ error: 'Generation failed', details: result.errors }, 502);

    const imageBytes = Uint8Array.from(atob(result.image_base64), c => c.charCodeAt(0));
    return new Response(imageBytes, {
      headers: {
        ...CORS,
        'Content-Type': result.content_type,
        'X-Model': result.model,
        'X-Generated-At': result.generated_at,
      },
    });
  }

  return json({ error: 'Not found', routes: ['/health', '/generate', '/generate/qron', '/generate/image'] }, 404);
}

export default {
  async fetch(req, env) {
    return handleRequest(req, env);
  },
};
