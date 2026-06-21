import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { validateQRScannability } from './vision';

// Accept any of the token names this codebase / deploy pipeline uses. The Vercel
// sync (scripts/push-env-to-vercel.sh) ships HF_TOKEN / HF_API_KEY /
// HUGGINGFACE_API_KEY, while older code paths read HUGGINGFACE_TOKEN — resolve
// all of them so a key set under any single name still connects.
const HF_TOKEN =
  process.env.HF_TOKEN ||
  process.env.HUGGINGFACE_TOKEN ||
  process.env.HUGGINGFACE_API_KEY ||
  process.env.HF_API_KEY;
// Router base + model are overridable via env so the endpoint can be repointed
// (e.g. to a different inference provider) without a code change.
const HF_ROUTER_BASE = (process.env.HF_ROUTER_BASE || 'https://router.huggingface.co/hf-inference/models').replace(/\/$/, '');
const HF_MODEL = process.env.HF_QR_MODEL || 'DionTimmer/controlnet_qrcode-control_v1p_sd15';
const HF_API_URL = `${HF_ROUTER_BASE}/${HF_MODEL}`;
const HF_TIMEOUT_MS = 90_000;

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _supabaseAdmin;
}

/**
 * Generates a "Living QR" using Hugging Face Inference APIs.
 * Includes retry logic with parameter adjustment and a Vision Guardrail.
 */
export async function generateLivingQR({
  url,
  prompt,
  negative_prompt = 'ugly, disfigured, low quality, blurry, nsfw',
  qr_weight = 1.35,
  start_step = 0.35,
  max_retries = 2,
}: {
  url: string;
  prompt: string;
  negative_prompt?: string;
  qr_weight?: number;
  start_step?: number;
  max_retries?: number;
}) {
  if (!HF_TOKEN) {
    throw new Error('Hugging Face token is missing — set HF_TOKEN (or HUGGINGFACE_API_KEY)');
  }

  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 768,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const qrBase64 = qrBuffer.toString('base64');

  let currentQrWeight = qr_weight;
  let currentStartStep = start_step;
  let attempt = 0;
  let finalBuffer: Buffer | null = null;
  let isVerified = false;

  while (attempt <= max_retries && !isVerified) {
    console.log(`[HF-Gen] Attempt ${attempt + 1}: Weight=${currentQrWeight}, Start=${currentStartStep}`);

    const response = await fetch(HF_API_URL, {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        // Block until the model is warm instead of getting a cold-start 503.
        // Without this, the first request after idle fails and the whole
        // connection appears broken.
        'x-wait-for-model': 'true',
      },
      method: 'POST',
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          negative_prompt,
          controlnet_conditioning_scale: currentQrWeight,
          control_guidance_start: currentStartStep,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
        image: qrBase64,
      }),
      // Timeout: diffusion models can take 60-90s; bail after 90s
      signal: AbortSignal.timeout(HF_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 503) throw new Error('HF Model is currently loading');
      throw new Error(`HF API Error: ${response.status} - ${error}`);
    }

    const imageBlob = await response.blob();
    finalBuffer = Buffer.from(await imageBlob.arrayBuffer());

    const validation = await validateQRScannability(finalBuffer);
    if (validation.isScannable) {
      isVerified = true;
      console.log(`[HF-Gen] Validation Passed on attempt ${attempt + 1}`);
    } else {
      console.warn('[HF-Gen] Scannability Check Failed. Adjusting parameters...');
      currentQrWeight += 0.25;
      currentStartStep = Math.max(0, currentStartStep - 0.1);
      attempt++;
    }
  }

  if (!finalBuffer) throw new Error('Failed to generate image buffer');

  const fileName = `generated/${crypto.randomUUID()}.png`;
  const { data: uploadData, error: uploadError } = await getSupabaseAdmin().storage
    .from('qrons')
    .upload(fileName, finalBuffer, {
      contentType: 'image/png',
      upsert: false, // UUID filenames make collisions impossible; don't overwrite
    });

  if (uploadError) {
    throw new Error(`Failed to upload to Supabase: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = getSupabaseAdmin().storage.from('qrons').getPublicUrl(fileName);

  return {
    imageUrl: publicUrl,
    fileName,
    storagePath: uploadData.path,
    scannable: isVerified,
    attempts: attempt + 1,
  };
}
