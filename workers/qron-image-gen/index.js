/**
 * qron-image-gen — Cloudflare Worker
 * AI image generation via HuggingFace FLUX.1 models
 * Multi-model fallback: schnell → dev → Krea-dev
 * Style presets: gold_vault, luxury_dark, neon_cyber, marble_white
 * 
 * Routes:
 *   GET  /health       → status + model info
 *   POST /generate     → generate image from prompt
 *   POST /generate/qron → generate QRON-branded art
 *
 * Secrets required: HF_TOKEN
 */

const MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1-schnell', timeout: 30000 },
  { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1-dev', timeout: 60000 },
  { id: 'Kvikontent/midjourney-v6.1', name: 'Midjourney-v6.1', timeout: 60000 },
];

const BASE_URL = 'https://router.huggingface.co/hf-inference/models/';

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

async function generateImage(prompt, token, width = 1024, height = 1024) {
  const errors = [];

  for (const model of MODELS) {
    const url = `${BASE_URL}${model.id}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width,
            height,
            num_inference_steps: model.id.includes('schnell') ? 4 : 25,
          },
        }),
        signal: AbortSignal.timeout(model.timeout),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        errors.push({ model: model.name, status: res.status, error: errText });
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('image')) {
        errors.push({ model: model.name, error: `Unexpected content-type: ${contentType}` });
        continue;
      }

      const imageBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(imageBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

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
      errors.push({ model: model.name, error: err.message || 'Timeout or network error' });
      continue;
    }
  }

  return { success: false, errors };
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(req, event) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Health check
  if (path === '/' || path === '/health') {
    return json({
      service: 'qron-image-gen',
      version: '1.0.0',
      status: 'ok',
      models: MODELS.map(m => m.name),
      styles: Object.keys(STYLE_PRESETS),
      timestamp: new Date().toISOString(),
    });
  }

  // v1 compatibility — matches qron-app Next.js route expectations
  // Accepts: { url, prompt, style }
  // Returns: { id, downloadUrl, previewUrl, status }
  if (path === '/v1/generate' && req.method === 'POST') {
    const token = typeof HF_TOKEN !== 'undefined' ? HF_TOKEN : null;
    if (!token) return json({ error: 'HF_TOKEN not configured' }, 500);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    let prompt = body.prompt || 'QRON AI art authentication seal';
    const style = body.style || 'gold_vault';

    if (STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      prompt = `${preset.prefix}${prompt}${preset.suffix}`;
    }

    const result = await generateImage(prompt, token, 1024, 1024);

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
    const token = typeof HF_TOKEN !== 'undefined' ? HF_TOKEN : null;
    if (!token) {
      return json({ error: 'HF_TOKEN not configured' }, 500);
    }

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
    if (style && STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      prompt = `${preset.prefix}${prompt || 'QRON authentication seal'}${preset.suffix}`;
    }

    // For /generate/qron, add QRON branding to prompt
    if (path === '/generate/qron') {
      prompt = prompt || 'QRON authentication seal, isometric 3D gold bars with QR code pattern, premium vault aesthetic';
      if (!prompt.toLowerCase().includes('qron')) {
        prompt = `QRON branded ${prompt}`;
      }
    }

    const result = await generateImage(prompt, token, width, height);

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
    const token = typeof HF_TOKEN !== 'undefined' ? HF_TOKEN : null;
    if (!token) return json({ error: 'HF_TOKEN not configured' }, 500);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const { prompt, style, width, height } = body;
    let finalPrompt = prompt || 'QRON authentication seal';

    if (style && STYLE_PRESETS[style]) {
      const preset = STYLE_PRESETS[style];
      finalPrompt = `${preset.prefix}${finalPrompt}${preset.suffix}`;
    }

    const result = await generateImage(
      finalPrompt, token,
      Math.min(Math.max(width || 1024, 256), 1536),
      Math.min(Math.max(height || 1024, 256), 1536),
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
